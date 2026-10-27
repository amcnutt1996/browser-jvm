import adler32 from "pako/lib/zlib/adler32.js";
import crc32 from "pako/lib/zlib/crc32.js";
import zlibDeflate from "pako/lib/zlib/deflate.js";
import zlibInflate from "pako/lib/zlib/inflate.js";
import ZStream from "pako/lib/zlib/zstream.js";
import { bytesOf } from "./helpers.ts";
import { type JArray, type JObject } from "../types.ts";
import { type JVM, type NativeTable } from "../vm.ts";

const Z_OK = 0;
const Z_STREAM_END = 1;
const Z_NEED_DICT = 2;
const Z_BUF_ERROR = -5;

const run = (
  self: JObject,
  stream: ZStream,
  output: JArray,
  offset: number,
  length: number,
  step: (strm: ZStream) => number
): [number, number] => {
  const input = bytesOf(self._input as JArray);
  const start = self._inputPos as number;

  stream.input = input;
  stream.next_in = start;
  stream.avail_in = (self._inputLim as number) - start;
  stream.output = bytesOf(output).subarray(offset, offset + length);
  stream.next_out = 0;
  stream.avail_out = length;

  const result = step(stream);
  const consumed = stream.next_in - start;
  const produced = length - stream.avail_out;

  self._inputPos = start + consumed;
  self._bytesRead = (self._bytesRead as bigint) + BigInt(consumed);
  self._bytesWritten = (self._bytesWritten as bigint) + BigInt(produced);
  stream.input = null;
  stream.output = null;

  return [result, produced];
};

export const zipNatives = (vm: JVM): NativeTable => ({
  "java/util/zip/Adler32.update0(I[BII)I": (_t, [value, bytes, offset, length]) =>
    adler32(
      value as number,
      bytesOf(bytes as JArray),
      length as number,
      offset as number
    ) | 0,
  "java/util/zip/CRC32.update0(I[BII)I": (_t, [value, bytes, offset, length]) =>
    crc32(
      value as number,
      bytesOf(bytes as JArray),
      length as number,
      offset as number
    ) | 0,
  "java/util/zip/Deflater.deflate0([BIII)I": (_t, [self, output, offset, length, flush]) => {
    const deflater = self as JObject;
    const [result, produced] = run(
      deflater,
      deflater._stream as ZStream,
      output as JArray,
      offset as number,
      length as number,
      (strm) => zlibDeflate.deflate(strm, flush as number)
    );

    if (result === Z_STREAM_END) deflater._finished = 1;

    return produced;
  },
  "java/util/zip/Deflater.getAdler()I": (_t, [self]) =>
    ((self as JObject)._stream as ZStream).adler | 0,
  "java/util/zip/Deflater.init(IIZ)V": (_t, [self, level, strategy, nowrap]) => {
    const stream = new ZStream();

    zlibDeflate.deflateInit2(
      stream,
      level as number,
      8,
      nowrap ? -15 : 15,
      8,
      strategy as number
    );
    (self as JObject)._stream = stream;
  },
  "java/util/zip/Deflater.params0(II)V": (_t, [self, level, strategy]) => {
    const stream = (self as JObject)._stream as ZStream & {
      state: { level: number; strategy: number };
    };

    stream.state.level = level === -1 ? 6 : (level as number);
    stream.state.strategy = strategy as number;
  },
  "java/util/zip/Deflater.setDictionary0([BII)V": (_t, [self, dictionary, offset, length]) => {
    zlibDeflate.deflateSetDictionary(
      (self as JObject)._stream as ZStream,
      bytesOf(dictionary as JArray).slice(
        offset as number,
        (offset as number) + (length as number)
      )
    );
  },
  "java/util/zip/Inflater.getAdler()I": (_t, [self]) =>
    ((self as JObject)._stream as ZStream).adler | 0,
  "java/util/zip/Inflater.inflate0([BII)I": (_t, [self, output, offset, length]) => {
    const inflater = self as JObject;
    const stream = inflater._stream as ZStream;
    const [result, produced] = run(
      inflater,
      stream,
      output as JArray,
      offset as number,
      length as number,
      (strm) => zlibInflate.inflate(strm, 0)
    );

    inflater._pendingOutput =
      result === Z_OK && stream.avail_out === 0 && produced > 0 ? 1 : 0;

    if (result === Z_STREAM_END) inflater._finished = 1;
    else if (result === Z_NEED_DICT) inflater._needDict = 1;
    else if (result !== Z_OK && result !== Z_BUF_ERROR) {
      vm.throwNew(
        "java/util/zip/DataFormatException",
        stream.msg || "invalid data"
      );
    }

    return produced;
  },
  "java/util/zip/Inflater.init(Z)V": (_t, [self, nowrap]) => {
    const stream = new ZStream();

    zlibInflate.inflateInit2(stream, nowrap ? -15 : 15);
    (self as JObject)._stream = stream;
  },
  "java/util/zip/Inflater.setDictionary0([BII)V": (_t, [self, dictionary, offset, length]) => {
    const result = zlibInflate.inflateSetDictionary(
      (self as JObject)._stream as ZStream,
      bytesOf(dictionary as JArray).slice(
        offset as number,
        (offset as number) + (length as number)
      )
    );

    if (result !== Z_OK) vm.throwNew("java/lang/IllegalArgumentException");
  },
});
