import {
  bytesOf,
  charsToString,
  checkIndex,
  checkRange,
  isJavaWhitespace,
  newByteArray,
  stringArray,
  stringToChars,
} from "./helpers.ts";
import {
  javaDoubleToString,
  javaFloatToString,
} from "../numbers.ts";
import { type JArray, type JObject } from "../types.ts";
import { type JVM, type NativeTable } from "../vm.ts";

const canonicalCharset = (name: string): string | undefined => {
  const key = name.toUpperCase().replaceAll("_", "-");

  if (["UTF-8", "UTF8"].includes(key)) return "UTF-8";

  if (
    ["8859-1", "ISO-8859-1", "ISO-LATIN-1", "ISO8859-1", "L1", "LATIN1"].includes(
      key
    )
  ) {
    return "ISO-8859-1";
  }

  if (["646", "ASCII", "ISO646-US", "US-ASCII"].includes(key)) {
    return "US-ASCII";
  }

  if (["UNICODE", "UTF-16", "UTF16"].includes(key)) return "UTF-16";

  if (["UNICODEBIGUNMARKED", "UTF-16BE", "UTF16BE", "X-UTF-16BE"].includes(key)) {
    return "UTF-16BE";
  }

  if (["UNICODELITTLEUNMARKED", "UTF-16LE", "UTF16LE", "X-UTF-16LE"].includes(key)) {
    return "UTF-16LE";
  }

  if (["CP1252", "WINDOWS-1252"].includes(key)) return "windows-1252";

  return undefined;
};

const utf8Decoder = new TextDecoder("utf-8");
const utf8Encoder = new TextEncoder();

export const decodeBytes = (
  vm: JVM,
  data: Uint8Array,
  charset: string
): string => {
  const name = canonicalCharset(charset);

  switch (name) {
    case "UTF-8":
      return utf8Decoder.decode(data);
    case "ISO-8859-1":
      return charsToString(data);
    case "US-ASCII": {
      const codes = Array.from(data, (byte) => (byte < 0x80 ? byte : 0xfffd));

      return charsToString(codes);
    }
    case "UTF-16":
      if (data[0] === 0xff && data[1] === 0xfe) {
        return new TextDecoder("utf-16le").decode(data.subarray(2));
      }

      return new TextDecoder("utf-16be").decode(
        data[0] === 0xfe && data[1] === 0xff ? data.subarray(2) : data
      );
    case "UTF-16BE":
      return new TextDecoder("utf-16be").decode(data);
    case "UTF-16LE":
      return new TextDecoder("utf-16le").decode(data);
    case "windows-1252":
      return new TextDecoder("windows-1252").decode(data);
    default:
      return vm.throwNew("java/io/UnsupportedEncodingException", charset);
  }
};

export const encodeString = (
  vm: JVM,
  value: string,
  charset: string
): Uint8Array => {
  const name = canonicalCharset(charset);

  switch (name) {
    case "UTF-8":
      return utf8Encoder.encode(value);
    case "ISO-8859-1":
    case "windows-1252":
    case "US-ASCII": {
      const limit = name === "US-ASCII" ? 0x80 : 0x100;
      const out = new Uint8Array(value.length);

      for (let i = 0; i < value.length; i++) {
        const code = value.charCodeAt(i);

        out[i] = code < limit ? code : 0x3f;
      }

      return out;
    }
    case "UTF-16":
    case "UTF-16BE":
    case "UTF-16LE": {
      const bom = name === "UTF-16" ? 2 : 0;
      const out = new Uint8Array(bom + value.length * 2);
      const little = name === "UTF-16LE";

      if (bom) {
        out[0] = 0xfe;
        out[1] = 0xff;
      }

      for (let i = 0; i < value.length; i++) {
        const code = value.charCodeAt(i);

        out[bom + i * 2 + (little ? 1 : 0)] = code >> 8;
        out[bom + i * 2 + (little ? 0 : 1)] = code & 0xff;
      }

      return out;
    }
    default:
      return vm.throwNew("java/io/UnsupportedEncodingException", charset);
  }
};

const isLatin1 = (value: string): boolean => {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) > 0xff) return false;
  }

  return true;
};

const SPLIT_META = ".$|()[{^?*+\\";

const fastSplitDelimiter = (regex: string): string | undefined => {
  if (regex.length === 1 && !SPLIT_META.includes(regex)) return regex;

  if (
    regex.length === 2 &&
    regex.startsWith("\\") &&
    !/[\dA-Z]/i.test(regex[1])
  ) {
    return regex[1];
  }

  return undefined;
};

const javaSplit = (value: string, delimiter: string, limit: number): string[] => {
  if (value.length === 0) return [""];

  const parts: string[] = [];
  let start = 0;
  let index = value.indexOf(delimiter);

  const maxParts = limit <= 0 ? Infinity : limit - 1;

  while (index >= 0 && parts.length < maxParts) {
    parts.push(value.slice(start, index));
    start = index + delimiter.length;
    index = value.indexOf(delimiter, start);
  }

  if (parts.length === 0) return [value];

  parts.push(value.slice(start));

  if (limit === 0) {
    while (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
  }

  return parts;
};

const compareStrings = (a: string, b: string): number => {
  const length = Math.min(a.length, b.length);

  for (let i = 0; i < length; i++) {
    const diff = a.charCodeAt(i) - b.charCodeAt(i);

    if (diff !== 0) return diff;
  }

  return a.length - b.length;
};

const foldCase = (code: number): number => {
  const upper = String.fromCharCode(code).toUpperCase();

  return upper.length === 1
    ? upper.toLowerCase().charCodeAt(0)
    : String.fromCharCode(code).toLowerCase().charCodeAt(0);
};

const compareIgnoreCase = (a: string, b: string): number => {
  const length = Math.min(a.length, b.length);

  for (let i = 0; i < length; i++) {
    let c1 = a.charCodeAt(i);
    let c2 = b.charCodeAt(i);

    if (c1 !== c2) {
      c1 = foldCase(c1);
      c2 = foldCase(c2);

      if (c1 !== c2) return c1 - c2;
    }
  }

  return a.length - b.length;
};

const regionMatches = (
  value: string,
  ignoreCase: boolean,
  toffset: number,
  other: string,
  ooffset: number,
  length: number
): boolean => {
  if (
    ooffset < 0 ||
    toffset < 0 ||
    toffset > value.length - length ||
    ooffset > other.length - length
  ) {
    return false;
  }

  for (let i = 0; i < length; i++) {
    const c1 = value.charCodeAt(toffset + i);
    const c2 = other.charCodeAt(ooffset + i);

    if (c1 !== c2 && (!ignoreCase || foldCase(c1) !== foldCase(c2))) {
      return false;
    }
  }

  return true;
};

const charString = (code: number): string =>
  code < 0x10000 ? String.fromCharCode(code) : String.fromCodePoint(code);

const javaTrim = (value: string): string => {
  let start = 0;
  let end = value.length;

  while (start < end && value.charCodeAt(start) <= 0x20) start++;

  while (end > start && value.charCodeAt(end - 1) <= 0x20) end--;

  return value.slice(start, end);
};

const javaStrip = (value: string, leading: boolean, trailing: boolean): string => {
  let start = 0;
  let end = value.length;

  if (leading) {
    while (start < end && isJavaWhitespace(value.charCodeAt(start))) start++;
  }

  if (trailing) {
    while (end > start && isJavaWhitespace(value.charCodeAt(end - 1))) end--;
  }

  return value.slice(start, end);
};

const codePointCount = (value: string, begin: number, end: number): number => {
  let count = 0;

  for (let i = begin; i < end; i++) {
    const code = value.charCodeAt(i);

    if (code >= 0xd800 && code <= 0xdbff && i + 1 < end) {
      const next = value.charCodeAt(i + 1);

      if (next >= 0xdc00 && next <= 0xdfff) i++;
    }

    count++;
  }

  return count;
};

const offsetByCodePoints = (value: string, index: number, offset: number): number => {
  let x = index;

  if (offset >= 0) {
    for (let i = 0; i < offset; i++) {
      const code = value.charCodeAt(x++);

      if (code >= 0xd800 && code <= 0xdbff && x < value.length) {
        const next = value.charCodeAt(x);

        if (next >= 0xdc00 && next <= 0xdfff) x++;
      }
    }
  } else {
    for (let i = offset; i < 0; i++) {
      const code = value.charCodeAt(--x);

      if (code >= 0xdc00 && code <= 0xdfff && x > 0) {
        const previous = value.charCodeAt(x - 1);

        if (previous >= 0xd800 && previous <= 0xdbff) x--;
      }
    }
  }

  return x;
};

const codePointBefore = (value: string, index: number): number => {
  const low = value.charCodeAt(index - 1);

  if (low >= 0xdc00 && low <= 0xdfff && index >= 2) {
    const high = value.charCodeAt(index - 2);

    if (high >= 0xd800 && high <= 0xdbff) {
      return (high - 0xd800) * 0x400 + (low - 0xdc00) + 0x10000;
    }
  }

  return low;
};

const charsArg = (array: JArray | null): Uint16Array =>
  array as unknown as Uint16Array;

const builderValue = (self: unknown): string =>
  (self as JObject)._value as string;

const setBuilderValue = (self: unknown, text: string): unknown => {
  (self as JObject)._value = text;

  return self;
};

const builderNatives = (vm: JVM, className: string): NativeTable => {
  const type = `L${className};`;
  const value = builderValue;
  const set = setBuilderValue;
  const prefix = `${className}.`;

  return {
    [`${prefix}append([C)${type}`]: (_t, [self, chars]) =>
      set(self, value(self) + charsToString(charsArg(chars as JArray))),
    [`${prefix}append([CII)${type}`]: (_t, [self, chars, offset, length]) => {
      const array = charsArg(chars as JArray);
      const start = offset as number;
      const end = start + (length as number);

      if (start < 0 || end > array.length || end < start) {
        vm.throwNew("java/lang/IndexOutOfBoundsException");
      }

      return set(self, value(self) + charsToString(array, start, end));
    },
    [`${prefix}append(C)${type}`]: (_t, [self, code]) =>
      set(self, value(self) + String.fromCharCode(code as number)),
    [`${prefix}append(D)${type}`]: (_t, [self, number]) =>
      set(self, value(self) + javaDoubleToString(number as number)),
    [`${prefix}append(F)${type}`]: (_t, [self, number]) =>
      set(self, value(self) + javaFloatToString(number as number)),
    [`${prefix}append(I)${type}`]: (_t, [self, number]) =>
      set(self, value(self) + String(number)),
    [`${prefix}append(J)${type}`]: (_t, [self, number]) =>
      set(self, value(self) + String(number)),
    [`${prefix}append(Ljava/lang/String;)${type}`]: (_t, [self, text]) =>
      set(self, value(self) + (text === null ? "null" : (text as string))),
    [`${prefix}append(Z)${type}`]: (_t, [self, flag]) =>
      set(self, value(self) + (flag ? "true" : "false")),
    [`${prefix}appendCodePoint(I)${type}`]: (_t, [self, code]) =>
      set(self, value(self) + String.fromCodePoint(code as number)),
    [`${prefix}capacity()I`]: (_t, [self]) => value(self).length + 16,
    [`${prefix}charAt(I)C`]: (_t, [self, index]) => {
      const text = value(self);

      checkIndex(vm, index as number, text.length);

      return text.charCodeAt(index as number);
    },
    [`${prefix}codePointAt(I)I`]: (_t, [self, index]) => {
      const text = value(self);

      checkIndex(vm, index as number, text.length);

      return text.codePointAt(index as number);
    },
    [`${prefix}codePointBefore(I)I`]: (_t, [self, index]) => {
      const text = value(self);

      checkIndex(vm, (index as number) - 1, text.length);

      return codePointBefore(text, index as number);
    },
    [`${prefix}codePointCount(II)I`]: (_t, [self, begin, end]) => {
      const text = value(self);

      checkRange(vm, begin as number, end as number, text.length);

      return codePointCount(text, begin as number, end as number);
    },
    [`${prefix}delete(II)${type}`]: (_t, [self, start, end]) => {
      const text = value(self);
      const from = start as number;
      const to = Math.min(end as number, text.length);

      checkRange(vm, from, to, text.length);

      return set(self, text.slice(0, from) + text.slice(to));
    },
    [`${prefix}deleteCharAt(I)${type}`]: (_t, [self, index]) => {
      const text = value(self);

      checkIndex(vm, index as number, text.length);

      return set(
        self,
        text.slice(0, index as number) + text.slice((index as number) + 1)
      );
    },
    [`${prefix}getChars(II[CI)V`]: (_t, [self, begin, end, dst, dstBegin]) => {
      const text = value(self);

      checkRange(vm, begin as number, end as number, text.length);

      const array = charsArg(dst as JArray);

      if ((dstBegin as number) + (end as number) - (begin as number) > array.length) {
        vm.throwNew("java/lang/ArrayIndexOutOfBoundsException");
      }

      for (let i = begin as number; i < (end as number); i++) {
        array[(dstBegin as number) + i - (begin as number)] = text.charCodeAt(i);
      }
    },
    [`${prefix}indexOf(Ljava/lang/String;)I`]: (_t, [self, text]) =>
      value(self).indexOf(text as string),
    [`${prefix}indexOf(Ljava/lang/String;I)I`]: (_t, [self, text, from]) =>
      value(self).indexOf(text as string, from as number),
    [`${prefix}insert(I[C)${type}`]: (_t, [self, index, chars]) => {
      const text = value(self);
      const at = index as number;

      checkRange(vm, at, text.length, text.length);

      return set(
        self,
        text.slice(0, at) + charsToString(charsArg(chars as JArray)) + text.slice(at)
      );
    },
    [`${prefix}insert(I[CII)${type}`]: (_t, [self, index, chars, offset, length]) => {
      const text = value(self);
      const at = index as number;

      checkRange(vm, at, text.length, text.length);

      return set(
        self,
        text.slice(0, at) +
          charsToString(
            charsArg(chars as JArray),
            offset as number,
            (offset as number) + (length as number)
          ) +
          text.slice(at)
      );
    },
    [`${prefix}insert(IC)${type}`]: (_t, [self, index, code]) => {
      const text = value(self);
      const at = index as number;

      checkRange(vm, at, text.length, text.length);

      return set(
        self,
        text.slice(0, at) + String.fromCharCode(code as number) + text.slice(at)
      );
    },
    [`${prefix}insert(ILjava/lang/String;)${type}`]: (_t, [self, index, insert]) => {
      const text = value(self);
      const at = index as number;

      checkRange(vm, at, text.length, text.length);

      return set(
        self,
        text.slice(0, at) + (insert === null ? "null" : (insert as string)) + text.slice(at)
      );
    },
    [`${prefix}lastIndexOf(Ljava/lang/String;)I`]: (_t, [self, text]) =>
      value(self).lastIndexOf(text as string),
    [`${prefix}lastIndexOf(Ljava/lang/String;I)I`]: (_t, [self, text, from]) =>
      (from as number) < 0 ? -1 : value(self).lastIndexOf(text as string, from as number),
    [`${prefix}length()I`]: (_t, [self]) => value(self).length,
    [`${prefix}offsetByCodePoints(II)I`]: (_t, [self, index, offset]) =>
      offsetByCodePoints(value(self), index as number, offset as number),
    [`${prefix}replace(IILjava/lang/String;)${type}`]: (
      _t,
      [self, start, end, text]
    ) => {
      const current = value(self);
      const from = start as number;

      checkRange(vm, from, Math.min(end as number, current.length), current.length);

      return set(
        self,
        current.slice(0, from) +
          (text as string) +
          current.slice(Math.min(end as number, current.length))
      );
    },
    [`${prefix}reverse()${type}`]: (_t, [self]) =>
      set(self, [...value(self)].reverse().join("")),
    [`${prefix}setCharAt(IC)V`]: (_t, [self, index, code]) => {
      const text = value(self);

      checkIndex(vm, index as number, text.length);
      set(
        self,
        text.slice(0, index as number) +
          String.fromCharCode(code as number) +
          text.slice((index as number) + 1)
      );
    },
    [`${prefix}setLength(I)V`]: (_t, [self, length]) => {
      const text = value(self);
      const size = length as number;

      if (size < 0) {
        vm.throwNew(
          "java/lang/StringIndexOutOfBoundsException",
          `String index out of range: ${size}`
        );
      }

      set(
        self,
        size <= text.length ? text.slice(0, size) : text.padEnd(size, "\0")
      );
    },
    [`${prefix}substring(I)Ljava/lang/String;`]: (_t, [self, start]) => {
      const text = value(self);

      checkRange(vm, start as number, text.length, text.length);

      return text.slice(start as number);
    },
    [`${prefix}substring(II)Ljava/lang/String;`]: (_t, [self, start, end]) => {
      const text = value(self);

      checkRange(vm, start as number, end as number, text.length);

      return text.slice(start as number, end as number);
    },
    [`${prefix}toString()Ljava/lang/String;`]: (_t, [self]) => value(self),
  };
};

const charsetName = (charset: unknown): string =>
  ((charset as JObject)._name as string | undefined) ?? "UTF-8";

export const stringNatives = (vm: JVM): NativeTable => {
  const S = "java/lang/String.";
  const fromBytes = (
    bytes: JArray,
    offset: number,
    length: number,
    charset: string
  ): string => {
    const data = bytesOf(bytes);

    if (offset < 0 || length < 0 || offset + length > data.length) {
      vm.throwNew(
        "java/lang/StringIndexOutOfBoundsException",
        `offset ${offset}, count ${length}, length ${data.length}`
      );
    }

    return decodeBytes(vm, data.subarray(offset, offset + length), charset);
  };

  return {
    ...builderNatives(vm, "java/lang/StringBuilder"),
    ...builderNatives(vm, "java/lang/StringBuffer"),
    [`${S}<init>()V`]: () => "",
    [`${S}<init>([B)V`]: (_t, [, bytes]) =>
      fromBytes(bytes as JArray, 0, (bytes as JArray).length, "UTF-8"),
    [`${S}<init>([BB)V`]: (_t, [, bytes, coder]) => {
      const data = bytesOf(bytes as JArray);

      return coder === 0
        ? charsToString(data)
        : new TextDecoder("utf-16le").decode(data);
    },
    [`${S}<init>([BI)V`]: (_t, [, bytes, hibyte]) =>
      charsToString(
        Array.from(
          bytesOf(bytes as JArray),
          (byte) => (((hibyte as number) & 0xff) << 8) | byte
        )
      ),
    [`${S}<init>([BII)V`]: (_t, [, bytes, offset, length]) =>
      fromBytes(bytes as JArray, offset as number, length as number, "UTF-8"),
    [`${S}<init>([BIII)V`]: (_t, [, bytes, hibyte, offset, count]) =>
      charsToString(
        Array.from(
          bytesOf(bytes as JArray).subarray(
            offset as number,
            (offset as number) + (count as number)
          ),
          (byte) => (((hibyte as number) & 0xff) << 8) | byte
        )
      ),
    [`${S}<init>([BIILjava/lang/String;)V`]: (_t, [, bytes, offset, length, name]) =>
      fromBytes(bytes as JArray, offset as number, length as number, name as string),
    [`${S}<init>([BIILjava/nio/charset/Charset;)V`]: (
      _t,
      [, bytes, offset, length, charset]
    ) =>
      fromBytes(
        bytes as JArray,
        offset as number,
        length as number,
        charsetName(charset)
      ),
    [`${S}<init>([BLjava/lang/String;)V`]: (_t, [, bytes, name]) =>
      fromBytes(bytes as JArray, 0, (bytes as JArray).length, name as string),
    [`${S}<init>([BLjava/nio/charset/Charset;)V`]: (_t, [, bytes, charset]) =>
      fromBytes(bytes as JArray, 0, (bytes as JArray).length, charsetName(charset)),
    [`${S}<init>([C)V`]: (_t, [, chars]) => charsToString(charsArg(chars as JArray)),
    [`${S}<init>([CII)V`]: (_t, [, chars, offset, count]) => {
      const array = charsArg(chars as JArray);
      const start = offset as number;
      const end = start + (count as number);

      if (start < 0 || (count as number) < 0 || end > array.length) {
        vm.throwNew(
          "java/lang/StringIndexOutOfBoundsException",
          `Range [${start}, ${start} + ${String(count)}) out of bounds for length ${array.length}`
        );
      }

      return charsToString(array, start, end);
    },
    [`${S}<init>([III)V`]: (_t, [, codePoints, offset, count]) =>
      String.fromCodePoint(
        ...(codePoints as Int32Array).subarray(
          offset as number,
          (offset as number) + (count as number)
        )
      ),
    [`${S}<init>(Ljava/lang/String;)V`]: (_t, [, original]) => original,
    [`${S}<init>(Ljava/lang/StringBuffer;)V`]: (_t, [, buffer]) =>
      (buffer as JObject)._value,
    [`${S}<init>(Ljava/lang/StringBuilder;)V`]: (_t, [, builder]) =>
      (builder as JObject)._value,
    [`${S}charAt(I)C`]: (_t, [self, index]) => {
      const text = self as string;

      checkIndex(vm, index as number, text.length);

      return text.charCodeAt(index as number);
    },
    [`${S}codePointArray()[I`]: (_t, [self]) => {
      const points = Array.from(self as string, (char) => char.codePointAt(0) as number);
      const array = vm.newArray("I", points.length);

      (array as unknown as Int32Array).set(points);

      return array;
    },
    [`${S}codePointAt(I)I`]: (_t, [self, index]) => {
      const text = self as string;

      checkIndex(vm, index as number, text.length);

      return text.codePointAt(index as number);
    },
    [`${S}codePointBefore(I)I`]: (_t, [self, index]) => {
      const text = self as string;

      checkIndex(vm, (index as number) - 1, text.length);

      return codePointBefore(text, index as number);
    },
    [`${S}codePointCount(II)I`]: (_t, [self, begin, end]) => {
      const text = self as string;

      checkRange(vm, begin as number, end as number, text.length);

      return codePointCount(text, begin as number, end as number);
    },
    [`${S}coder()B`]: (_t, [self]) => (isLatin1(self as string) ? 0 : 1),
    [`${S}compareTo(Ljava/lang/String;)I`]: (_t, [self, other]) => {
      if (other === null) vm.throwNew("java/lang/NullPointerException");

      return compareStrings(self as string, other as string);
    },
    [`${S}compareToIgnoreCase(Ljava/lang/String;)I`]: (_t, [self, other]) =>
      compareIgnoreCase(self as string, other as string),
    [`${S}concat(Ljava/lang/String;)Ljava/lang/String;`]: (_t, [self, other]) =>
      (self as string) + (other as string),
    [`${S}endsWith(Ljava/lang/String;)Z`]: (_t, [self, suffix]) =>
      (self as string).endsWith(suffix as string) ? 1 : 0,
    [`${S}equals(Ljava/lang/Object;)Z`]: (_t, [self, other]) =>
      self === other ? 1 : 0,
    [`${S}equalsIgnoreCase(Ljava/lang/String;)Z`]: (_t, [self, other]) =>
      other !== null &&
      (self as string).length === (other as string).length &&
      regionMatches(self as string, true, 0, other as string, 0, (self as string).length)
        ? 1
        : 0,
    [`${S}getBytes(II[BI)V`]: (_t, [self, begin, end, dst, dstBegin]) => {
      const text = self as string;
      const array = dst as Int8Array;

      for (let i = begin as number; i < (end as number); i++) {
        array[(dstBegin as number) + i - (begin as number)] = text.charCodeAt(i);
      }
    },
    [`${S}getBytes0(Ljava/lang/String;)[B`]: (_t, [self, name]) =>
      newByteArray(vm, encodeString(vm, self as string, name as string)),
    [`${S}getChars(II[CI)V`]: (_t, [self, begin, end, dst, dstBegin]) => {
      const text = self as string;
      const array = charsArg(dst as JArray);

      checkRange(vm, begin as number, end as number, text.length);

      if (
        (dstBegin as number) < 0 ||
        (dstBegin as number) + (end as number) - (begin as number) > array.length
      ) {
        vm.throwNew(
          "java/lang/ArrayIndexOutOfBoundsException",
          `Index ${String(dstBegin)} out of bounds for length ${array.length}`
        );
      }

      for (let i = begin as number; i < (end as number); i++) {
        array[(dstBegin as number) + i - (begin as number)] = text.charCodeAt(i);
      }
    },
    [`${S}hashCode()I`]: (_t, [self]) => vm.stringHash(self as string),
    [`${S}indexOf(I)I`]: (_t, [self, code]) =>
      (self as string).indexOf(charString(code as number)),
    [`${S}indexOf(II)I`]: (_t, [self, code, from]) =>
      (self as string).indexOf(charString(code as number), Math.max(0, from as number)),
    [`${S}indexOf(Ljava/lang/String;)I`]: (_t, [self, text]) =>
      (self as string).indexOf(text as string),
    [`${S}indexOf(Ljava/lang/String;I)I`]: (_t, [self, text, from]) =>
      (self as string).indexOf(text as string, Math.max(0, from as number)),
    [`${S}intern()Ljava/lang/String;`]: (_t, [self]) => self,
    [`${S}isBlank()Z`]: (_t, [self]) =>
      javaStrip(self as string, true, false).length === 0 ? 1 : 0,
    [`${S}isEmpty()Z`]: (_t, [self]) => ((self as string).length === 0 ? 1 : 0),
    [`${S}lastIndexOf(I)I`]: (_t, [self, code]) =>
      (self as string).lastIndexOf(charString(code as number)),
    [`${S}lastIndexOf(II)I`]: (_t, [self, code, from]) =>
      (from as number) < 0
        ? -1
        : (self as string).lastIndexOf(charString(code as number), from as number),
    [`${S}lastIndexOf(Ljava/lang/String;)I`]: (_t, [self, text]) =>
      (self as string).lastIndexOf(text as string),
    [`${S}lastIndexOf(Ljava/lang/String;I)I`]: (_t, [self, text, from]) =>
      (from as number) < 0
        ? -1
        : (self as string).lastIndexOf(text as string, from as number),
    [`${S}length()I`]: (_t, [self]) => (self as string).length,
    [`${S}offsetByCodePoints(II)I`]: (_t, [self, index, offset]) =>
      offsetByCodePoints(self as string, index as number, offset as number),
    [`${S}regionMatches(ILjava/lang/String;II)Z`]: (
      _t,
      [self, toffset, other, ooffset, length]
    ) =>
      regionMatches(
        self as string,
        false,
        toffset as number,
        other as string,
        ooffset as number,
        length as number
      )
        ? 1
        : 0,
    [`${S}regionMatches(ZILjava/lang/String;II)Z`]: (
      _t,
      [self, ignoreCase, toffset, other, ooffset, length]
    ) =>
      regionMatches(
        self as string,
        Boolean(ignoreCase),
        toffset as number,
        other as string,
        ooffset as number,
        length as number
      )
        ? 1
        : 0,
    [`${S}repeat(I)Ljava/lang/String;`]: (_t, [self, count]) => {
      if ((count as number) < 0) {
        vm.throwNew(
          "java/lang/IllegalArgumentException",
          `count is negative: ${String(count)}`
        );
      }

      return (self as string).repeat(count as number);
    },
    [`${S}replace(CC)Ljava/lang/String;`]: (_t, [self, from, to]) =>
      (self as string)
        .split(String.fromCharCode(from as number))
        .join(String.fromCharCode(to as number)),
    [`${S}replace0(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;`]: (
      _t,
      [self, target, replacement]
    ) => (self as string).replaceAll(target as string, () => replacement as string),
    [`${S}splitFast(Ljava/lang/String;I)[Ljava/lang/String;`]: (
      _t,
      [self, regex, limit]
    ) => {
      const delimiter = fastSplitDelimiter(regex as string);

      return delimiter === undefined
        ? null
        : stringArray(vm, javaSplit(self as string, delimiter, limit as number));
    },
    [`${S}startsWith(Ljava/lang/String;)Z`]: (_t, [self, prefix]) =>
      (self as string).startsWith(prefix as string) ? 1 : 0,
    [`${S}startsWith(Ljava/lang/String;I)Z`]: (_t, [self, prefix, offset]) =>
      (offset as number) >= 0 &&
      (self as string).startsWith(prefix as string, offset as number)
        ? 1
        : 0,
    [`${S}strip()Ljava/lang/String;`]: (_t, [self]) =>
      javaStrip(self as string, true, true),
    [`${S}stripLeading()Ljava/lang/String;`]: (_t, [self]) =>
      javaStrip(self as string, true, false),
    [`${S}stripTrailing()Ljava/lang/String;`]: (_t, [self]) =>
      javaStrip(self as string, false, true),
    [`${S}substring(I)Ljava/lang/String;`]: (_t, [self, begin]) => {
      const text = self as string;

      checkRange(vm, begin as number, text.length, text.length);

      return text.slice(begin as number);
    },
    [`${S}substring(II)Ljava/lang/String;`]: (_t, [self, begin, end]) => {
      const text = self as string;

      checkRange(vm, begin as number, end as number, text.length);

      return text.slice(begin as number, end as number);
    },
    [`${S}toCharArray()[C`]: (_t, [self]) => stringToChars(vm, self as string),
    [`${S}toLowerCase()Ljava/lang/String;`]: (_t, [self]) =>
      (self as string).toLowerCase(),
    [`${S}toUpperCase()Ljava/lang/String;`]: (_t, [self]) =>
      (self as string).toUpperCase(),
    [`${S}trim()Ljava/lang/String;`]: (_t, [self]) => javaTrim(self as string),
    [`${S}value()[B`]: (_t, [self]) => {
      const text = self as string;

      return newByteArray(
        vm,
        isLatin1(text)
          ? encodeString(vm, text, "ISO-8859-1")
          : encodeString(vm, text, "UTF-16LE")
      );
    },
    [`${S}valueOf([C)Ljava/lang/String;`]: (_t, [chars]) =>
      charsToString(charsArg(chars as JArray)),
    [`${S}valueOf([CII)Ljava/lang/String;`]: (_t, [chars, offset, count]) => {
      const array = charsArg(chars as JArray);
      const start = offset as number;
      const end = start + (count as number);

      if (start < 0 || (count as number) < 0 || end > array.length) {
        vm.throwNew(
          "java/lang/StringIndexOutOfBoundsException",
          `Range [${start}, ${start} + ${String(count)}) out of bounds for length ${array.length}`
        );
      }

      return charsToString(array, start, end);
    },
    [`${S}valueOf(C)Ljava/lang/String;`]: (_t, [code]) =>
      String.fromCharCode(code as number),
    [`${S}valueOf(D)Ljava/lang/String;`]: (_t, [number]) =>
      javaDoubleToString(number as number),
    [`${S}valueOf(F)Ljava/lang/String;`]: (_t, [number]) =>
      javaFloatToString(number as number),
    [`${S}valueOf(I)Ljava/lang/String;`]: (_t, [number]) => String(number),
    [`${S}valueOf(J)Ljava/lang/String;`]: (_t, [number]) => String(number),
  };
};
