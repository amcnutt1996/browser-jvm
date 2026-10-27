import { type JArray } from "../types.ts";
import { type JVM, type NativeTable } from "../vm.ts";

const VIEWS = {
  Char: { array: Uint16Array, descriptor: "C", get: "getUint16", set: "setUint16", size: 2, type: "char" },
  Double: { array: Float64Array, descriptor: "D", get: "getFloat64", set: "setFloat64", size: 8, type: "double" },
  Float: { array: Float32Array, descriptor: "F", get: "getFloat32", set: "setFloat32", size: 4, type: "float" },
  Int: { array: Int32Array, descriptor: "I", get: "getInt32", set: "setInt32", size: 4, type: "int" },
  Long: { array: BigInt64Array, descriptor: "J", get: "getBigInt64", set: "setBigInt64", size: 8, type: "long" },
  Short: { array: Int16Array, descriptor: "S", get: "getInt16", set: "setInt16", size: 2, type: "short" },
} as const;

const views = new WeakMap<ArrayBufferLike, DataView>();

export const dataView = (array: JArray): DataView => {
  const { buffer } = array as unknown as Int8Array;
  let view = views.get(buffer);

  if (!view) {
    view = new DataView(buffer);
    views.set(buffer, view);
  }

  return view;
};

export const nioNatives = (vm: JVM): NativeTable => {
  const table: NativeTable = {};

  for (const [name, spec] of Object.entries(VIEWS)) {
    const { descriptor, size } = spec;
    const get = spec.get as "getInt32";
    const set = spec.set as "setInt32";

    table[`java/nio/ByteBuffer.get${name}0([BIZ)${descriptor}`] = (_t, [bytes, index, bigEndian]) => {
      const array = bytes as Int8Array;

      if ((index as number) < 0 || (index as number) + size > array.length) {
        vm.throwNew("java/lang/IndexOutOfBoundsException", String(index));
      }

      return dataView(bytes as JArray)[get](array.byteOffset + (index as number), !bigEndian);
    };
    table[`java/nio/ByteBuffer.put${name}0([BI${descriptor}Z)V`] = (
      _t,
      [bytes, index, value, bigEndian]
    ) => {
      const array = bytes as Int8Array;

      if ((index as number) < 0 || (index as number) + size > array.length) {
        vm.throwNew("java/lang/IndexOutOfBoundsException", String(index));
      }

      (dataView(bytes as JArray)[set] as (offset: number, value: unknown, little: boolean) => void)(
        array.byteOffset + (index as number),
        value,
        !bigEndian
      );
    };
    table[`java/nio/ByteBuffer.${spec.type}View([BII)[${descriptor}`] = (
      _t,
      [bytes, byteOffset, count]
    ) => {
      const array = bytes as Int8Array;
      const start = array.byteOffset + (byteOffset as number);

      if (start % size !== 0) return null;

      const { array: View } = spec;
      const view = new View(
        array.buffer as ArrayBuffer,
        start,
        count as number
      ) as unknown as JArray;

      view.$cls = vm.loadClass(`[${descriptor}`);

      return view;
    };
  }

  return table;
};
