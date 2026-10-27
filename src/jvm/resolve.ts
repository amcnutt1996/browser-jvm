import {
  CONSTANT_Class,
  CONSTANT_Double,
  CONSTANT_Dynamic,
  CONSTANT_Float,
  CONSTANT_Integer,
  CONSTANT_Long,
  CONSTANT_MethodHandle,
  CONSTANT_MethodType,
  CONSTANT_String,
  type ConstantPoolEntry,
  type MemberRef,
} from "./classfile.ts";
import {
  bootstrapDynamicConstant,
  methodHandleConstant,
  methodTypeConstant,
} from "./indy.ts";
import { polymorphicMethod } from "./natives/invoke.ts";
import {
  InternalError,
  type JArray,
  JavaThrow,
  type JClass,
  type JField,
  type JMethod,
  type JObject,
  type JThread,
} from "./types.ts";
import { type JVM } from "./vm.ts";

const INT_MIN = -2147483648;
const INT_MAX = 2147483647;
const LONG_MIN = -9223372036854775808n;
const LONG_MAX = 9223372036854775807n;

export const d2i = (value: number): number =>
  Number.isNaN(value)
    ? 0
    : value >= INT_MAX
      ? INT_MAX
      : value <= INT_MIN
        ? INT_MIN
        : value | 0;

export const d2l = (value: number): bigint =>
  Number.isNaN(value)
    ? 0n
    : value >= 2 ** 63
      ? LONG_MAX
      : value <= -(2 ** 63)
        ? LONG_MIN
        : BigInt(Math.trunc(value));


export const resolveClass = (
  vm: JVM,
  cls: JClass,
  entry: ConstantPoolEntry
): JClass => {
  const ref = entry as { resolved?: JClass; value: string };

  if (ref.resolved === undefined) {
    ref.resolved = vm.loadClass(ref.value, cls.loader);
  }

  return ref.resolved;
};

export const resolveField = (vm: JVM, cls: JClass, ref: MemberRef): JField => {
  if (ref.resolved === undefined) {
    const owner = vm.loadClass(ref.className, cls.loader);
    const field = owner.field(ref.name);

    if (!field) {
      vm.throwNew(
        "java/lang/NoSuchFieldError",
        `${ref.className}.${ref.name}`
      );
    }

    ref.resolved = field;
  }

  return ref.resolved as JField;
};

export const resolveMethod = (vm: JVM, cls: JClass, ref: MemberRef): JMethod => {
  if (ref.resolved === undefined) {
    const owner = vm.loadClass(ref.className, cls.loader);
    const key = ref.name + ref.descriptor;
    const method =
      owner.method(key) ??
      (owner.isInterface ? vm.objectClass.method(key) : undefined) ??
      polymorphicMethod(vm, owner, ref.name, ref.descriptor);

    if (!method) {
      vm.throwNew(
        "java/lang/NoSuchMethodError",
        `${ref.className}.${ref.name}${ref.descriptor}`
      );
    }

    ref.resolved = method;
  }

  return ref.resolved as JMethod;
};

export const resolveConstant = (
  vm: JVM,
  thread: JThread,
  cls: JClass,
  entry: ConstantPoolEntry
): unknown => {
  switch (entry?.tag) {
    case CONSTANT_Integer:
    case CONSTANT_Float:
    case CONSTANT_String:
    case CONSTANT_Long:
    case CONSTANT_Double:
      return entry.value;
    case CONSTANT_Class:
      return resolveClass(vm, cls, entry);
    case CONSTANT_MethodType:
      return methodTypeConstant(vm, cls, entry);
    case CONSTANT_MethodHandle:
      return methodHandleConstant(vm, cls, entry);
    case CONSTANT_Dynamic:
      return bootstrapDynamicConstant(vm, thread, cls, entry);
    default:
      throw new InternalError(`Bad ldc constant ${String(entry?.tag)}`);
  }
};


export const describe = (vm: JVM, value: unknown): string =>
  vm.classOf(value).name.replaceAll("/", ".");

export const arrayIndexError = (vm: JVM, index: number, length: number): never =>
  vm.throwNew(
    "java/lang/ArrayIndexOutOfBoundsException",
    `Index ${index} out of bounds for length ${length}`
  );

const moduleOf = (cls: JClass): string => {
  let element = cls;

  while (element.componentType) element = element.componentType;

  return element.loader === null && element.source.path === "runtime.jar"
    ? "module java.base of loader 'bootstrap'"
    : "unnamed module of loader 'app'";
};

export const castError = (vm: JVM, value: unknown, cls: JClass): never => {
  const from = vm.classOf(value);
  const fromModule = moduleOf(from);
  const toModule = moduleOf(cls);
  const fromName = describe(vm, value);
  const toName = cls.name.replaceAll("/", ".");
  const where =
    fromModule === toModule
      ? `${fromName} and ${toName} are in ${fromModule}`
      : `${fromName} is in ${fromModule}; ${toName} is in ${toModule}`;

  return vm.throwNew(
    "java/lang/ClassCastException",
    `class ${fromName} cannot be cast to class ${toName} (${where})`
  );
};

export const newMultiArray = (
  vm: JVM,
  cls: JClass,
  counts: number[],
  depth: number
): JArray => {
  const length = counts[depth];
  const component = cls.componentType as JClass;
  const array = vm.newArrayOf(component, length);

  if (depth + 1 < counts.length) {
    for (let i = 0; i < length; i++) {
      (array as unknown[])[i] = newMultiArray(vm, component, counts, depth + 1);
    }
  }

  return array;
};


export const toJavaException = (vm: JVM, error: unknown): JObject => {
  if (error instanceof JavaThrow) return error.exception;

  if (error instanceof RangeError && /call stack/i.test(error.message)) {
    return vm.newThrowable("java/lang/StackOverflowError");
  }

  throw error;
};

