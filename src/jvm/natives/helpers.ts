import { initialize } from "../initialize.ts";
import {
  INITIALIZED,
  type JArray,
  type JClass,
  type JObject,
  type JThread,
  type Request,
} from "../types.ts";
import { type JVM } from "../vm.ts";

export { box, unbox } from "../lambda.ts";

export const javaClassName = (cls: JClass): string =>
  cls.isPrimitive ? cls.name : cls.name.replaceAll("/", ".");

export const stringArray = (vm: JVM, values: (null | string)[]): JArray => {
  const array = vm.newArray("Ljava/lang/String;", values.length);

  values.forEach((value, index) => {
    (array as unknown[])[index] = value;
  });

  return array;
};

export const objectArray = (
  vm: JVM,
  className: string,
  values: unknown[]
): JArray => {
  const array = vm.newArray(`L${className};`, values.length);

  values.forEach((value, index) => {
    (array as unknown[])[index] = value;
  });

  return array;
};

export const classFromDescriptor = (
  vm: JVM,
  descriptor: string,
  loader: JObject | null = null
): JClass => {
  if (descriptor.length === 1) return vm.primitives.get(descriptor) as JClass;

  return vm.loadClass(
    descriptor.startsWith("L") ? descriptor.slice(1, -1) : descriptor,
    loader
  );
};

export const descriptorOf = (vm: JVM, cls: JClass): string =>
  cls.isPrimitive
    ? vm.primitiveDescriptor(cls)
    : cls.isArray
      ? cls.name
      : `L${cls.name};`;

export const ensureInitialized = function* ensureInitialized(
  vm: JVM,
  thread: JThread,
  cls: JClass
): Generator<Request, void, unknown> {
  if (cls.state !== INITIALIZED && cls.initThread !== thread) {
    yield* initialize(vm, thread, cls);
  }
};

export const bytesOf = (array: JArray): Uint8Array => {
  const typed = array as unknown as Int8Array;

  return new Uint8Array(typed.buffer, typed.byteOffset, typed.length);
};

export const newByteArray = (vm: JVM, data: Uint8Array): JArray => {
  const array = vm.newArray("B", data.length);

  bytesOf(array).set(data);

  return array;
};

export const checkIndex = (vm: JVM, index: number, length: number): void => {
  if (index < 0 || index >= length) {
    vm.throwNew(
      "java/lang/StringIndexOutOfBoundsException",
      `Index ${index} out of bounds for length ${length}`
    );
  }
};

export const checkRange = (
  vm: JVM,
  begin: number,
  end: number,
  length: number
): void => {
  if (begin < 0 || begin > end || end > length) {
    vm.throwNew(
      "java/lang/StringIndexOutOfBoundsException",
      `Range [${begin}, ${end}) out of bounds for length ${length}`
    );
  }
};

export const charsToString = (
  chars: ArrayLike<number>,
  start = 0,
  end = chars.length
): string => {
  let result = "";

  for (let i = start; i < end; i += 8192) {
    result += String.fromCharCode(
      ...(Array.prototype.slice.call(
        chars,
        i,
        Math.min(end, i + 8192)
      ) as number[])
    );
  }

  return result;
};

export const stringToChars = (vm: JVM, value: string): JArray => {
  const array = vm.newArray("C", value.length);
  const chars = array as unknown as Uint16Array;

  for (let i = 0; i < value.length; i++) chars[i] = value.charCodeAt(i);

  return array;
};

export const isJavaWhitespace = (code: number): boolean =>
  (code >= 0x09 && code <= 0x0d) ||
  (code >= 0x1c && code <= 0x20) ||
  code === 0x1680 ||
  (code >= 0x2000 && code <= 0x2006) ||
  (code >= 0x2008 && code <= 0x200a) ||
  code === 0x2028 ||
  code === 0x2029 ||
  code === 0x205f ||
  code === 0x3000;
