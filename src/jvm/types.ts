/* eslint-disable max-classes-per-file */
import {
  ACC_ABSTRACT,
  ACC_INTERFACE,
  ACC_NATIVE,
  ACC_PRIVATE,
  ACC_STATIC,
  ACC_SYNCHRONIZED,
  type ClassFile,
  type CodeAttribute,
  type FieldInfo,
  type MethodInfo,
} from "./classfile.ts";
import { parseMethodDescriptor } from "./descriptors.ts";

export type Monitor = {
  count: number;
  entrants: (() => void)[];
  owner: JThread | undefined;
  waiters: Set<() => void>;
};

export type JObject = {
  [field: string]: unknown;
  $cls: JClass;
  $hash?: number;
  $mon?: Monitor;
};

export type JArray = (
  | BigInt64Array
  | Float32Array
  | Float64Array
  | Int16Array
  | Int32Array
  | Int8Array
  | Uint16Array
  | unknown[]
) & { $cls: JClass; $hash?: number; $mon?: Monitor };

export type JValue = bigint | JArray | JClass | JObject | null | number | string;

export const LOADED = 0;
export const LINKED = 1;
export const INITIALIZING = 2;
export const INITIALIZED = 3;
export const ERRONEOUS = 4;

export type NativeFunction = (thread: JThread, args: unknown[]) => unknown;

export type NativeGenerator = (
  thread: JThread,
  args: unknown[]
) => Generator<Request, unknown, unknown>;

export type InvokeRequest = {
  args: unknown[];
  kind: "invoke";
  method: JMethod;
};

export type WaitRequest = {
  kind: "wait";
  promise: PromiseLike<unknown>;
};

export type Request = InvokeRequest | WaitRequest;

export type Native = {
  fn: NativeFunction | NativeGenerator;
  generator: boolean;
};

export class JField {
  public readonly access: number;

  public readonly cls: JClass;

  public readonly descriptor: string;

  public readonly info: FieldInfo;

  public key: string;

  public readonly name: string;

  public slot = -1;

  public constructor(cls: JClass, info: FieldInfo) {
    this.cls = cls;
    this.info = info;
    this.access = info.access;
    this.name = info.name;
    this.descriptor = info.descriptor;
    this.key = `_${info.name}`;
  }

  public get isStatic(): boolean {
    return (this.access & ACC_STATIC) !== 0;
  }
}

export type ResolvedHandler = {
  catchClass: JClass | null | undefined;
  catchType: string | undefined;
  endPc: number;
  handlerPc: number;
  startPc: number;
};

export class JMethod {
  public readonly access: number;

  public readonly args: string[];

  public readonly argSlots: number;

  public readonly cls: JClass;

  public readonly code: CodeAttribute | undefined;

  public compiled: (((thread: JThread, frame: Frame | null, ...args: unknown[]) => unknown) & { blockStarts: Uint8Array }) | null | undefined;

  public readonly descriptor: string;

  public entry: ((thread: JThread, frame: Frame | null, ...args: unknown[]) => unknown) | undefined;

  public handlers: ResolvedHandler[];

  public readonly info: MethodInfo;

  public invocations = 0;

  public readonly key: string;

  public readonly name: string;

  public native: Native | null | undefined;

  public readonly ret: string;

  public constructor(cls: JClass, info: MethodInfo) {
    this.cls = cls;
    this.info = info;
    this.access = info.access;
    this.name = info.name;
    this.descriptor = info.descriptor;
    this.key = info.name + info.descriptor;
    this.code = info.code;

    const type = parseMethodDescriptor(info.descriptor);

    this.args = type.args;
    this.ret = type.ret;
    this.argSlots = type.argSlots + (this.isStatic ? 0 : 1);
    this.handlers = (info.code?.exceptionTable ?? []).map((handler) => ({
      ...handler,
      catchClass: handler.catchType ? undefined : null,
    }));
  }

  public get isAbstract(): boolean {
    return (this.access & ACC_ABSTRACT) !== 0;
  }

  public get isNative(): boolean {
    return (this.access & ACC_NATIVE) !== 0;
  }

  public get isPrivate(): boolean {
    return (this.access & ACC_PRIVATE) !== 0;
  }

  public get isStatic(): boolean {
    return (this.access & ACC_STATIC) !== 0;
  }

  public get isSynchronized(): boolean {
    return (this.access & ACC_SYNCHRONIZED) !== 0;
  }

  public lineNumber(pc: number): number {
    const lines = this.code?.lineNumbers;
    let line = -1;

    if (!lines) return line;

    let best = -1;

    for (let i = 0; i < lines.length; i += 2) {
      if (lines[i] <= pc && lines[i] > best) {
        best = lines[i];
        line = lines[i + 1];
      }
    }

    return line;
  }

  public toString(): string {
    return `${this.cls.name}.${this.key}`;
  }
}

export type ClassSource = {
  loader: JObject | null;
  path?: string;
};

export class JClass {
  [field: string]: unknown;

  public $cls!: JClass;

  public $hash?: number;

  public $mon?: Monitor;

  public access: number;

  public arrayClass: JClass | undefined;

  public readonly cf: ClassFile | undefined;

  public componentType: JClass | undefined;

  public ctor!: new () => JObject;

  public declaredFields: JField[] = [];

  public declaredMethods: JMethod[] = [];

  public dimensions = 0;

  public initError: unknown;

  public initThread: JThread | undefined;

  public initWaiters: (() => void)[] = [];

  public instanceFields: JField[] = [];

  public interfaces: JClass[] = [];

  public readonly isArray: boolean;

  public readonly isPrimitive: boolean;

  public readonly loader: JObject | null;

  public methodMap = new Map<string, JMethod>();

  public readonly name: string;

  public readonly source: ClassSource;

  public state = LOADED;

  public statics: Record<string, unknown> = {};

  public superClass: JClass | null = null;

  public readonly supers = new Set<JClass>();

  public vtable = new Map<string, JMethod>();

  public constructor(
    name: string,
    cf: ClassFile | undefined,
    source: ClassSource,
    kind: "array" | "class" | "primitive" = "class"
  ) {
    this.name = name;
    this.cf = cf;
    this.source = source;
    this.loader = source.loader;
    this.access = cf?.access ?? 0x411;
    this.isArray = kind === "array";
    this.isPrimitive = kind === "primitive";
  }

  public get isInterface(): boolean {
    return (this.access & ACC_INTERFACE) !== 0;
  }

  public field(name: string): JField | undefined {
    const field = this.declaredFields.find((f) => f.name === name);

    if (field) return field;

    for (const iface of this.interfaces) {
      const found = iface.field(name);

      if (found) return found;
    }

    return this.superClass?.field(name);
  }

  public isSubclassOf(other: JClass): boolean {
    return this === other || this.supers.has(other);
  }

  public method(key: string): JMethod | undefined {
    const own = this.classMethod(key);

    if (own) return own;

    const queue = [...this.supers].filter((cls) => cls.isInterface);

    for (const iface of queue) {
      const method = iface.methodMap.get(key);

      if (method && !method.isAbstract && !method.isStatic) return method;
    }

    for (const iface of queue) {
      const method = iface.methodMap.get(key);

      if (method && !method.isStatic) return method;
    }

    return undefined;
  }

  public toString(): string {
    return this.name;
  }

  private classMethod(key: string): JMethod | undefined {
    return this.methodMap.get(key) ?? this.superClass?.classMethod(key);
  }
}

export class Frame {
  // The pc where compiled code handed this frame back to the interpreter to
  // run one instruction; the interpreter must get past it first.
  public bailPc = -1;

  public gen: Generator<Request, unknown, unknown> | undefined;

  public genValue: unknown;

  public locals: unknown[];

  public lockedMonitor: JArray | JClass | JObject | string | undefined;

  public readonly method: JMethod;

  public pc = 0;

  public pendingLock: JArray | JClass | JObject | string | undefined;

  public resumePc = -1;

  public sp = 0;

  public stack: unknown[];

  public constructor(method: JMethod, maxLocals: number, maxStack: number) {
    this.method = method;
    this.locals = new Array<unknown>(maxLocals);
    this.stack = new Array<unknown>(maxStack);
  }
}

export const NEW = 0;
export const RUNNABLE = 1;
export const BLOCKED = 2;
export const WAITING = 3;
export const TIMED_WAITING = 4;
export const TERMINATED = 5;

export class JThread {
  public blocked = false;

  public daemon = false;

  public readonly frames: Frame[] = [];

  public readonly id: number;

  public interrupted = false;

  public interruptWaiter: (() => void) | undefined;

  public java: JObject | null = null;

  public jitDepth = 0;

  public readonly jitMethods: JMethod[] = [];

  public readonly jitPcs = new Int32Array(1024);

  public name: string;

  public parkPermit = false;

  public parkWaiter: (() => void) | undefined;

  public pendingException: JObject | undefined;

  public resumeError: unknown;

  public resumeValue: unknown;

  public state = NEW;

  public terminationWaiters: (() => void)[] = [];

  public constructor(id: number, name: string) {
    this.id = id;
    this.name = name;
  }
}

export class JavaThrow {
  public readonly exception: JObject;

  public constructor(exception: JObject) {
    this.exception = exception;
  }
}

export class InternalError extends Error {
  public override name = "InternalError";
}
