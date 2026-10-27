import { type InnerClass } from "../classfile.ts";
import { initialize } from "../initialize.ts";
import { enter, exit, monitorOf, notify, wait } from "../monitors.ts";
import {
  box,
  classFromDescriptor,
  ensureInitialized,
  javaClassName,
  newByteArray,
  objectArray,
  stringArray,
  unbox,
} from "./helpers.ts";
import {
  javaDoubleToString,
  javaFloatToString,
} from "../numbers.ts";
import {
  type JArray,
  JavaThrow,
  type JClass,
  type JField,
  type JMethod,
  type JObject,
  type JThread,
  type Request,
  TERMINATED,
} from "../types.ts";
import { type JVM, type NativeTable } from "../vm.ts";

const scratch = new DataView(new ArrayBuffer(8));

const innerEntry = (cls: JClass): InnerClass | undefined =>
  cls.cf?.innerClasses.find((entry) => entry.name === cls.name);

const simpleName = (cls: JClass): string => {
  if (cls.isArray) return `${simpleName(cls.componentType as JClass)}[]`;

  if (cls.isPrimitive) return cls.name;

  const entry = innerEntry(cls);

  if (entry) return entry.innerName ?? "";

  const name = cls.name.slice(cls.name.lastIndexOf("/") + 1);

  if (cls.cf?.enclosingMethod) return name.replace(/^.*\$\d*/, "");

  return name;
};

const modifiers = (cls: JClass): number => {
  if (cls.isPrimitive) return 0x411;

  if (cls.isArray) {
    return (modifiers(cls.componentType as JClass) & 0x7) | 0x410;
  }

  const entry = innerEntry(cls);

  return (entry ? entry.access : cls.access) & ~0x20;
};

const fieldObject = (vm: JVM, field: JField, slot: number): JObject => {
  const cls = vm.loadClass("java/lang/reflect/Field");

  vm.forceInitialized(cls);

  const object = vm.newObject(cls);

  object._clazz = field.cls;
  object._name = field.name;
  object._type = classFromDescriptor(vm, field.descriptor, field.cls.loader);
  object._modifiers = field.access;
  object._slot = slot;
  object._signature = field.info.signature ?? null;

  return object;
};

const classArray = (vm: JVM, classes: JClass[]): JArray =>
  objectArray(vm, "java/lang/Class", classes);

const methodObject = (vm: JVM, method: JMethod, slot: number): JObject => {
  const isConstructor = method.name === "<init>";
  const cls = vm.loadClass(
    isConstructor ? "java/lang/reflect/Constructor" : "java/lang/reflect/Method"
  );

  vm.forceInitialized(cls);

  const object = vm.newObject(cls);
  const {loader} = method.cls;

  object._clazz = method.cls;
  object._parameterTypes = classArray(
    vm,
    method.args.map((arg) => classFromDescriptor(vm, arg, loader))
  );
  object._exceptionTypes = classArray(
    vm,
    method.info.exceptions.map((name) => vm.loadClass(name, loader))
  );
  object._modifiers = method.access;
  object._slot = slot;

  if (!isConstructor) {
    object._name = method.name;
    object._returnType = classFromDescriptor(vm, method.ret, loader);
  }

  return object;
};

const unboxArgs = (vm: JVM, method: JMethod, args: JArray): unknown[] => {
  const values = args as unknown[];
  const result: unknown[] = [];

  for (let i = 0; i < method.args.length; i++) {
    const type = method.args[i];
    const value = values[i];

    if (type.length === 1) {
      if (value === null) vm.throwNew("java/lang/IllegalArgumentException");

      result.push(unbox(value, type));
    } else {
      result.push(value);
    }
  }

  return result;
};

const invokeReflective = function* invokeReflective(
  vm: JVM,
  method: JMethod,
  args: unknown[]
): Generator<Request, unknown, unknown> {
  try {
    return yield vm.invoke(method, args);
  } catch (error) {
    if (error instanceof JavaThrow) {
      const wrapper = vm.newThrowable(
        "java/lang/reflect/InvocationTargetException"
      );

      wrapper._target = error.exception;
      wrapper._cause = error.exception;
      throw new JavaThrow(wrapper);
    }

    throw error;
  }
};

const arrayDescriptor = (vm: JVM, array: JArray): string =>
  (array.$cls.componentType as JClass).isPrimitive
    ? vm.primitiveDescriptor(array.$cls.componentType as JClass)
    : "L";

export const langNatives = (vm: JVM): NativeTable => ({
  "java/lang/Class.arrayType()Ljava/lang/Class;": (_t, [self]) =>
    vm.arrayClass(self as JClass),
  "java/lang/Class.desiredAssertionStatus()Z": () => 0,
  "java/lang/Class.forName0(Ljava/lang/String;ZLjava/lang/ClassLoader;)Ljava/lang/Class;": {
    *gen(t, [name, init]) {
      const className = name as string;

      if (className === null) vm.throwNew("java/lang/NullPointerException");

      let cls: JClass;

      try {
        cls = vm.loadClass(
          className.startsWith("[")
            ? className.replaceAll(".", "/")
            : className.replaceAll(".", "/")
        );
      } catch (error) {
        if (error instanceof JavaThrow) {
          vm.throwNew("java/lang/ClassNotFoundException", className);
        }

        throw error;
      }

      if (cls.isArray && className.includes("/")) {
        vm.throwNew("java/lang/ClassNotFoundException", className);
      }

      if (init) yield* ensureInitialized(vm, t, cls);

      return cls;
    },
  },
  "java/lang/Class.getComponentType()Ljava/lang/Class;": (_t, [self]) =>
    (self as JClass).componentType ?? null,
  "java/lang/Class.getDeclaredConstructors()[Ljava/lang/reflect/Constructor;": (
    _t,
    [self]
  ) => {
    const cls = self as JClass;

    return objectArray(
      vm,
      "java/lang/reflect/Constructor",
      cls.declaredMethods
        .map((method, slot) => [method, slot] as const)
        .filter(([method]) => method.name === "<init>")
        .map(([method, slot]) => methodObject(vm, method, slot))
    );
  },
  "java/lang/Class.getDeclaredFields()[Ljava/lang/reflect/Field;": (_t, [self]) => {
    const cls = self as JClass;

    return objectArray(
      vm,
      "java/lang/reflect/Field",
      cls.declaredFields.map((field, slot) => fieldObject(vm, field, slot))
    );
  },

  "java/lang/Class.getDeclaredMethods()[Ljava/lang/reflect/Method;": (_t, [self]) => {
    const cls = self as JClass;

    return objectArray(
      vm,
      "java/lang/reflect/Method",
      cls.declaredMethods
        .map((method, slot) => [method, slot] as const)
        .filter(([method]) => !method.name.startsWith("<"))
        .map(([method, slot]) => methodObject(vm, method, slot))
    );
  },
  "java/lang/Class.getDeclaringClass()Ljava/lang/Class;": (_t, [self]) => {
    const cls = self as JClass;
    const entry = innerEntry(cls);

    return entry?.outerName ? vm.loadClass(entry.outerName, cls.loader) : null;
  },
  "java/lang/Class.getInterfaces()[Ljava/lang/Class;": (_t, [self]) =>
    classArray(vm, (self as JClass).interfaces),
  "java/lang/Class.getModifiers()I": (_t, [self]) => modifiers(self as JClass),
  "java/lang/Class.getName()Ljava/lang/String;": (_t, [self]) =>
    javaClassName(self as JClass),
  "java/lang/Class.getNestHost()Ljava/lang/Class;": (_t, [self]) => {
    const cls = self as JClass;

    return cls.cf?.nestHost ? vm.loadClass(cls.cf.nestHost, cls.loader) : cls;
  },
  "java/lang/Class.getPrimitiveClass(Ljava/lang/String;)Ljava/lang/Class;": (
    _t,
    [name]
  ) =>
    [...vm.primitives.values()].find((cls) => cls.name === name) ?? null,
  "java/lang/Class.getSimpleName()Ljava/lang/String;": (_t, [self]) =>
    simpleName(self as JClass),
  "java/lang/Class.getSuperclass()Ljava/lang/Class;": (_t, [self]) => {
    const cls = self as JClass;

    if (cls.isInterface || cls.isPrimitive) return null;

    return cls.superClass;
  },
  "java/lang/Class.isAnonymousClass()Z": (_t, [self]) => {
    const entry = innerEntry(self as JClass);

    return entry && entry.innerName === undefined ? 1 : 0;
  },
  "java/lang/Class.isArray()Z": (_t, [self]) => ((self as JClass).isArray ? 1 : 0),
  "java/lang/Class.isAssignableFrom(Ljava/lang/Class;)Z": (_t, [self, other]) => {
    if (other === null) vm.throwNew("java/lang/NullPointerException");

    const target = self as JClass;
    const source = other as JClass;

    if (target.isPrimitive || source.isPrimitive) return target === source ? 1 : 0;

    return source.isSubclassOf(target) ? 1 : 0;
  },
  "java/lang/Class.isInstance(Ljava/lang/Object;)Z": (_t, [self, object]) =>
    vm.instanceOf(object, self as JClass) ? 1 : 0,
  "java/lang/Class.isInterface()Z": (_t, [self]) =>
    (self as JClass).isInterface && !(self as JClass).isArray ? 1 : 0,
  "java/lang/Class.isPrimitive()Z": (_t, [self]) =>
    (self as JClass).isPrimitive ? 1 : 0,
  "java/lang/ClassLoader.readResource(Ljava/lang/String;)[B": (_t, [name]) => {
    const data = vm.readResource(name as string);

    return data ? newByteArray(vm, data) : null;
  },
  "java/lang/Double.doubleToRawLongBits(D)J": (_t, [value]) => {
    scratch.setFloat64(0, value as number);

    return scratch.getBigInt64(0);
  },
  "java/lang/Double.longBitsToDouble(J)D": (_t, [bits]) => {
    scratch.setBigInt64(0, bits as bigint);

    return scratch.getFloat64(0);
  },
  "java/lang/Double.toString(D)Ljava/lang/String;": (_t, [value]) =>
    javaDoubleToString(value as number),
  "java/lang/Float.floatToRawIntBits(F)I": (_t, [value]) => {
    scratch.setFloat32(0, value as number);

    return scratch.getInt32(0);
  },
  "java/lang/Float.intBitsToFloat(I)F": (_t, [bits]) => {
    scratch.setInt32(0, bits as number);

    return scratch.getFloat32(0);
  },

  "java/lang/Float.toString(F)Ljava/lang/String;": (_t, [value]) =>
    javaFloatToString(value as number),
  "java/lang/Integer.toString(I)Ljava/lang/String;": (_t, [value]) => String(value),
  "java/lang/Long.toString(J)Ljava/lang/String;": (_t, [value]) => String(value),
  "java/lang/NullPointerException.getExtendedNPEMessage()Ljava/lang/String;": () =>
    null,
  "java/lang/Object.clone()Ljava/lang/Object;": (_t, [self]) => {
    const source = self as JObject;
    const cls = source.$cls;

    if (cls.isArray) {
      const array = self as JArray;
      const copy = (
        Array.isArray(array) ? [...array] : new (array.constructor as Int32ArrayConstructor)(array as Int32Array)
      ) as JArray;

      copy.$cls = cls;

      return copy;
    }

    if (!cls.isSubclassOf(vm.loadClass("java/lang/Cloneable"))) {
      vm.throwNew("java/lang/CloneNotSupportedException", javaClassName(cls));
    }

    const copy = vm.newObject(cls);

    for (const field of cls.instanceFields) copy[field.key] = source[field.key];

    return copy;
  },
  "java/lang/Object.getClass()Ljava/lang/Class;": (_t, [self]) => vm.classOf(self),
  "java/lang/Object.hashCode()I": (_t, [self]) =>
    vm.identityHash(self as JObject),
  "java/lang/Object.notify()V": (t, [self]) =>
    notify(vm, t, self as JObject, false),
  "java/lang/Object.notifyAll()V": (t, [self]) =>
    notify(vm, t, self as JObject, true),
  "java/lang/Object.wait(J)V": {
    gen: (t, [self, millis]) => wait(vm, t, self as JObject, Number(millis)),
  },
  "java/lang/Package.manifestAttributes(Ljava/lang/Class;)[Ljava/lang/String;": (
    _t,
    [cls]
  ) => {
    const { path } = (cls as JClass).source;
    const manifest = path === undefined ? undefined : vm.manifests.get(path);
    const get = (key: string): null | string => manifest?.[key] ?? null;

    return stringArray(vm, [
      get("Specification-Title"),
      get("Specification-Version"),
      get("Specification-Vendor"),
      get("Implementation-Title"),
      get("Implementation-Version"),
      get("Implementation-Vendor"),
    ]);
  },
  "java/lang/reflect/Array.get(Ljava/lang/Object;I)Ljava/lang/Object;": {
    *gen(_t, [array, index]) {
      const target = array as JArray;

      if (target === null) vm.throwNew("java/lang/NullPointerException");

      if (!vm.classOf(target).isArray) {
        vm.throwNew("java/lang/IllegalArgumentException", "Argument is not an array");
      }

      if ((index as number) < 0 || (index as number) >= target.length) {
        vm.throwNew(
          "java/lang/ArrayIndexOutOfBoundsException",
          `Index ${String(index)} out of bounds for length ${target.length}`
        );
      }

      const value = (target as unknown[])[index as number];
      const descriptor = arrayDescriptor(vm, target);

      return descriptor === "L" ? value : yield* box(vm, descriptor, value);
    },
  },
  "java/lang/reflect/Array.getLength(Ljava/lang/Object;)I": (_t, [array]) => {
    if (array === null) vm.throwNew("java/lang/NullPointerException");

    if (!vm.classOf(array).isArray) {
      vm.throwNew("java/lang/IllegalArgumentException", "Argument is not an array");
    }

    return (array as JArray).length;
  },
  "java/lang/reflect/Array.newArray(Ljava/lang/Class;I)Ljava/lang/Object;": (
    _t,
    [component, length]
  ) => vm.newArrayOf(component as JClass, length as number),
  "java/lang/reflect/Array.set(Ljava/lang/Object;ILjava/lang/Object;)V": (
    _t,
    [array, index, value]
  ) => {
    const target = array as JArray;

    if (target === null) vm.throwNew("java/lang/NullPointerException");

    if ((index as number) < 0 || (index as number) >= target.length) {
      vm.throwNew(
        "java/lang/ArrayIndexOutOfBoundsException",
        `Index ${String(index)} out of bounds for length ${target.length}`
      );
    }

    const descriptor = arrayDescriptor(vm, target);

    (target as unknown[])[index as number] =
      descriptor === "L" ? value : unbox(value, descriptor);
  },

  "java/lang/reflect/Constructor.getAnnotation(Ljava/lang/Class;)Ljava/lang/annotation/Annotation;": () =>
    null,
  "java/lang/reflect/Constructor.getDeclaredAnnotations()[Ljava/lang/annotation/Annotation;": () =>
    objectArray(vm, "java/lang/annotation/Annotation", []),

  "java/lang/reflect/Constructor.newInstance0([Ljava/lang/Object;)Ljava/lang/Object;": {
    *gen(t, [self, args]) {
      const reflected = self as JObject;
      const cls = reflected._clazz as JClass;
      const method = cls.declaredMethods[reflected._slot as number];
      const values = unboxArgs(vm, method, args as JArray);

      yield* ensureInitialized(vm, t, cls);

      if (cls === vm.stringClass) {
        return yield* invokeReflective(vm, method, [{ $cls: cls }, ...values]);
      }

      const object = vm.newObject(cls);

      yield* invokeReflective(vm, method, [object, ...values]);

      return object;
    },
  },
  "java/lang/reflect/Field.genericType()Ljava/lang/reflect/Type;": () => null,
  "java/lang/reflect/Field.get(Ljava/lang/Object;)Ljava/lang/Object;": {
    *gen(t, [self, target]) {
      const reflected = self as JObject;
      const cls = reflected._clazz as JClass;
      const field = cls.declaredFields[reflected._slot as number];
      let value: unknown;

      if (field.isStatic) {
        yield* ensureInitialized(vm, t, cls);
        value = cls.statics[field.key];
      } else {
        if (target === null) vm.throwNew("java/lang/NullPointerException");

        if (!vm.instanceOf(target, cls)) {
          vm.throwNew(
            "java/lang/IllegalArgumentException",
            `Can not get field ${field.name} on ${javaClassName(vm.classOf(target))}`
          );
        }

        value = (target as JObject)[field.key];
      }

      return field.descriptor.length === 1
        ? yield* box(vm, field.descriptor, value)
        : value;
    },
  },
  "java/lang/reflect/Field.getAnnotation(Ljava/lang/Class;)Ljava/lang/annotation/Annotation;": () =>
    null,
  "java/lang/reflect/Field.getDeclaredAnnotations()[Ljava/lang/annotation/Annotation;": () =>
    objectArray(vm, "java/lang/annotation/Annotation", []),
  "java/lang/reflect/Field.set(Ljava/lang/Object;Ljava/lang/Object;)V": {
    *gen(t, [self, target, value]) {
      const reflected = self as JObject;
      const cls = reflected._clazz as JClass;
      const field = cls.declaredFields[reflected._slot as number];
      const stored =
        field.descriptor.length === 1 ? unbox(value, field.descriptor) : value;

      if (field.descriptor.length === 1 && value === null) {
        vm.throwNew("java/lang/IllegalArgumentException");
      }

      if (field.isStatic) {
        yield* ensureInitialized(vm, t, cls);
        cls.statics[field.key] = stored;
      } else {
        if (target === null) vm.throwNew("java/lang/NullPointerException");

        (target as JObject)[field.key] = stored;
      }
    },
  },
  "java/lang/reflect/Method.getAnnotation(Ljava/lang/Class;)Ljava/lang/annotation/Annotation;": () =>
    null,
  "java/lang/reflect/Method.getDeclaredAnnotations()[Ljava/lang/annotation/Annotation;": () =>
    objectArray(vm, "java/lang/annotation/Annotation", []),
  "java/lang/reflect/Method.invoke0(Ljava/lang/Object;[Ljava/lang/Object;)Ljava/lang/Object;": {
    *gen(t, [self, target, args]) {
      const reflected = self as JObject;
      const cls = reflected._clazz as JClass;
      let method = cls.declaredMethods[reflected._slot as number];
      const values = unboxArgs(vm, method, args as JArray);

      if (method.isStatic) {
        yield* ensureInitialized(vm, t, cls);
      } else {
        if (!method.isPrivate) method = vm.resolveVirtual(target, method.key);

        values.unshift(target);
      }

      const result = yield* invokeReflective(vm, method, values);

      if (method.ret === "V") return null;

      return method.ret.length === 1
        ? yield* box(vm, method.ret, result)
        : result;
    },
  },

  "java/lang/Runtime.availableProcessors()I": () => 1,
  "java/lang/Runtime.freeMemory()J": () => 256n * 1024n * 1024n,
  "java/lang/Runtime.halt(I)V": (_t, [, code]) => {
    vm.exit(code as number);
  },
  "java/lang/Runtime.maxMemory()J": () => 1024n * 1024n * 1024n,
  "java/lang/Runtime.totalMemory()J": () => 512n * 1024n * 1024n,

  "java/lang/StringUTF16.isBigEndian()Z": () => 0,
  "java/lang/System.arraycopy(Ljava/lang/Object;ILjava/lang/Object;II)V": (
    _t,
    [src, srcPos, dest, destPos, length]
  ) => {
    if (src === null || dest === null) vm.throwNew("java/lang/NullPointerException");

    const source = src as JArray;
    const target = dest as JArray;
    const from = srcPos as number;
    const to = destPos as number;
    const count = length as number;
    const sourceClass = vm.classOf(source);
    const targetClass = vm.classOf(target);

    if (!sourceClass.isArray || !targetClass.isArray) {
      vm.throwNew(
        "java/lang/ArrayStoreException",
        `arraycopy: ${sourceClass.isArray ? "destination" : "source"} type ${javaClassName(sourceClass.isArray ? targetClass : sourceClass)} is not an array`
      );
    }

    const sourceComponent = sourceClass.componentType as JClass;
    const targetComponent = targetClass.componentType as JClass;

    if (
      (sourceComponent.isPrimitive || targetComponent.isPrimitive) &&
      sourceComponent !== targetComponent
    ) {
      vm.throwNew(
        "java/lang/ArrayStoreException",
        `arraycopy: type mismatch: can not copy ${javaClassName(sourceClass)} into ${javaClassName(targetClass)}`
      );
    }

    if (from < 0 || to < 0 || count < 0 || from + count > source.length || to + count > target.length) {
      vm.throwNew(
        "java/lang/ArrayIndexOutOfBoundsException",
        `arraycopy: last ${from + count > source.length || from < 0 ? "source" : "destination"} index ${from + count > source.length || from < 0 ? from + count : to + count} out of bounds for length ${from + count > source.length || from < 0 ? source.length : target.length}`
      );
    }

    if (count === 0) return;

    if (!Array.isArray(source)) {
      (target as Int32Array).set(
        (source as Int32Array).subarray(from, from + count),
        to
      );

      return;
    }

    const sourceItems = source as unknown[];
    const targetItems = target as unknown[];

    if (source === target) {
      sourceItems.copyWithin(to, from, from + count);

      return;
    }

    const checked = !sourceComponent.isSubclassOf(targetComponent);

    for (let i = 0; i < count; i++) {
      const value = sourceItems[from + i];

      if (checked && value !== null && !vm.classOf(value).isSubclassOf(targetComponent)) {
        vm.throwNew(
          "java/lang/ArrayStoreException",
          `arraycopy: element type mismatch: can not cast one of the elements of ${javaClassName(sourceClass)} to the type of the destination array, ${javaClassName(targetComponent)}`
        );
      }

      targetItems[to + i] = value;
    }
  },
  "java/lang/System.currentTimeMillis()J": () => BigInt(Date.now()),
  "java/lang/System.environmentPairs()[Ljava/lang/String;": () =>
    stringArray(vm, Object.entries(vm.host.env ?? {}).flat()),
  "java/lang/System.identityHashCode(Ljava/lang/Object;)I": (_t, [object]) =>
    object === null ? 0 : vm.identityHash(object as JObject),
  "java/lang/System.initialProperties()[Ljava/lang/String;": () =>
    stringArray(vm, Object.entries(vm.properties).flat()),
  "java/lang/System.nanoTime()J": () =>
    BigInt(Math.round(performance.now() * 1_000_000)),
  "java/lang/System.setErr(Ljava/io/PrintStream;)V": (_t, [stream]) => {
    vm.loadClass("java/lang/System").statics._err = stream;
  },
  "java/lang/System.setIn(Ljava/io/InputStream;)V": (_t, [stream]) => {
    vm.loadClass("java/lang/System").statics._in = stream;
  },
  "java/lang/System.setOut(Ljava/io/PrintStream;)V": (_t, [stream]) => {
    vm.loadClass("java/lang/System").statics._out = stream;
  },
  "java/lang/Thread.currentThread()Ljava/lang/Thread;": (t) => t.java,

  "java/lang/Thread.holdsLock(Ljava/lang/Object;)Z": (t, [object]) =>
    monitorOf(object as JObject).owner === t ? 1 : 0,
  "java/lang/Thread.interrupt0()V": (_t, [self]) => {
    const thread = (self as JObject).$thread as JThread | undefined;

    if (thread) {
      thread.interrupted = true;
      thread.interruptWaiter?.();
    }
  },

  "java/lang/Thread.interrupted()Z": (t) => {
    const was = t.interrupted;

    t.interrupted = false;

    return was ? 1 : 0;
  },
  "java/lang/Thread.isAlive()Z": (_t, [self]) => {
    const thread = (self as JObject).$thread as JThread | undefined;

    return thread && thread.state !== TERMINATED ? 1 : 0;
  },
  "java/lang/Thread.isInterrupted()Z": (_t, [self]) =>
    ((self as JObject).$thread as JThread | undefined)?.interrupted ? 1 : 0,
  "java/lang/Thread.join0(J)V": {
    *gen(t, [self, millis]) {
      const thread = (self as JObject).$thread as JThread | undefined;

      if (!thread || thread.state === TERMINATED) return;

      const timeout = Number(millis);

      yield vm.wait(
        new Promise<void>((resolve) => {
          const done = (): void => {
            t.interruptWaiter = undefined;
            resolve();
          };

          thread.terminationWaiters.push(done);
          t.interruptWaiter = done;

          if (timeout > 0) vm.setTimer(done, timeout);
        })
      );

      if (t.interrupted) {
        t.interrupted = false;
        vm.throwNew("java/lang/InterruptedException");
      }
    },
  },
  "java/lang/Thread.setName0(Ljava/lang/String;)V": (_t, [self, name]) => {
    const thread = (self as JObject).$thread as JThread | undefined;

    if (thread) thread.name = name as string;
  },
  "java/lang/Thread.sleep(J)V": {
    *gen(t, [millis]) {
      const delay = Number(millis);

      if (delay < 0) {
        vm.throwNew("java/lang/IllegalArgumentException", "timeout value is negative");
      }

      if (t.interrupted) {
        t.interrupted = false;
        vm.throwNew("java/lang/InterruptedException", "sleep interrupted");
      }

      yield vm.wait(
        new Promise<void>((resolve) => {
          const cancel = vm.setTimer(() => {
            t.interruptWaiter = undefined;
            resolve();
          }, delay);

          t.interruptWaiter = () => {
            cancel();
            t.interruptWaiter = undefined;
            resolve();
          };
        })
      );

      if (t.interrupted) {
        t.interrupted = false;
        vm.throwNew("java/lang/InterruptedException", "sleep interrupted");
      }
    },
  },
  "java/lang/Thread.start0()V": (_t, [self]) => {
    const object = self as JObject;
    const thread = vm.createThread(
      object._name as string,
      Boolean(object._daemon)
    );

    thread.java = object;
    object.$thread = thread;
    vm.startThread(thread, vm.resolveVirtual(object, "run()V"), [object]);
  },
  "java/lang/Thread.yield()V": {
    *gen() {
      yield vm.wait(Promise.resolve());
    },
  },
  "java/lang/Throwable.buildStackTrace()[Ljava/lang/StackTraceElement;": (_t, [self]) => {
    const frames = ((self as JObject)._backtrace ?? []) as [JMethod, number][];
    const cls = vm.loadClass("java/lang/StackTraceElement");

    vm.forceInitialized(cls);

    return objectArray(
      vm,
      "java/lang/StackTraceElement",
      frames
        .filter(([method]) => !method.name.startsWith("<") || method.name === "<init>" || method.name === "<clinit>")
        .map(([method, pc]) => {
          const element = vm.newObject(cls);

          element._declaringClass = javaClassName(method.cls);
          element._methodName = method.name;
          element._fileName = method.cls.cf?.sourceFile ?? null;
          element._lineNumber = method.isNative ? -2 : method.lineNumber(pc);

          return element;
        })
    );
  },
  "java/lang/Throwable.fillInStackTrace0()V": (t, [self]) => {
    const exception = self as JObject;
    const frames = vm.captureBacktrace(t);
    let skip = 0;

    while (skip < frames.length) {
      const [method] = frames[skip];

      if (
        method.name === "fillInStackTrace" ||
        method.name === "fillInStackTrace0" ||
        (method.name === "<init>" && exception.$cls.isSubclassOf(method.cls))
      ) {
        skip++;
      } else {
        break;
      }
    }

    exception._backtrace = frames.slice(skip);
  },

  "java/security/AccessController.ensureMaterializedForStackWalk(Ljava/lang/Object;)V": () =>
    null,
  "java/security/AccessController.getInheritedAccessControlContext()Ljava/security/AccessControlContext;": () =>
    null,
  "java/security/AccessController.getProtectionDomain(Ljava/lang/Class;)Ljava/security/ProtectionDomain;": () =>
    null,
  "java/security/AccessController.getStackAccessControlContext()Ljava/security/AccessControlContext;": () =>
    null,
  "java/util/concurrent/atomic/AtomicLong.VMSupportsCS8()Z": () => 1,
  "java/util/TimeZone.getSystemGMTOffsetID()Ljava/lang/String;": () => "GMT",
  "java/util/TimeZone.getSystemTimeZoneID(Ljava/lang/String;)Ljava/lang/String;": () =>
    "UTC",
  "jdk/internal/misc/VM.getNanoTimeAdjustment(J)J": (_t, [offset]) => {
    const now = BigInt(Date.now()) * 1_000_000n;

    return now - (offset as bigint) * 1_000_000_000n;
  },
  "jdk/internal/misc/VM.getRuntimeArguments()[Ljava/lang/String;": () =>
    stringArray(vm, []),
  "jdk/internal/misc/VM.getSavedProperty(Ljava/lang/String;)Ljava/lang/String;": (
    _t,
    [key]
  ) => vm.properties[key as string] ?? null,
  "jdk/internal/misc/VM.initialize()V": () => null,
  "jdk/internal/misc/VM.latestUserDefinedLoader0()Ljava/lang/ClassLoader;": () =>
    null,
  "jdk/internal/reflect/Reflection.areNestMates(Ljava/lang/Class;Ljava/lang/Class;)Z": () =>
    1,
  "jdk/internal/reflect/Reflection.getCallerClass()Ljava/lang/Class;": (t) => {
    const frames = vm.javaStack(t);

    return frames.length >= 3 ? frames[frames.length - 3][0].cls : null;
  },
  "jdk/internal/reflect/Reflection.getClassAccessFlags(Ljava/lang/Class;)I": (
    _t,
    [cls]
  ) => (cls as JClass).access,
});

export const monitorNatives = { enter, exit, initialize };
