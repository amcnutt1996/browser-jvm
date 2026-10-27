declare module "pako/lib/zlib/zstream.js" {
  export default class ZStream {
    public adler: number;

    public avail_in: number;

    public avail_out: number;

    public input: null | Uint8Array;

    public msg: string;

    public next_in: number;

    public next_out: number;

    public output: null | Uint8Array;
  }
}

declare module "pako/lib/zlib/inflate.js" {
  import type ZStream from "pako/lib/zlib/zstream.js";

  const inflate: {
    inflate: (strm: ZStream, flush: number) => number;
    inflateInit2: (strm: ZStream, windowBits: number) => number;
    inflateSetDictionary: (strm: ZStream, dictionary: Uint8Array) => number;
  };
  export default inflate;
}

declare module "pako/lib/zlib/deflate.js" {
  import type ZStream from "pako/lib/zlib/zstream.js";

  const deflate: {
    deflate: (strm: ZStream, flush: number) => number;
    deflateInit2: (
      strm: ZStream,
      level: number,
      method: number,
      windowBits: number,
      memLevel: number,
      strategy: number
    ) => number;
    deflateSetDictionary: (strm: ZStream, dictionary: Uint8Array) => number;
  };
  export default deflate;
}

declare module "pako/lib/zlib/crc32.js" {
  const crc32: (crc: number, buf: Uint8Array, len: number, pos: number) => number;
  export default crc32;
}

declare module "pako/lib/zlib/adler32.js" {
  const adler32: (adler: number, buf: Uint8Array, len: number, pos: number) => number;
  export default adler32;
}
