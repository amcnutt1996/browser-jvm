import {
  type ConstantPoolEntry,
  type MemberRef,
} from "./classfile.ts";
import { bootstrapIndy, type CallSite } from "./indy.ts";
import { initialize } from "./initialize.ts";
import { compile, Suspend, Terminated } from "./jit.ts";
import {
  enter,
  exit,
  type Lockable,
  tryEnter,
} from "./monitors.ts";
import {
  arrayIndexError,
  castError,
  d2i,
  d2l,
  describe,
  newMultiArray,
  resolveClass,
  resolveConstant,
  resolveField,
  resolveMethod,
  toJavaException,
} from "./resolve.ts";
import {
  Frame,
  INITIALIZED,
  InternalError,
  type JArray,
  JavaThrow,
  type JClass,
  JMethod,
  type JObject,
  type JThread,
  type Request,
} from "./types.ts";
import { type JVM } from "./vm.ts";

const CHECK_INTERVAL = 4096;

const MAX_FRAMES = 6000;

const TRACE =
  typeof process !== "undefined" && Boolean(process.env.JVM_TRACE);

const NEWARRAY_TYPES = ["", "", "", "", "Z", "C", "F", "D", "B", "S", "I", "J"];

const pseudoMethods = new Map<string, JMethod>();

export const pseudoMethod = (vm: JVM, name: string, ret = "V"): JMethod => {
  const key = `${name}:${ret}`;
  let method = pseudoMethods.get(key);

  if (!method || method.cls !== vm.objectClass) {
    method = new JMethod(vm.objectClass, {
      access: 0x1008,
      descriptor: `()${ret}`,
      exceptions: [],
      name,
    });
    pseudoMethods.set(key, method);
  }

  return method;
};

export const pushGenerator = (
  vm: JVM,
  thread: JThread,
  method: JMethod,
  generator: Generator<Request, unknown, unknown>
): void => {
  const frame = new Frame(method, 0, 0);

  frame.gen = generator;
  thread.frames.push(frame);
};

export const pushInitialization = (
  vm: JVM,
  thread: JThread,
  cls: JClass
): void => {
  pushGenerator(
    vm,
    thread,
    pseudoMethod(vm, "<initialize>"),
    initialize(vm, thread, cls)
  );
};

export const collectArgs = (
  method: JMethod,
  stack: unknown[],
  base: number
): unknown[] => {
  const args: unknown[] = [];
  let slot = base;

  if (!method.isStatic) args.push(stack[slot++]);

  for (const type of method.args) {
    args.push(stack[slot]);
    slot += type === "J" || type === "D" ? 2 : 1;
  }

  return args;
};

const findHandler = (
  vm: JVM,
  frame: Frame,
  exception: JObject
): number => {
  const { handlers } = frame.method;
  const { pc } = frame;

  for (const handler of handlers) {
    if (pc < handler.startPc || pc >= handler.endPc) continue;

    if (handler.catchClass === undefined) {
      handler.catchClass = vm.loadClass(
        handler.catchType as string,
        frame.method.cls.loader
      );
    }

    if (
      handler.catchClass === null ||
      exception.$cls.isSubclassOf(handler.catchClass)
    ) {
      return handler.handlerPc;
    }
  }

  return -1;
};

export const describeException = (exception: JObject): string => {
  const lines: string[] = [];
  const seen = new Set<JObject>();
  let current: JObject | null = exception;
  let prefix = "";

  while (current && !seen.has(current)) {
    seen.add(current);

    const message = current._detailMessage;

    lines.push(
      `${prefix}${current.$cls.name.replaceAll("/", ".")}${message === null || message === undefined ? "" : `: ${message as string}`}`
    );

    for (const [method, pc] of (current._backtrace ?? []) as [JMethod, number][]) {
      lines.push(
        `\tat ${method.cls.name.replaceAll("/", ".")}.${method.name}(${method.cls.cf?.sourceFile ?? "Unknown Source"}:${method.lineNumber(pc)})`
      );
    }

    const cause = current._cause as JObject | null | undefined;

    current = cause === current ? null : (cause ?? null);
    prefix = "Caused by: ";
  }

  return `${lines.join("\n")}\n`;
};

const uncaught = (vm: JVM, thread: JThread, exception: JObject): void => {
  const javaThread = thread.java;
  const dispatch = javaThread?.$cls.method(
    "dispatchUncaughtException(Ljava/lang/Throwable;)V"
  );

  if (thread.name === "main" && thread.id === 1) vm.exitStatusOnFinish = 1;

  if (thread.pendingException || !dispatch || !javaThread) {
    const original =
      thread.pendingException && thread.pendingException !== exception
        ? `${describeException(thread.pendingException)}while reporting it:\n`
        : "";
    const message = `Exception in thread "${thread.name}" ${original}${describeException(exception)}`;

    vm.host.stderr(new TextEncoder().encode(message));
    vm.terminate(thread);

    return;
  }

  thread.pendingException = exception;
  thread.frames.push(vm.frameFor(dispatch, [javaThread, exception]));
};

const unwind = (vm: JVM, thread: JThread, exception: JObject): void => {
  const { frames } = thread;

  while (frames.length > 0) {
    const frame = frames[frames.length - 1];

    if (frame.gen) {
      thread.resumeError = new JavaThrow(exception);

      return;
    }

    const handlerPc = findHandler(vm, frame, exception);

    if (handlerPc >= 0) {
      frame.pc = handlerPc;
      frame.stack[0] = exception;
      frame.sp = 1;

      return;
    }

    if (frame.lockedMonitor !== undefined) {
      try {
        exit(vm, thread, frame.lockedMonitor);
      } catch {
        // the monitor was not held; the exception already in flight wins
      }
    }

    frames.pop();
  }

  uncaught(vm, thread, exception);
};

const returnToCaller = (
  vm: JVM,
  thread: JThread,
  value: unknown,
  wide: boolean
): void => {
  const frame = thread.frames.pop() as Frame;

  if (frame.lockedMonitor !== undefined) {
    exit(vm, thread, frame.lockedMonitor);
  }

  if (thread.frames.length === 0) return;

  const caller = thread.frames[thread.frames.length - 1];

  if (caller.gen) {
    caller.genValue = value;

    return;
  }

  if (caller.pendingLock !== undefined) {
    caller.lockedMonitor = caller.pendingLock;
    caller.pendingLock = undefined;
  }

  if (caller.resumePc >= 0) {
    if (frame.method.ret !== "V") {
      caller.stack[caller.sp++] = value;

      if (wide) caller.stack[caller.sp++] = undefined;
    }

    caller.pc = caller.resumePc;
    caller.resumePc = -1;
  }
};

const invokeFromNative = (
  vm: JVM,
  thread: JThread,
  method: JMethod,
  args: unknown[]
): void => {
  if (method.native === undefined) method.native = vm.lookupNative(method);

  if (
    method.isStatic &&
    method.cls.state !== INITIALIZED &&
    method.cls.initThread !== thread
  ) {
    const caller = thread.frames[thread.frames.length - 1];

    pushGenerator(
      vm,
      thread,
      pseudoMethod(vm, "<initialize-then-invoke>", method.ret),
      (function* initThenInvoke(): Generator<Request, unknown, unknown> {
        yield* initialize(vm, thread, method.cls);

        return yield vm.invoke(method, args);
      })()
    );
    caller.genValue = undefined;

    return;
  }

  const { native } = method;

  if (native) {
    if (native.generator) {
      pushGenerator(
        vm,
        thread,
        method,
        (native.fn as (t: JThread, a: unknown[]) => Generator<Request>)(
          thread,
          args
        ) as Generator<Request, unknown, unknown>
      );

      return;
    }

    const caller = thread.frames[thread.frames.length - 1];

    try {
      caller.genValue = native.fn(thread, args);
    } catch (error) {
      unwind(vm, thread, toJavaException(vm, error));
    }

    return;
  }

  if (!method.code) {
    unwind(
      vm,
      thread,
      vm.newThrowable(
        method.isAbstract
          ? "java/lang/AbstractMethodError"
          : "java/lang/UnsatisfiedLinkError",
        method.toString()
      )
    );

    return;
  }

  if (thread.frames.length >= MAX_FRAMES) {
    unwind(vm, thread, vm.newThrowable("java/lang/StackOverflowError"));

    return;
  }

  const frame = vm.frameFor(method, args);

  if (method.isSynchronized) {
    const target = (method.isStatic ? method.cls : args[0]) as Lockable;

    frame.lockedMonitor = target;
    thread.frames.push(frame);

    if (!tryEnter(thread, target)) {
      frame.lockedMonitor = undefined;
      frame.pendingLock = target;
      pushGenerator(
        vm,
        thread,
        pseudoMethod(vm, "<monitorenter>"),
        enter(vm, thread, target)
      );
    }

    return;
  }

  thread.frames.push(frame);
};

const stepGenerator = (vm: JVM, thread: JThread, frame: Frame): void => {
  const generator = frame.gen as Generator<Request, unknown, unknown>;
  let result: IteratorResult<Request, unknown>;

  try {
    if (thread.resumeError === undefined) {
      const value =
        thread.resumeValue === undefined ? frame.genValue : thread.resumeValue;

      thread.resumeValue = undefined;
      frame.genValue = undefined;
      result = generator.next(value);
    } else {
      const error = thread.resumeError;

      thread.resumeError = undefined;
      thread.resumeValue = undefined;
      result = generator.throw(error);
    }
  } catch (error) {
    thread.frames.pop();
    unwind(vm, thread, toJavaException(vm, error));

    return;
  }

  if (result.done) {
    const wide = frame.method.ret === "J" || frame.method.ret === "D";

    returnToCaller(vm, thread, result.value, wide);

    return;
  }

  const request = result.value;

  if (request.kind === "invoke") {
    invokeFromNative(vm, thread, request.method, request.args);

    return;
  }

  thread.blocked = true;
  Promise.resolve(request.promise)
    .then((value) => vm.wake(thread, value))
    .catch((error: unknown) => vm.wake(thread, undefined, error));
};

// Runs a frame's method in compiled code from the frame's current state.
const runCompiled = (
  vm: JVM,
  thread: JThread,
  frame: Frame,
  compiled: NonNullable<JMethod["compiled"]>
): void => {
  const { frames } = thread;
  const index = frames.length - 1;

  thread.jitDepth = 0;
  frame.bailPc = -1;

  try {
    const value = compiled(thread, frame);

    frame.lockedMonitor = undefined;
    returnToCaller(vm, thread, value, frame.method.ret === "J" || frame.method.ret === "D");
  } catch (error) {
    thread.jitDepth = 0;

    if (error instanceof Suspend) {
      frames.splice(index, 1, ...error.frames);

      return;
    }

    if (error instanceof Terminated) return;

    frame.lockedMonitor = undefined;
    frames.length = index;
    unwind(vm, thread, toJavaException(vm, error));
  }
};

const concatSlow = function* concatSlow(
  vm: JVM,
  site: CallSite,
  args: unknown[]
): Generator<Request, unknown, unknown> {
  const parts: unknown[] = [];

  for (const arg of args) {
    if (arg !== null && typeof arg === "object" && !Array.isArray(arg)) {
      parts.push(
        yield vm.invoke(
          vm.resolveVirtual(arg, "toString()Ljava/lang/String;"),
          [arg]
        )
      );
    } else {
      parts.push(arg);
    }
  }

  return site.format?.(parts, true);
};

export const execute = (vm: JVM, thread: JThread, deadline: number): void => {
  let budget = CHECK_INTERVAL;

  for (;;) {
    const { frames } = thread;

    if (frames.length === 0) {
      if (thread.state !== 5) vm.terminate(thread);

      return;
    }

    if (thread.blocked || vm.exitCode !== undefined) return;

    const frame = frames[frames.length - 1];

    if (TRACE) {
      console.error(
        `${" ".repeat(frames.length)}${frame.gen ? "*" : ""}${frame.method.toString()} pc=${frame.pc}`
      );
    }

    if (frame.gen) {
      stepGenerator(vm, thread, frame);
      continue;
    }

    const { method } = frame;

    if (method.compiled === undefined && vm.jitThreshold >= 0 && ++method.invocations > vm.jitThreshold) {
      compile(vm, method);
    }

    const { compiled } = method;

    if (
      compiled &&
      frame.resumePc < 0 &&
      frame.pc !== frame.bailPc &&
      compiled.blockStarts[frame.pc] === 1
    ) {
      vm.deadline = deadline;
      runCompiled(vm, thread, frame, compiled);

      if (--budget <= 0) {
        budget = CHECK_INTERVAL;

        if (performance.now() >= deadline) return;
      }

      continue;
    }

    const { cls } = method;
    const {code} = (method.code as { code: Uint8Array });
    const cp = (cls.cf as { constantPool: ConstantPoolEntry[] }).constantPool;
    const { locals, stack } = frame;
    let { pc, sp } = frame;

    try {
      instructions: for (;;) {
        const op = code[pc];

        switch (op) {
          case 0x00:
            pc++;
            break;
          case 0x01:
            stack[sp++] = null;
            pc++;
            break;
          case 0x02:
          case 0x03:
          case 0x04:
          case 0x05:
          case 0x06:
          case 0x07:
          case 0x08:
            stack[sp++] = op - 3;
            pc++;
            break;
          case 0x09:
          case 0x0a:
            stack[sp++] = BigInt(op - 9);
            stack[sp++] = undefined;
            pc++;
            break;
          case 0x0b:
          case 0x0c:
          case 0x0d:
            stack[sp++] = op - 11;
            pc++;
            break;
          case 0x0e:
          case 0x0f:
            stack[sp++] = op - 14;
            stack[sp++] = undefined;
            pc++;
            break;
          case 0x10:
            stack[sp++] = (code[pc + 1] << 24) >> 24;
            pc += 2;
            break;
          case 0x11:
            stack[sp++] = (((code[pc + 1] << 8) | code[pc + 2]) << 16) >> 16;
            pc += 3;
            break;
          case 0x12:
          case 0x13:
            stack[sp++] = resolveConstant(
              vm,
              thread,
              cls,
              cp[op === 0x12 ? code[pc + 1] : (code[pc + 1] << 8) | code[pc + 2]]
            );
            pc += op === 0x12 ? 2 : 3;
            break;
          case 0x14: {
            const entry = cp[(code[pc + 1] << 8) | code[pc + 2]];

            stack[sp++] = (entry as { value: unknown }).value;
            stack[sp++] = undefined;
            pc += 3;
            break;
          }
          case 0x15:
          case 0x17:
          case 0x19:
            stack[sp++] = locals[code[pc + 1]];
            pc += 2;
            break;
          case 0x16:
          case 0x18:
            stack[sp++] = locals[code[pc + 1]];
            stack[sp++] = undefined;
            pc += 2;
            break;
          case 0x1a:
          case 0x1b:
          case 0x1c:
          case 0x1d:
            stack[sp++] = locals[op - 0x1a];
            pc++;
            break;
          case 0x1e:
          case 0x1f:
          case 0x20:
          case 0x21:
            stack[sp++] = locals[op - 0x1e];
            stack[sp++] = undefined;
            pc++;
            break;
          case 0x22:
          case 0x23:
          case 0x24:
          case 0x25:
            stack[sp++] = locals[op - 0x22];
            pc++;
            break;
          case 0x26:
          case 0x27:
          case 0x28:
          case 0x29:
            stack[sp++] = locals[op - 0x26];
            stack[sp++] = undefined;
            pc++;
            break;
          case 0x2a:
          case 0x2b:
          case 0x2c:
          case 0x2d:
            stack[sp++] = locals[op - 0x2a];
            pc++;
            break;
          case 0x2e:
          case 0x30:
          case 0x32:
          case 0x33:
          case 0x34:
          case 0x35: {
            const index = stack[--sp] as number;
            const array = stack[sp - 1] as JArray | null;

            if (array === null) vm.throwNew("java/lang/NullPointerException");

            if (index >>> 0 >= array.length) arrayIndexError(vm, index, array.length);

            stack[sp - 1] = array[index];
            pc++;
            break;
          }
          case 0x2f:
          case 0x31: {
            const index = stack[sp - 1] as number;
            const array = stack[sp - 2] as JArray | null;

            if (array === null) vm.throwNew("java/lang/NullPointerException");

            if (index >>> 0 >= array.length) arrayIndexError(vm, index, array.length);

            stack[sp - 2] = array[index];
            stack[sp - 1] = undefined;
            pc++;
            break;
          }
          case 0x36:
          case 0x38:
          case 0x3a:
            locals[code[pc + 1]] = stack[--sp];
            pc += 2;
            break;
          case 0x37:
          case 0x39:
            sp -= 2;
            locals[code[pc + 1]] = stack[sp];
            pc += 2;
            break;
          case 0x3b:
          case 0x3c:
          case 0x3d:
          case 0x3e:
            locals[op - 0x3b] = stack[--sp];
            pc++;
            break;
          case 0x3f:
          case 0x40:
          case 0x41:
          case 0x42:
            sp -= 2;
            locals[op - 0x3f] = stack[sp];
            pc++;
            break;
          case 0x43:
          case 0x44:
          case 0x45:
          case 0x46:
            locals[op - 0x43] = stack[--sp];
            pc++;
            break;
          case 0x47:
          case 0x48:
          case 0x49:
          case 0x4a:
            sp -= 2;
            locals[op - 0x47] = stack[sp];
            pc++;
            break;
          case 0x4b:
          case 0x4c:
          case 0x4d:
          case 0x4e:
            locals[op - 0x4b] = stack[--sp];
            pc++;
            break;
          case 0x4f:
          case 0x51:
          case 0x54:
          case 0x55:
          case 0x56: {
            const value = stack[--sp];
            const index = stack[--sp] as number;
            const array = stack[--sp] as JArray | null;

            if (array === null) vm.throwNew("java/lang/NullPointerException");

            if (index >>> 0 >= array.length) arrayIndexError(vm, index, array.length);

            (array as unknown[])[index] = value;
            pc++;
            break;
          }
          case 0x50:
          case 0x52: {
            sp -= 2;

            const value = stack[sp];
            const index = stack[--sp] as number;
            const array = stack[--sp] as JArray | null;

            if (array === null) vm.throwNew("java/lang/NullPointerException");

            if (index >>> 0 >= array.length) arrayIndexError(vm, index, array.length);

            (array as unknown[])[index] = value;
            pc++;
            break;
          }
          case 0x53: {
            const value = stack[--sp];
            const index = stack[--sp] as number;
            const array = stack[--sp] as JArray | null;

            if (array === null) vm.throwNew("java/lang/NullPointerException");

            if (index >>> 0 >= array.length) arrayIndexError(vm, index, array.length);

            if (
              value !== null &&
              !vm.classOf(value).isSubclassOf(array.$cls.componentType as JClass)
            ) {
              vm.throwNew("java/lang/ArrayStoreException", describe(vm, value));
            }

            (array as unknown[])[index] = value;
            pc++;
            break;
          }
          case 0x57:
            sp--;
            pc++;
            break;
          case 0x58:
            sp -= 2;
            pc++;
            break;
          case 0x59:
            stack[sp] = stack[sp - 1];
            sp++;
            pc++;
            break;
          case 0x5a: {
            const a = stack[sp - 1];

            stack[sp - 1] = stack[sp - 2];
            stack[sp - 2] = a;
            stack[sp++] = a;
            pc++;
            break;
          }
          case 0x5b: {
            const a = stack[sp - 1];

            stack[sp - 1] = stack[sp - 2];
            stack[sp - 2] = stack[sp - 3];
            stack[sp - 3] = a;
            stack[sp++] = a;
            pc++;
            break;
          }
          case 0x5c:
            stack[sp] = stack[sp - 2];
            stack[sp + 1] = stack[sp - 1];
            sp += 2;
            pc++;
            break;
          case 0x5d: {
            const b = stack[sp - 1];
            const a = stack[sp - 2];
            const c = stack[sp - 3];

            stack[sp - 3] = a;
            stack[sp - 2] = b;
            stack[sp - 1] = c;
            stack[sp] = a;
            stack[sp + 1] = b;
            sp += 2;
            pc++;
            break;
          }
          case 0x5e: {
            const b = stack[sp - 1];
            const a = stack[sp - 2];
            const d = stack[sp - 3];
            const c = stack[sp - 4];

            stack[sp - 4] = a;
            stack[sp - 3] = b;
            stack[sp - 2] = c;
            stack[sp - 1] = d;
            stack[sp] = a;
            stack[sp + 1] = b;
            sp += 2;
            pc++;
            break;
          }
          case 0x5f: {
            const a = stack[sp - 1];

            stack[sp - 1] = stack[sp - 2];
            stack[sp - 2] = a;
            pc++;
            break;
          }
          case 0x60:
            sp--;
            stack[sp - 1] = ((stack[sp - 1] as number) + (stack[sp] as number)) | 0;
            pc++;
            break;
          case 0x61:
            sp -= 2;
            stack[sp - 2] = BigInt.asIntN(
              64,
              (stack[sp - 2] as bigint) + (stack[sp] as bigint)
            );
            pc++;
            break;
          case 0x62:
            sp--;
            stack[sp - 1] = Math.fround(
              (stack[sp - 1] as number) + (stack[sp] as number)
            );
            pc++;
            break;
          case 0x63:
            sp -= 2;
            stack[sp - 2] = (stack[sp - 2] as number) + (stack[sp] as number);
            pc++;
            break;
          case 0x64:
            sp--;
            stack[sp - 1] = ((stack[sp - 1] as number) - (stack[sp] as number)) | 0;
            pc++;
            break;
          case 0x65:
            sp -= 2;
            stack[sp - 2] = BigInt.asIntN(
              64,
              (stack[sp - 2] as bigint) - (stack[sp] as bigint)
            );
            pc++;
            break;
          case 0x66:
            sp--;
            stack[sp - 1] = Math.fround(
              (stack[sp - 1] as number) - (stack[sp] as number)
            );
            pc++;
            break;
          case 0x67:
            sp -= 2;
            stack[sp - 2] = (stack[sp - 2] as number) - (stack[sp] as number);
            pc++;
            break;
          case 0x68:
            sp--;
            stack[sp - 1] = Math.imul(stack[sp - 1] as number, stack[sp] as number);
            pc++;
            break;
          case 0x69:
            sp -= 2;
            stack[sp - 2] = BigInt.asIntN(
              64,
              (stack[sp - 2] as bigint) * (stack[sp] as bigint)
            );
            pc++;
            break;
          case 0x6a:
            sp--;
            stack[sp - 1] = Math.fround(
              (stack[sp - 1] as number) * (stack[sp] as number)
            );
            pc++;
            break;
          case 0x6b:
            sp -= 2;
            stack[sp - 2] = (stack[sp - 2] as number) * (stack[sp] as number);
            pc++;
            break;
          case 0x6c: {
            const b = stack[--sp] as number;

            if (b === 0) vm.throwNew("java/lang/ArithmeticException", "/ by zero");

            stack[sp - 1] = ((stack[sp - 1] as number) / b) | 0;
            pc++;
            break;
          }
          case 0x6d: {
            sp -= 2;

            const b = stack[sp] as bigint;

            if (b === 0n) vm.throwNew("java/lang/ArithmeticException", "/ by zero");

            stack[sp - 2] = BigInt.asIntN(64, (stack[sp - 2] as bigint) / b);
            pc++;
            break;
          }
          case 0x6e:
            sp--;
            stack[sp - 1] = Math.fround(
              (stack[sp - 1] as number) / (stack[sp] as number)
            );
            pc++;
            break;
          case 0x6f:
            sp -= 2;
            stack[sp - 2] = (stack[sp - 2] as number) / (stack[sp] as number);
            pc++;
            break;
          case 0x70: {
            const b = stack[--sp] as number;

            if (b === 0) vm.throwNew("java/lang/ArithmeticException", "/ by zero");

            stack[sp - 1] = ((stack[sp - 1] as number) % b) | 0;
            pc++;
            break;
          }
          case 0x71: {
            sp -= 2;

            const b = stack[sp] as bigint;

            if (b === 0n) vm.throwNew("java/lang/ArithmeticException", "/ by zero");

            stack[sp - 2] = (stack[sp - 2] as bigint) % b;
            pc++;
            break;
          }
          case 0x72:
            sp--;
            stack[sp - 1] = Math.fround(
              (stack[sp - 1] as number) % (stack[sp] as number)
            );
            pc++;
            break;
          case 0x73:
            sp -= 2;
            stack[sp - 2] = (stack[sp - 2] as number) % (stack[sp] as number);
            pc++;
            break;
          case 0x74:
            stack[sp - 1] = -(stack[sp - 1] as number) | 0;
            pc++;
            break;
          case 0x75:
            stack[sp - 2] = BigInt.asIntN(64, -(stack[sp - 2] as bigint));
            pc++;
            break;
          case 0x76:
            stack[sp - 1] = -(stack[sp - 1] as number);
            pc++;
            break;
          case 0x77:
            stack[sp - 2] = -(stack[sp - 2] as number);
            pc++;
            break;
          case 0x78:
            sp--;
            stack[sp - 1] = (stack[sp - 1] as number) << (stack[sp] as number);
            pc++;
            break;
          case 0x79: {
            const shift = stack[--sp] as number;

            stack[sp - 2] = BigInt.asIntN(
              64,
              (stack[sp - 2] as bigint) << BigInt(shift & 63)
            );
            pc++;
            break;
          }
          case 0x7a:
            sp--;
            stack[sp - 1] = (stack[sp - 1] as number) >> (stack[sp] as number);
            pc++;
            break;
          case 0x7b: {
            const shift = stack[--sp] as number;

            stack[sp - 2] = (stack[sp - 2] as bigint) >> BigInt(shift & 63);
            pc++;
            break;
          }
          case 0x7c:
            sp--;
            stack[sp - 1] =
              ((stack[sp - 1] as number) >>> (stack[sp] as number)) | 0;
            pc++;
            break;
          case 0x7d: {
            const shift = stack[--sp] as number;

            stack[sp - 2] = BigInt.asIntN(
              64,
              BigInt.asUintN(64, stack[sp - 2] as bigint) >> BigInt(shift & 63)
            );
            pc++;
            break;
          }
          case 0x7e:
            sp--;
            stack[sp - 1] = (stack[sp - 1] as number) & (stack[sp] as number);
            pc++;
            break;
          case 0x7f:
            sp -= 2;
            stack[sp - 2] = (stack[sp - 2] as bigint) & (stack[sp] as bigint);
            pc++;
            break;
          case 0x80:
            sp--;
            stack[sp - 1] = (stack[sp - 1] as number) | (stack[sp] as number);
            pc++;
            break;
          case 0x81:
            sp -= 2;
            stack[sp - 2] = (stack[sp - 2] as bigint) | (stack[sp] as bigint);
            pc++;
            break;
          case 0x82:
            sp--;
            stack[sp - 1] = (stack[sp - 1] as number) ^ (stack[sp] as number);
            pc++;
            break;
          case 0x83:
            sp -= 2;
            stack[sp - 2] = (stack[sp - 2] as bigint) ^ (stack[sp] as bigint);
            pc++;
            break;
          case 0x84: {
            const index = code[pc + 1];

            locals[index] = ((locals[index] as number) + ((code[pc + 2] << 24) >> 24)) | 0;
            pc += 3;
            break;
          }
          case 0x85:
            stack[sp - 1] = BigInt(stack[sp - 1] as number);
            stack[sp++] = undefined;
            pc++;
            break;
          case 0x86:
            stack[sp - 1] = Math.fround(stack[sp - 1] as number);
            pc++;
            break;
          case 0x87:
            stack[sp++] = undefined;
            pc++;
            break;
          case 0x88:
            sp--;
            stack[sp - 1] = Number(BigInt.asIntN(32, stack[sp - 1] as bigint));
            pc++;
            break;
          case 0x89:
            sp--;
            stack[sp - 1] = Math.fround(Number(stack[sp - 1]));
            pc++;
            break;
          case 0x8a:
            stack[sp - 2] = Number(stack[sp - 2]);
            pc++;
            break;
          case 0x8b:
            stack[sp - 1] = d2i(stack[sp - 1] as number);
            pc++;
            break;
          case 0x8c:
            stack[sp - 1] = d2l(stack[sp - 1] as number);
            stack[sp++] = undefined;
            pc++;
            break;
          case 0x8d:
            stack[sp++] = undefined;
            pc++;
            break;
          case 0x8e:
            sp--;
            stack[sp - 1] = d2i(stack[sp - 1] as number);
            pc++;
            break;
          case 0x8f:
            stack[sp - 2] = d2l(stack[sp - 2] as number);
            pc++;
            break;
          case 0x90:
            sp--;
            stack[sp - 1] = Math.fround(stack[sp - 1] as number);
            pc++;
            break;
          case 0x91:
            stack[sp - 1] = ((stack[sp - 1] as number) << 24) >> 24;
            pc++;
            break;
          case 0x92:
            stack[sp - 1] = (stack[sp - 1] as number) & 0xffff;
            pc++;
            break;
          case 0x93:
            stack[sp - 1] = ((stack[sp - 1] as number) << 16) >> 16;
            pc++;
            break;
          case 0x94: {
            sp -= 4;

            const a = stack[sp] as bigint;
            const b = stack[sp + 2] as bigint;

            stack[sp++] = a < b ? -1 : a > b ? 1 : 0;
            pc++;
            break;
          }
          case 0x95:
          case 0x96: {
            const b = stack[--sp] as number;
            const a = stack[sp - 1] as number;

            stack[sp - 1] =
              a > b ? 1 : a < b ? -1 : a === b ? 0 : op === 0x95 ? -1 : 1;
            pc++;
            break;
          }
          case 0x97:
          case 0x98: {
            sp -= 4;

            const a = stack[sp] as number;
            const b = stack[sp + 2] as number;

            stack[sp++] =
              a > b ? 1 : a < b ? -1 : a === b ? 0 : op === 0x97 ? -1 : 1;
            pc++;
            break;
          }
          case 0x99:
          case 0x9a:
          case 0x9b:
          case 0x9c:
          case 0x9d:
          case 0x9e: {
            const value = stack[--sp] as number;
            const taken =
              op === 0x99
                ? value === 0
                : op === 0x9a
                  ? value !== 0
                  : op === 0x9b
                    ? value < 0
                    : op === 0x9c
                      ? value >= 0
                      : op === 0x9d
                        ? value > 0
                        : value <= 0;

            if (taken) {
              const offset = (((code[pc + 1] << 8) | code[pc + 2]) << 16) >> 16;

              pc += offset;

              if (offset <= 0 && --budget <= 0) {
                budget = CHECK_INTERVAL;
                frame.pc = pc;
                frame.sp = sp;
                if (performance.now() >= deadline) return;
                if (method.compiled === undefined && vm.jitThreshold >= 0) {
                  method.invocations = vm.jitThreshold;
                  break instructions;
                }
              }
            } else {
              pc += 3;
            }

            break;
          }
          case 0x9f:
          case 0xa0:
          case 0xa1:
          case 0xa2:
          case 0xa3:
          case 0xa4:
          case 0xa5:
          case 0xa6: {
            const b = stack[--sp];
            const a = stack[--sp];
            const taken =
              op === 0x9f || op === 0xa5
                ? a === b
                : op === 0xa0 || op === 0xa6
                  ? a !== b
                  : op === 0xa1
                    ? (a as number) < (b as number)
                    : op === 0xa2
                      ? (a as number) >= (b as number)
                      : op === 0xa3
                        ? (a as number) > (b as number)
                        : (a as number) <= (b as number);

            if (taken) {
              const offset = (((code[pc + 1] << 8) | code[pc + 2]) << 16) >> 16;

              pc += offset;

              if (offset <= 0 && --budget <= 0) {
                budget = CHECK_INTERVAL;
                frame.pc = pc;
                frame.sp = sp;
                if (performance.now() >= deadline) return;
                if (method.compiled === undefined && vm.jitThreshold >= 0) {
                  method.invocations = vm.jitThreshold;
                  break instructions;
                }
              }
            } else {
              pc += 3;
            }

            break;
          }
          case 0xa7:
          case 0xc8: {
            const offset =
              op === 0xa7
                ? (((code[pc + 1] << 8) | code[pc + 2]) << 16) >> 16
                : (code[pc + 1] << 24) |
                  (code[pc + 2] << 16) |
                  (code[pc + 3] << 8) |
                  code[pc + 4];

            pc += offset;

            if (offset <= 0 && --budget <= 0) {
              budget = CHECK_INTERVAL;
              frame.pc = pc;
              frame.sp = sp;

              if (performance.now() >= deadline) return;

              if (method.compiled === undefined && vm.jitThreshold >= 0) {
                method.invocations = vm.jitThreshold;
                break instructions;
              }
            }

            break;
          }
          case 0xa8:
          case 0xc9: {
            const offset =
              op === 0xa8
                ? (((code[pc + 1] << 8) | code[pc + 2]) << 16) >> 16
                : (code[pc + 1] << 24) |
                  (code[pc + 2] << 16) |
                  (code[pc + 3] << 8) |
                  code[pc + 4];

            stack[sp++] = pc + (op === 0xa8 ? 3 : 5);
            pc += offset;
            break;
          }
          case 0xa9:
            pc = locals[code[pc + 1]] as number;
            break;
          case 0xaa: {
            const base = (pc + 4) & ~3;
            const read = (at: number): number =>
              (code[at] << 24) |
              (code[at + 1] << 16) |
              (code[at + 2] << 8) |
              code[at + 3];
            const key = stack[--sp] as number;
            const low = read(base + 4);
            const high = read(base + 8);

            pc +=
              key < low || key > high
                ? read(base)
                : read(base + 12 + (key - low) * 4);
            break;
          }
          case 0xab: {
            const base = (pc + 4) & ~3;
            const read = (at: number): number =>
              (code[at] << 24) |
              (code[at + 1] << 16) |
              (code[at + 2] << 8) |
              code[at + 3];
            const key = stack[--sp] as number;
            const pairs = read(base + 4);
            let offset = read(base);
            let lo = 0;
            let hi = pairs - 1;

            while (lo <= hi) {
              const mid = (lo + hi) >> 1;
              const match = read(base + 8 + mid * 8);

              if (match === key) {
                offset = read(base + 12 + mid * 8);
                break;
              }

              if (match < key) lo = mid + 1;
              else hi = mid - 1;
            }

            pc += offset;
            break;
          }
          case 0xac:
          case 0xae:
          case 0xb0:
            returnToCaller(vm, thread, stack[sp - 1], false);
            break;
          case 0xad:
          case 0xaf:
            returnToCaller(vm, thread, stack[sp - 2], true);
            break;
          case 0xb1:
            returnToCaller(vm, thread, undefined, false);
            break;
          case 0xb2:
          case 0xb3: {
            const field = resolveField(
              vm,
              cls,
              (cp[(code[pc + 1] << 8) | code[pc + 2]] as { value: MemberRef }).value
            );
            const owner = field.cls;

            if (owner.state !== INITIALIZED && owner.initThread !== thread) {
              frame.pc = pc;
              frame.sp = sp;
              frame.resumePc = pc;
              pushInitialization(vm, thread, owner);
              break;
            }

            const wide = field.descriptor === "J" || field.descriptor === "D";

            if (op === 0xb2) {
              stack[sp++] = owner.statics[field.key];

              if (wide) stack[sp++] = undefined;
            } else {
              if (wide) sp--;

              owner.statics[field.key] = stack[--sp];
            }

            pc += 3;
            break;
          }
          case 0xb4: {
            const field = resolveField(
              vm,
              cls,
              (cp[(code[pc + 1] << 8) | code[pc + 2]] as { value: MemberRef }).value
            );
            const target = stack[sp - 1] as JObject | null;

            if (target === null) {
              vm.throwNew(
                "java/lang/NullPointerException",
                `Cannot read field "${field.name}" because value is null`
              );
            }

            stack[sp - 1] = target[field.key];

            if (field.descriptor === "J" || field.descriptor === "D") {
              stack[sp++] = undefined;
            }

            pc += 3;
            break;
          }
          case 0xb5: {
            const field = resolveField(
              vm,
              cls,
              (cp[(code[pc + 1] << 8) | code[pc + 2]] as { value: MemberRef }).value
            );

            if (field.descriptor === "J" || field.descriptor === "D") sp--;

            const value = stack[--sp];
            const target = stack[--sp] as JObject | null;

            if (target === null) {
              vm.throwNew(
                "java/lang/NullPointerException",
                `Cannot assign field "${field.name}" because value is null`
              );
            }

            target[field.key] = value;
            pc += 3;
            break;
          }
          case 0xb6:
          case 0xb7:
          case 0xb8:
          case 0xb9: {
            const ref = (cp[(code[pc + 1] << 8) | code[pc + 2]] as { value: MemberRef }).value;
            const resolved = resolveMethod(vm, cls, ref);
            let target = resolved;
            const base = sp - resolved.argSlots;

            if (op === 0xb8) {
              if (resolved.cls.state !== INITIALIZED && resolved.cls.initThread !== thread) {
                frame.pc = pc;
                frame.sp = sp;
                frame.resumePc = pc;
                pushInitialization(vm, thread, resolved.cls);
                break;
              }
            } else {
              const receiver = stack[base];

              if (receiver === null || receiver === undefined) {
                vm.throwNew(
                  "java/lang/NullPointerException",
                  `Cannot invoke "${resolved.cls.name.replaceAll("/", ".")}.${resolved.name}()" because value is null`
                );
              }

              if (op === 0xb7) {
                if (
                  resolved.name !== "<init>" &&
                  !resolved.isPrivate &&
                  !resolved.cls.isInterface &&
                  resolved.cls !== cls &&
                  cls.superClass
                ) {
                  target = cls.superClass.vtable.get(resolved.key) ?? resolved;
                }
              } else if (!resolved.isPrivate) {
                const dynamic = (
                  typeof receiver === "string" ? vm.stringClass : (receiver as JObject).$cls
                ).vtable.get(resolved.key);

                if (dynamic) {
                  target = dynamic;
                } else if (resolved.isStatic || resolved.isAbstract) {
                  if (resolved.cls.name === "java/lang/invoke/MethodHandle" || resolved.cls.name === "java/lang/invoke/VarHandle") {
                    target = resolved;
                  } else {
                    vm.throwNew("java/lang/AbstractMethodError", resolved.toString());
                  }
                }
              }
            }

            const length = op === 0xb9 ? 5 : 3;

            if (target.native === undefined) target.native = vm.lookupNative(target);

            const { native } = target;

            if (native) {
              const args = collectArgs(target, stack, base);

              sp = base;

              if (native.generator) {
                frame.pc = pc;
                frame.sp = sp;
                frame.resumePc = pc + length;
                pushGenerator(
                  vm,
                  thread,
                  target,
                  (native.fn as (t: JThread, a: unknown[]) => Generator<Request, unknown, unknown>)(thread, args)
                );
                break;
              }

              frame.pc = pc;
              frame.sp = sp;

              const result = native.fn(thread, args);

              if (op === 0xb7 && target.name === "<init>" && target.cls === vm.stringClass) {
                const placeholder = args[0];

                for (let i = 0; i < sp; i++) {
                  if (stack[i] === placeholder) stack[i] = result;
                }

                for (let i = 0; i < locals.length; i++) {
                  if (locals[i] === placeholder) locals[i] = result;
                }
              } else if (target.ret !== "V") {
                stack[sp++] = result;

                if (target.ret === "J" || target.ret === "D") stack[sp++] = undefined;
              }

              pc += length;

              if (thread.blocked || thread.frames[thread.frames.length - 1] !== frame) {
                frame.pc = pc;
                frame.sp = sp;
                break;
              }

              continue;
            }

            if (!target.code) {
              vm.throwNew(
                target.isAbstract
                  ? "java/lang/AbstractMethodError"
                  : "java/lang/UnsatisfiedLinkError",
                target.toString()
              );
            }

            if (frames.length >= MAX_FRAMES) {
              vm.throwNew("java/lang/StackOverflowError");
            }

            const callee = new Frame(
              target,
              (target.code as { maxLocals: number }).maxLocals,
              (target.code as { maxStack: number }).maxStack
            );
            const calleeLocals = callee.locals;

            for (let i = 0, slot = base; slot < sp; i++, slot++) {
              calleeLocals[i] = stack[slot];
            }

            sp = base;
            frame.pc = pc;
            frame.sp = sp;
            frame.resumePc = pc + length;

            if (target.isSynchronized) {
              const lock = (target.isStatic ? target.cls : calleeLocals[0]) as Lockable;

              callee.lockedMonitor = lock;
              frames.push(callee);

              if (!tryEnter(thread, lock)) {
                callee.lockedMonitor = undefined;
                callee.pendingLock = lock;
                pushGenerator(vm, thread, pseudoMethod(vm, "<monitorenter>"), enter(vm, thread, lock));
              }
            } else {
              frames.push(callee);
            }

            if (--budget <= 0) {
              budget = CHECK_INTERVAL;

              if (performance.now() >= deadline) return;
            }

            break;
          }
          case 0xba: {
            const index = (code[pc + 1] << 8) | code[pc + 2];
            const site = bootstrapIndy(vm, thread, cls, index);
            const args: unknown[] = [];

            for (let i = site.argTypes.length - 1; i >= 0; i--) {
              const type = site.argTypes[i];

              if (type === "J" || type === "D") {
                sp -= 2;
                args.unshift(stack[sp]);
              } else {
                args.unshift(stack[--sp]);
              }
            }

            if (site.format) {
              const fast = site.format(args, false);

              if (fast === null) {
                frame.pc = pc;
                frame.sp = sp;
                frame.resumePc = pc + 5;
                pushGenerator(
                  vm,
                  thread,
                  pseudoMethod(vm, "<concat>", "Ljava/lang/String;"),
                  concatSlow(vm, site, args)
                );
                break;
              }

              stack[sp++] = fast;
            } else {
              stack[sp++] = site.create?.(args);
            }

            pc += 5;
            continue;
          }
          case 0xbb: {
            const target = resolveClass(vm, cls, cp[(code[pc + 1] << 8) | code[pc + 2]]);

            if (target.state !== INITIALIZED && target.initThread !== thread) {
              frame.pc = pc;
              frame.sp = sp;
              frame.resumePc = pc;
              pushInitialization(vm, thread, target);
              break;
            }

            if (target.isInterface || (target.access & 0x400) !== 0) {
              vm.throwNew("java/lang/InstantiationError", target.name);
            }

            const { ctor: Instance } = target;

            stack[sp++] =
              target === vm.stringClass ? { $cls: target } : new Instance();
            pc += 3;
            continue;
          }
          case 0xbc:
            frame.pc = pc;
            stack[sp - 1] = vm.newArray(
              NEWARRAY_TYPES[code[pc + 1]],
              stack[sp - 1] as number
            );
            pc += 2;
            break;
          case 0xbd: {
            const component = resolveClass(vm, cls, cp[(code[pc + 1] << 8) | code[pc + 2]]);

            frame.pc = pc;
            stack[sp - 1] = vm.newArrayOf(component, stack[sp - 1] as number);
            pc += 3;
            break;
          }
          case 0xbe: {
            const array = stack[sp - 1] as JArray | null;

            if (array === null) vm.throwNew("java/lang/NullPointerException");

            stack[sp - 1] = array.length;
            pc++;
            break;
          }
          case 0xbf: {
            const exception = stack[sp - 1] as JObject | null;

            if (exception === null) vm.throwNew("java/lang/NullPointerException");

            throw new JavaThrow(exception);
          }
          case 0xc0: {
            const value = stack[sp - 1];

            if (value !== null) {
              const target = resolveClass(vm, cls, cp[(code[pc + 1] << 8) | code[pc + 2]]);

              if (!vm.classOf(value).isSubclassOf(target)) castError(vm, value, target);
            }

            pc += 3;
            break;
          }
          case 0xc1: {
            const value = stack[sp - 1];

            stack[sp - 1] =
              value === null
                ? 0
                : vm.classOf(value).isSubclassOf(
                      resolveClass(vm, cls, cp[(code[pc + 1] << 8) | code[pc + 2]])
                    )
                  ? 1
                  : 0;
            pc += 3;
            break;
          }
          case 0xc2: {
            const target = stack[--sp] as Lockable | null;

            if (target === null) vm.throwNew("java/lang/NullPointerException");

            pc++;

            if (!tryEnter(thread, target)) {
              frame.pc = pc;
              frame.sp = sp;
              frame.resumePc = pc;
              pushGenerator(vm, thread, pseudoMethod(vm, "<monitorenter>"), enter(vm, thread, target));
              break;
            }

            continue;
          }
          case 0xc3: {
            const target = stack[--sp] as Lockable | null;

            if (target === null) vm.throwNew("java/lang/NullPointerException");

            exit(vm, thread, target);
            pc++;
            continue;
          }
          case 0xc4: {
            const sub = code[pc + 1];
            const index = (code[pc + 2] << 8) | code[pc + 3];

            switch (sub) {
              case 0x15:
              case 0x17:
              case 0x19:
                stack[sp++] = locals[index];
                break;
              case 0x16:
              case 0x18:
                stack[sp++] = locals[index];
                stack[sp++] = undefined;
                break;
              case 0x36:
              case 0x38:
              case 0x3a:
                locals[index] = stack[--sp];
                break;
              case 0x37:
              case 0x39:
                sp -= 2;
                locals[index] = stack[sp];
                break;
              case 0x84:
                locals[index] =
                  ((locals[index] as number) +
                    ((((code[pc + 4] << 8) | code[pc + 5]) << 16) >> 16)) |
                  0;
                pc += 2;
                break;
              case 0xa9:
                pc = (locals[index] as number) - 4;
                break;
              default:
                throw new InternalError(`Bad wide opcode ${sub}`);
            }

            pc += 4;
            break;
          }
          case 0xc5: {
            const target = resolveClass(vm, cls, cp[(code[pc + 1] << 8) | code[pc + 2]]);
            const dimensions = code[pc + 3];
            const counts: number[] = [];

            for (let i = 0; i < dimensions; i++) counts.unshift(stack[--sp] as number);

            for (const count of counts) {
              if (count < 0) vm.throwNew("java/lang/NegativeArraySizeException", String(count));
            }

            frame.pc = pc;
            stack[sp++] = newMultiArray(vm, target, counts, 0);
            pc += 4;
            break;
          }
          case 0xc6:
          case 0xc7: {
            const value = stack[--sp];

            if ((value === null) === (op === 0xc6)) {
              const offset = (((code[pc + 1] << 8) | code[pc + 2]) << 16) >> 16;

              pc += offset;

              if (offset <= 0 && --budget <= 0) {
                budget = CHECK_INTERVAL;
                frame.pc = pc;
                frame.sp = sp;
                if (performance.now() >= deadline) return;
                if (method.compiled === undefined && vm.jitThreshold >= 0) {
                  method.invocations = vm.jitThreshold;
                  break instructions;
                }
              }
            } else {
              pc += 3;
            }

            break;
          }
          default:
            throw new InternalError(`Unknown opcode 0x${op.toString(16)} at ${method.toString()}:${pc}`);
        }

        if (op >= 0xac && op <= 0xb1) break;

        if (
          (op === 0xb2 ||
            op === 0xb3 ||
            op === 0xb6 ||
            op === 0xb7 ||
            op === 0xb8 ||
            op === 0xb9 ||
            op === 0xba ||
            op === 0xbb ||
            op === 0xc2) &&
          (frames[frames.length - 1] !== frame || thread.blocked)
        ) {
          break;
        }
      }
    } catch (error) {
      frame.pc = pc;
      frame.sp = sp;

      const exception = toJavaException(vm, error);

      if (thread.frames[thread.frames.length - 1] !== frame) {
        while (thread.frames.length > 0 && thread.frames[thread.frames.length - 1] !== frame) {
          thread.frames.pop();
        }
      }

      unwind(vm, thread, exception);
    }
  }
};
