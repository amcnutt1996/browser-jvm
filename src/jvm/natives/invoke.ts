import { ensureInitialized } from "./helpers.ts";
import {
  type JArray,
  type JClass,
  JMethod,
  type JObject,
  type Native,
} from "../types.ts";
import { type JVM, type NativeTable } from "../vm.ts";

type Access = {
  array: boolean;
  cls: JClass | undefined;
  key: string;
  type: string;
};

const accessOf = (handle: unknown): Access => (handle as JObject).$access as Access;

const add = (a: unknown, b: unknown, type: string): unknown => {
  if (typeof a === "bigint") return BigInt.asIntN(64, a + (b as bigint));

  if (type === "F") return Math.fround((a as number) + (b as number));

  if (type === "D") return (a as number) + (b as number);

  return ((a as number) + (b as number)) | 0;
};

const bitwise = (a: unknown, b: unknown, op: string): unknown => {
  if (typeof a === "bigint") {
    const y = b as bigint;

    return op === "Or" ? a | y : op === "And" ? a & y : a ^ y;
  }

  const x = a as number;
  const y = b as number;

  return op === "Or" ? x | y : op === "And" ? x & y : x ^ y;
};

export const varHandleNative = (vm: JVM, name: string): Native => {
  const read = (access: Access, args: unknown[]): [() => unknown, (value: unknown) => void, number] => {
    if (access.array) {
      const array = args[1] as JArray;
      const index = args[2] as number;

      if (array === null) vm.throwNew("java/lang/NullPointerException");

      if (index < 0 || index >= array.length) {
        vm.throwNew(
          "java/lang/ArrayIndexOutOfBoundsException",
          `Index ${index} out of bounds for length ${array.length}`
        );
      }

      return [
        () => (array as unknown[])[index],
        (value) => {
          (array as unknown[])[index] = value;
        },
        3,
      ];
    }

    if (access.cls) {
      const {statics} = access.cls;

      return [
        () => statics[access.key],
        (value) => {
          statics[access.key] = value;
        },
        1,
      ];
    }

    const target = args[1] as JObject;

    if (target === null) vm.throwNew("java/lang/NullPointerException");

    return [
      () => target[access.key],
      (value) => {
        target[access.key] = value;
      },
      2,
    ];
  };
  const mode = name.replace(/(?:Acquire|Release|Opaque|Volatile|Plain)$/, "");

  return {
    fn: (_t, args) => {
      const access = accessOf(args[0]);
      const [get, set, first] = read(access, args);

      switch (mode) {
        case "get":
          return get();
        case "set":
          set(args[first]);

          return null;
        case "compareAndSet":
        case "weakCompareAndSet": 
          if (get() !== args[first]) return 0;

          set(args[first + 1]);

          return 1;
        
        case "compareAndExchange": {
          const old = get();

          if (old === args[first]) set(args[first + 1]);

          return old;
        }
        case "getAndSet": {
          const old = get();

          set(args[first]);

          return old;
        }
        case "getAndAdd": {
          const old = get();

          set(add(old, args[first], access.type));

          return old;
        }
        case "getAndBitwiseOr":
        case "getAndBitwiseAnd":
        case "getAndBitwiseXor": {
          const old = get();

          set(bitwise(old, args[first], mode.slice(12)));

          return old;
        }
        default:
          return vm.throwNew("java/lang/UnsupportedOperationException", `VarHandle.${name}`);
      }
    },
    generator: false,
  };
};

export const polymorphicMethod = (
  vm: JVM,
  owner: JClass,
  name: string,
  descriptor: string
): JMethod | undefined => {
  if (owner.name !== "java/lang/invoke/VarHandle") return undefined;

  const method = new JMethod(owner, {
    access: 0x0111,
    descriptor,
    exceptions: [],
    name,
  });

  method.native = varHandleNative(vm, name);

  return method;
};

export const invokeNatives = (vm: JVM): NativeTable => ({
  "java/lang/invoke/VarHandle$ArrayHandle.init()V": (_t, [self]) => {
    const handle = self as JObject;
    const type = handle._varType as JClass;

    handle.$access = {
      array: true,
      cls: undefined,
      key: "",
      type: type.isPrimitive ? vm.primitiveDescriptor(type) : "L",
    } satisfies Access;
  },
  "java/lang/invoke/VarHandle$FieldHandle.init(Ljava/lang/Class;Ljava/lang/String;Z)V": {
    *gen(t, [self, owner, name, isStatic]) {
      const cls = owner as JClass;
      const field = cls.field(name as string);

      if (!field) vm.throwNew("java/lang/NoSuchFieldException", name as string);

      if (isStatic) yield* ensureInitialized(vm, t, field.cls);

      (self as JObject).$access = {
        array: false,
        cls: isStatic ? field.cls : undefined,
        key: field.key,
        type: field.descriptor,
      } satisfies Access;
    },
  },
});
