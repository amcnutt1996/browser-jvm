import { type MethodHandleRef } from "./classfile.ts";
import { parseMethodDescriptor } from "./descriptors.ts";
import { initialize } from "./initialize.ts";
import {
  INITIALIZED,
  JClass,
  JMethod,
  type JObject,
  type JThread,
  type Request,
} from "./types.ts";
import { type JVM } from "./vm.ts";

const BOX_CLASSES: Record<string, string> = {
  B: "java/lang/Byte",
  C: "java/lang/Character",
  D: "java/lang/Double",
  F: "java/lang/Float",
  I: "java/lang/Integer",
  J: "java/lang/Long",
  S: "java/lang/Short",
  Z: "java/lang/Boolean",
};

const isPrimitive = (type: string): boolean =>
  type.length === 1 && type !== "V";

export const box = function* box(
  vm: JVM,
  type: string,
  value: unknown
): Generator<Request, unknown, unknown> {
  const className = BOX_CLASSES[type];

  if (!className) return value;

  const method = vm
    .loadClass(className)
    .methodMap.get(`valueOf(${type})L${className};`) as JMethod;

  return yield vm.invoke(method, [value]);
}

export const unbox = (value: unknown, type: string): unknown => {
  if (value === null || typeof value !== "object") return value;

  const raw = (value as JObject)._value;

  if (type === "J") return typeof raw === "bigint" ? raw : BigInt(raw as number);

  if (typeof raw === "bigint") return Number(raw);

  return raw;
};

const widen = (value: unknown, from: string, to: string): unknown => {
  if (from === to) return value;

  if (to === "J") return BigInt(value as number);

  if ((to === "F" || to === "D") && from === "J") return Number(value);

  return value;
};

export const createLambdaFactory = (
  vm: JVM,
  _thread: JThread,
  name: string,
  host: JClass,
  iface: JClass,
  samName: string,
  samDescriptor: string,
  impl: MethodHandleRef,
  capturedCount: number,
  markers: JClass[] = [],
  bridges: string[] = []
): ((args: unknown[]) => unknown) => {
  const cls = new JClass(name, undefined, { loader: host.loader });

  cls.access = 0x1011;
  cls.superClass = vm.objectClass;
  cls.interfaces = [iface, ...markers];
  cls.supers.add(vm.objectClass);

  for (const implemented of cls.interfaces) {
    cls.supers.add(implemented);

    for (const sup of implemented.supers) cls.supers.add(sup);
  }

  // eslint-disable-next-line unicorn/consistent-function-scoping
  const LambdaObject = function LambdaObject(): void {
    // instances only carry captured arguments
  } as unknown as new () => JObject;

  (LambdaObject.prototype as JObject).$cls = cls;
  cls.ctor = LambdaObject;
  vm.mirror(cls);

  const samType = parseMethodDescriptor(samDescriptor);
  const implType = parseMethodDescriptor(impl.ref.descriptor);
  const { kind } = impl;
  const instanceKind = kind === 5 || kind === 7 || kind === 9;
  const paramTypes = instanceKind
    ? [`L${impl.ref.className};`, ...implType.args]
    : implType.args;
  const implRet = kind === 8 ? `L${impl.ref.className};` : implType.ret;
  const key = impl.ref.name + impl.ref.descriptor;
  let resolved: JMethod | undefined;

  const sam = new JMethod(cls, {
    access: 0x0001,
    descriptor: samDescriptor,
    exceptions: [],
    name: samName,
  });

  const invokeLambda = function* invokeLambda(
    thread: JThread,
    args: unknown[]
  ): Generator<Request, unknown, unknown> {
    const self = args[0] as JObject;
    const params = [...(self.$captured as unknown[]), ...args.slice(1)];

    for (let i = 0; i < params.length; i++) {
      const want = paramTypes[i];
      const value = params[i];

      if (isPrimitive(want)) {
        params[i] =
          value !== null && typeof value === "object"
            ? unbox(value, want)
            : widen(value, samType.args[i - capturedCount] ?? want, want);
      } else if (
        (typeof value === "number" || typeof value === "bigint") &&
        i >= capturedCount
      ) {
        params[i] = yield* box(vm, samType.args[i - capturedCount], value);
      }
    }

    if (!resolved) {
      const owner = vm.loadClass(impl.ref.className, host.loader);

      resolved = owner.method(key) ?? vm.objectClass.method(key);

      if (!resolved) {
        vm.throwNew("java/lang/NoSuchMethodError", `${owner.name}.${key}`);
      }
    }

    let result: unknown;

    if (kind === 8) {
      const owner = resolved.cls;

      if (owner.state !== INITIALIZED) yield* initialize(vm, thread, owner);

      const { ctor: Owner } = owner;
      const object = owner === vm.stringClass ? { $cls: owner } : new Owner();
      const value = yield vm.invoke(resolved, [object, ...params]);

      result = owner === vm.stringClass ? value : object;
    } else if ((kind === 5 || kind === 9) && !resolved.isPrivate) {
      if (params[0] === null) vm.throwNew("java/lang/NullPointerException");

      result = yield vm.invoke(vm.resolveVirtual(params[0], key), params);
    } else {
      result = yield vm.invoke(resolved, params);
    }

    const want = samType.ret;

    if (want === "V") return undefined;

    if (isPrimitive(want)) {
      return isPrimitive(implRet)
        ? widen(result, implRet, want)
        : unbox(result, want);
    }

    return isPrimitive(implRet) ? yield* box(vm, implRet, result) : result;
  };

  sam.native = { fn: invokeLambda, generator: true };

  cls.declaredMethods = [sam];
  cls.methodMap.set(sam.key, sam);
  cls.vtable = new Map(vm.objectClass.vtable);

  for (const sup of cls.supers) {
    if (!sup.isInterface) continue;

    for (const method of sup.declaredMethods) {
      if (!method.isAbstract && !method.isStatic && !method.name.startsWith("<")) {
        cls.vtable.set(method.key, method);
      }
    }
  }

  cls.vtable.set(sam.key, sam);

  for (const bridge of bridges) {
    const method = new JMethod(cls, {
      access: 0x1041,
      descriptor: bridge,
      exceptions: [],
      name: samName,
    });

    method.native = sam.native;
    cls.methodMap.set(method.key, method);
    cls.vtable.set(method.key, method);
  }
  cls.state = INITIALIZED;
  vm.classes.set(name, cls);

  const make = (captured: unknown[]): JObject => {
    const object = new LambdaObject();

    object.$captured = captured;

    return object;
  };
  let singleton: JObject | undefined;

  return (args) => {
    if (capturedCount > 0) return make(args);

    singleton ??= make([]);

    return singleton;
  };
};
