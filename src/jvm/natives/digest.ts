import {
  bytesOf,
  newByteArray,
} from "./helpers.ts";
import { type JArray } from "../types.ts";
import { type JVM, type NativeTable } from "../vm.ts";

const pad = (data: Uint8Array, littleEndian: boolean): DataView => {
  const length = Math.ceil((data.length + 9) / 64) * 64;
  const padded = new Uint8Array(length);

  padded.set(data);
  padded[data.length] = 0x80;

  const view = new DataView(padded.buffer);
  const bits = BigInt(data.length) * 8n;

  view.setBigUint64(length - 8, bits, littleEndian);

  return view;
};

const rotl = (x: number, n: number): number => (x << n) | (x >>> (32 - n));

const MD5_S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
const MD5_K = Array.from({ length: 64 }, (_, i) =>
  Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) | 0
);

const md5 = (data: Uint8Array): Uint8Array => {
  const view = pad(data, true);
  const h = [0x67452301, 0xefcdab89 | 0, 0x98badcfe | 0, 0x10325476];

  for (let block = 0; block < view.byteLength; block += 64) {
    let [a, b, c, d] = h;

    for (let i = 0; i < 64; i++) {
      let f: number;
      let g: number;

      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }

      const next = d;

      d = c;
      c = b;
      b =
        (b +
          rotl(
            (a + f + MD5_K[i] + view.getInt32(block + g * 4, true)) | 0,
            MD5_S[(i >> 4) * 4 + (i % 4)]
          )) |
        0;
      a = next;
    }

    h[0] = (h[0] + a) | 0;
    h[1] = (h[1] + b) | 0;
    h[2] = (h[2] + c) | 0;
    h[3] = (h[3] + d) | 0;
  }

  const out = new DataView(new ArrayBuffer(16));

  h.forEach((value, i) => out.setInt32(i * 4, value, true));

  return new Uint8Array(out.buffer);
};

const sha1 = (data: Uint8Array): Uint8Array => {
  const view = pad(data, false);
  const h = [0x67452301, 0xefcdab89 | 0, 0x98badcfe | 0, 0x10325476, 0xc3d2e1f0 | 0];
  const w = new Int32Array(80);

  for (let block = 0; block < view.byteLength; block += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getInt32(block + i * 4);

    for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);

    let [a, b, c, d, e] = h;

    for (let i = 0; i < 80; i++) {
      const [f, k] =
        i < 20
          ? [(b & c) | (~b & d), 0x5a827999]
          : i < 40
            ? [b ^ c ^ d, 0x6ed9eba1]
            : i < 60
              ? [(b & c) | (b & d) | (c & d), 0x8f1bbcdc | 0]
              : [b ^ c ^ d, 0xca62c1d6 | 0];
      const temp = (rotl(a, 5) + f + e + k + w[i]) | 0;

      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = temp;
    }

    h[0] = (h[0] + a) | 0;
    h[1] = (h[1] + b) | 0;
    h[2] = (h[2] + c) | 0;
    h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0;
  }

  const out = new DataView(new ArrayBuffer(20));

  h.forEach((value, i) => out.setInt32(i * 4, value));

  return new Uint8Array(out.buffer);
};

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
].map((value) => value | 0);

const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));

const sha256 = (data: Uint8Array): Uint8Array => {
  const view = pad(data, false);
  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ].map((value) => value | 0);
  const w = new Int32Array(64);

  for (let block = 0; block < view.byteLength; block += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getInt32(block + i * 4);

    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);

      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }

    let [a, b, c, d, e, f, g, hh] = h;

    for (let i = 0; i < 64; i++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + s1 + ch + SHA256_K[i] + w[i]) | 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;

      hh = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    [a, b, c, d, e, f, g, hh].forEach((value, i) => {
      h[i] = (h[i] + value) | 0;
    });
  }

  const out = new DataView(new ArrayBuffer(32));

  h.forEach((value, i) => out.setInt32(i * 4, value));

  return new Uint8Array(out.buffer);
};

export const digestNatives = (vm: JVM): NativeTable => ({
  "java/security/MessageDigest.compute(Ljava/lang/String;[B)[B": (_t, [algorithm, data]) => {
    const bytes = bytesOf(data as JArray);
    const hash =
      algorithm === "MD5" ? md5(bytes) : algorithm === "SHA-1" ? sha1(bytes) : sha256(bytes);

    return newByteArray(vm, hash);
  },
  "java/security/SecureRandom.fill([B)V": (_t, [bytes]) => {
    const target = bytesOf(bytes as JArray);

    for (let offset = 0; offset < target.length; offset += 65536) {
      crypto.getRandomValues(target.subarray(offset, offset + 65536) as Uint8Array<ArrayBuffer>);
    }
  },
});
