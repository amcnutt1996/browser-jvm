import { type JArray, type JClass, type JObject } from "../jvm/types.ts";
import { type JVM, type NativeTable } from "../jvm/vm.ts";

type TypedArray =
  | BigInt64Array
  | Float32Array
  | Float64Array
  | Int16Array
  | Int32Array
  | Int8Array
  | Uint16Array;

const ELEMENT_SIZES: Record<string, number> = {
  "java/nio/ByteBuffer": 1,
  "java/nio/CharBuffer": 2,
  "java/nio/DoubleBuffer": 8,
  "java/nio/FloatBuffer": 4,
  "java/nio/IntBuffer": 4,
  "java/nio/LongBuffer": 8,
  "java/nio/ShortBuffer": 2,
};

const elementSizes = new WeakMap<JClass, number>();

export const elementSize = (buffer: JObject): number => {
  const { $cls } = buffer;
  let size = elementSizes.get($cls);

  if (size === undefined) {
    size = 1;

    for (let cls: JClass | null = $cls; cls; cls = cls.superClass) {
      if (ELEMENT_SIZES[cls.name]) {
        size = ELEMENT_SIZES[cls.name];
        break;
      }
    }

    elementSizes.set($cls, size);
  }

  return size;
};

const backing = (buffer: JObject): TypedArray | undefined => {
  const hb = buffer._hb as null | TypedArray;

  if (hb) return hb;

  const bb = buffer._bb as JObject | null;

  return bb ? (bb._hb as TypedArray) : undefined;
};

const elementStart = (buffer: JObject): number =>
  buffer._hb
    ? (buffer._offset as number) * elementSize(buffer)
    : ((buffer._byteOffset as number) ?? 0);

// Bytes of a buffer from `from` elements past its start up to its limit.
// Views of big-endian buffers are converted to little-endian copies.
export const bufferBytes = (buffer: JObject, from = 0): Uint8Array => {
  const array = backing(buffer);

  if (!array) return new Uint8Array(0);

  const size = elementSize(buffer);
  const start = array.byteOffset + elementStart(buffer) + from * size;
  const end = array.byteOffset + elementStart(buffer) + (buffer._limit as number) * size;
  const bytes = new Uint8Array(array.buffer, start, Math.max(0, end - start));

  if (buffer._hb || size === 1 || !buffer._bigEndian) return bytes;

  const swapped = new Uint8Array(bytes);

  for (let i = 0; i + size <= swapped.length; i += size) {
    swapped.subarray(i, i + size).reverse();
  }

  return swapped;
};

// Bytes from the buffer's position to its limit.
export const remainingBytes = (buffer: JObject): Uint8Array =>
  bufferBytes(buffer, buffer._position as number);

export const remainingView = <T extends TypedArray>(
  buffer: JObject,
  View: new (buffer: ArrayBufferLike, offset: number, length: number) => T,
  size: number
): T => {
  const bytes = remainingBytes(buffer);

  if (bytes.byteOffset % size === 0) {
    return new View(bytes.buffer, bytes.byteOffset, Math.floor(bytes.length / size));
  }

  const copy = new Uint8Array(bytes);

  return new View(copy.buffer, 0, Math.floor(copy.length / size));
};

// Writes JS results back into a buffer starting at its position.
export const writeInts = (buffer: JObject, values: ArrayLike<number>): void => {
  const view = remainingView(buffer, Int32Array, 4);

  for (let i = 0; i < values.length && i < view.length; i++) view[i] = values[i];
};

export const writeFloats = (buffer: JObject, values: ArrayLike<number>): void => {
  const view = remainingView(buffer, Float32Array, 4);

  for (let i = 0; i < values.length && i < view.length; i++) view[i] = values[i];
};

export const newDirectByteBuffer = (vm: JVM, data: Uint8Array): JObject => {
  const cls = vm.loadClass("java/nio/ByteBuffer");

  vm.forceInitialized(cls);

  const array = new Int8Array(data.buffer, data.byteOffset, data.length) as unknown as JArray;
  const buffer = vm.newObject(cls);

  array.$cls = vm.loadClass("[B");
  buffer._hb = array;
  buffer._offset = 0;
  buffer._mark = -1;
  buffer._position = 0;
  buffer._limit = data.length;
  buffer._capacity = data.length;
  buffer._isReadOnly = 0;
  buffer._bigEndian = 1;
  buffer._direct = 1;

  return buffer;
};

const arrayBytes = (array: JArray, offset: number, size: number): Uint8Array => {
  const typed = array as unknown as TypedArray;

  return new Uint8Array(typed.buffer, typed.byteOffset + offset * size, typed.byteLength - offset * size);
};

const ARRAY_SIZES: Record<string, number> = {
  "[B": 1,
  "[C": 2,
  "[D": 8,
  "[F": 4,
  "[I": 4,
  "[J": 8,
  "[S": 2,
};

const transform = (
  values: Float32Array,
  stride: number,
  count: number,
  matrix: ArrayLike<number>,
  dimensions: number,
  size: number
): void => {
  for (let i = 0; i < count; i++) {
    const at = i * stride;
    const x = values[at];
    const y = values[at + 1];
    const z = dimensions > 2 ? values[at + 2] : 0;
    const w = dimensions > 3 ? values[at + 3] : 1;
    const m = (row: number, column: number): number => matrix[column * size + row];

    if (size === 3) {
      values[at] = x * m(0, 0) + y * m(0, 1) + (dimensions > 2 ? z : 1) * m(0, 2);
      values[at + 1] = x * m(1, 0) + y * m(1, 1) + (dimensions > 2 ? z : 1) * m(1, 2);

      if (dimensions > 2) values[at + 2] = x * m(2, 0) + y * m(2, 1) + z * m(2, 2);
    } else {
      values[at] = x * m(0, 0) + y * m(0, 1) + z * m(0, 2) + w * m(0, 3);
      values[at + 1] = x * m(1, 0) + y * m(1, 1) + z * m(1, 2) + w * m(1, 3);

      if (dimensions > 2) values[at + 2] = x * m(2, 0) + y * m(2, 1) + z * m(2, 2) + w * m(2, 3);

      if (dimensions > 3) values[at + 3] = x * m(3, 0) + y * m(3, 1) + z * m(3, 2) + w * m(3, 3);
    }
  }
};

const floatsOf = (value: unknown, offset: number): Float32Array => {
  if (value instanceof Float32Array) return value.subarray(offset);

  const bytes = bufferBytes(value as JObject);

  return new Float32Array(bytes.buffer, bytes.byteOffset + offset * 4, (bytes.length >> 2) - offset);
};

const find = (
  vertex: Float32Array,
  vertices: Float32Array,
  stride: number,
  count: number,
  epsilon?: number
): bigint => {
  for (let i = 0; i < count; i++) {
    let match = true;

    for (let j = 0; j < stride && match; j++) {
      const difference = Math.abs(vertices[i * stride + j] - vertex[j]);

      match = epsilon === undefined ? difference === 0 : difference <= epsilon;
    }

    if (match) return BigInt(i);
  }

  return -1n;
};

const multiply = (m: Float32Array, values: Float32Array, offset: number, project: boolean, rotate: boolean): void => {
  const x = values[offset];
  const y = values[offset + 1];
  const z = values[offset + 2];
  const w = rotate ? 0 : 1;
  const nx = x * m[0] + y * m[4] + z * m[8] + w * m[12];
  const ny = x * m[1] + y * m[5] + z * m[9] + w * m[13];
  const nz = x * m[2] + y * m[6] + z * m[10] + w * m[14];

  if (project) {
    const inverse = 1 / (x * m[3] + y * m[7] + z * m[11] + m[15]);

    values[offset] = nx * inverse;
    values[offset + 1] = ny * inverse;
    values[offset + 2] = nz * inverse;
  } else {
    values[offset] = nx;
    values[offset + 1] = ny;
    values[offset + 2] = nz;
  }
};

export const bufferNatives = (vm: JVM): NativeTable => {
  const BU = "com/badlogic/gdx/utils/BufferUtils.";
  const M4 = "com/badlogic/gdx/math/Matrix4.";
  const table: NativeTable = {
    [`${BU}clear(Ljava/nio/ByteBuffer;I)V`]: (_t, [buffer, count]) => {
      bufferBytes(buffer as JObject).fill(0, 0, count as number);
    },
    [`${BU}copyJni([FLjava/nio/Buffer;II)V`]: (_t, [src, dst, count, offset]) => {
      const from = arrayBytes(src as JArray, offset as number, 4).subarray(0, (count as number) * 4);

      bufferBytes(dst as JObject).set(from);
    },
    [`${BU}copyJni(Ljava/nio/Buffer;ILjava/nio/Buffer;II)V`]: (_t, [src, srcOffset, dst, dstOffset, count]) => {
      const from = bufferBytes(src as JObject).subarray(srcOffset as number, (srcOffset as number) + (count as number));

      bufferBytes(dst as JObject).set(from, dstOffset as number);
    },
    [`${BU}freeMemory(Ljava/nio/ByteBuffer;)V`]: () => null,
    [`${BU}getBufferAddress(Ljava/nio/Buffer;)J`]: () => 0n,
    [`${BU}newDisposableByteBuffer(I)Ljava/nio/ByteBuffer;`]: (_t, [size]) =>
      newDirectByteBuffer(vm, new Uint8Array(size as number)),
    [`${M4}mulVec([F[FIII)V`]: (_t, [matrix, vectors, offset, count, stride]) => {
      for (let i = 0; i < (count as number); i++) {
        multiply(matrix as Float32Array, vectors as Float32Array, (offset as number) + i * (stride as number), false, false);
      }
    },
    [`${M4}prj([F[FIII)V`]: (_t, [matrix, vectors, offset, count, stride]) => {
      for (let i = 0; i < (count as number); i++) {
        multiply(matrix as Float32Array, vectors as Float32Array, (offset as number) + i * (stride as number), true, false);
      }
    },
    [`${M4}rot([F[FIII)V`]: (_t, [matrix, vectors, offset, count, stride]) => {
      for (let i = 0; i < (count as number); i++) {
        multiply(matrix as Float32Array, vectors as Float32Array, (offset as number) + i * (stride as number), false, true);
      }
    },
  };

  for (const [descriptor, size] of Object.entries(ARRAY_SIZES)) {
    table[`${BU}copyJni(${descriptor}ILjava/nio/Buffer;II)V`] = (_t, [src, srcOffset, dst, dstOffset, count]) => {
      const from = arrayBytes(src as JArray, srcOffset as number, size).subarray(0, count as number);

      bufferBytes(dst as JObject).set(from, dstOffset as number);
    };
  }

  for (const [dimensions, size] of [[2, 3], [3, 3], [2, 4], [3, 4], [4, 4]]) {
    const name = `transformV${dimensions}M${size}Jni`;

    for (const source of ["Ljava/nio/Buffer;", "[F"]) {
      table[`${BU}${name}(${source}II[FI)V`] = (_t, [data, strideBytes, count, matrix, offset]) => {
        const floats = floatsOf(data, (offset as number) >> 2);

        transform(floats, (strideBytes as number) >> 2, count as number, matrix as Float32Array, dimensions, size);
      };
    }
  }

  for (const vertex of ["Ljava/nio/Buffer;", "[F"]) {
    for (const vertices of ["Ljava/nio/Buffer;", "[F"]) {
      for (const epsilon of ["", "F"]) {
        table[`${BU}find(${vertex}II${vertices}II${epsilon})J`] = (_t, args) => {
          const [a, aOffset, stride, b, bOffset, bCount, e] = args as [unknown, number, number, unknown, number, number, number?];

          return find(floatsOf(a, aOffset >> 2), floatsOf(b, bOffset >> 2), stride >> 2, bCount, epsilon ? e : undefined);
        };
      }
    }
  }

  return table;
};
