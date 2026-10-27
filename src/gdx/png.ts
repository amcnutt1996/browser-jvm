import { unzlibSync } from "fflate";

export type Image = {
  channels: number;
  data: Uint8Array;
  height: number;
  width: number;
};

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

const ADAM7 = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
];

const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

export const isPng = (data: Uint8Array): boolean => SIGNATURE.every((byte, index) => data[index] === byte);

const paeth = (a: number, b: number, c: number): number => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);

  if (pa <= pb && pa <= pc) return a;

  return pb <= pc ? b : c;
};

const unfilter = (
  data: Uint8Array,
  offset: number,
  width: number,
  height: number,
  bpp: number,
  rowBytes: number
): { pixels: Uint8Array; used: number } => {
  const pixels = new Uint8Array(rowBytes * height);
  let at = offset;

  for (let y = 0; y < height; y++) {
    const filter = data[at++];
    const row = y * rowBytes;
    const previous = row - rowBytes;

    for (let x = 0; x < rowBytes; x++) {
      const raw = data[at++];
      const left = x >= bpp ? pixels[row + x - bpp] : 0;
      const up = y > 0 ? pixels[previous + x] : 0;
      const upLeft = y > 0 && x >= bpp ? pixels[previous + x - bpp] : 0;
      let value = raw;

      switch (filter) {
        case 1:
          value = raw + left;
          break;
        case 2:
          value = raw + up;
          break;
        case 3:
          value = raw + ((left + up) >> 1);
          break;
        case 4:
          value = raw + paeth(left, up, upLeft);
          break;
        default:
          break;
      }

      pixels[row + x] = value & 0xff;
    }
  }

  return { pixels, used: at - offset };
};

const sample = (row: Uint8Array, start: number, index: number, depth: number): number => {
  if (depth === 8) return row[start + index];

  if (depth === 16) return (row[start + index * 2] << 8) | row[start + index * 2 + 1];

  const bit = index * depth;
  const byte = row[start + (bit >> 3)];

  return (byte >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
};

export const decodePng = (file: Uint8Array): Image => {
  if (!isPng(file)) throw new Error("Not a PNG file");

  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const chunks: Uint8Array[] = [];
  let width = 0;
  let height = 0;
  let depth = 8;
  let colorType = 6;
  let interlace = 0;
  let palette: Uint8Array | undefined;
  let transparency: Uint8Array | undefined;
  let offset = 8;

  while (offset + 8 <= file.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...file.subarray(offset + 4, offset + 8));
    const body = file.subarray(offset + 8, offset + 8 + length);

    if (type === "IHDR") {
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
      ({ 12: interlace, 8: depth, 9: colorType } = body);
    } else if (type === "PLTE") {
      palette = body;
    } else if (type === "tRNS") {
      transparency = body;
    } else if (type === "IDAT") {
      chunks.push(body);
    } else if (type === "IEND") {
      break;
    }

    offset += 12 + length;
  }

  const compressed = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let position = 0;

  for (const chunk of chunks) {
    compressed.set(chunk, position);
    position += chunk.length;
  }

  const raw = unzlibSync(compressed);
  const sourceChannels = CHANNELS[colorType] ?? 4;
  const bitsPerPixel = sourceChannels * depth;
  const bpp = Math.max(1, bitsPerPixel >> 3);
  const channels =
    colorType === 3 ? (transparency ? 4 : 3) : sourceChannels + (transparency && (colorType === 0 || colorType === 2) ? 1 : 0);
  const data = new Uint8Array(width * height * channels);
  const scale = depth === 16 ? 1 / 257 : depth < 8 && colorType !== 3 ? 255 / ((1 << depth) - 1) : 1;

  const writePixel = (row: Uint8Array, start: number, x: number, target: number): void => {
    if (colorType === 3) {
      const index = sample(row, start, x, depth);

      data[target] = palette?.[index * 3] ?? 0;
      data[target + 1] = palette?.[index * 3 + 1] ?? 0;
      data[target + 2] = palette?.[index * 3 + 2] ?? 0;

      if (channels === 4) data[target + 3] = transparency?.[index] ?? 255;

      return;
    }

    for (let c = 0; c < sourceChannels; c++) {
      data[target + c] = Math.round(sample(row, start, x * sourceChannels + c, depth) * scale);
    }

    if (transparency && !(colorType === 4 || colorType === 6)) {
      let opaque = false;

      for (let c = 0; c < sourceChannels && !opaque; c++) {
        const key = (transparency[c * 2] << 8) | transparency[c * 2 + 1];

        opaque = sample(row, start, x * sourceChannels + c, depth) !== key;
      }

      data[target + sourceChannels] = opaque ? 255 : 0;
    }
  };

  if (interlace === 0) {
    const rowBytes = Math.ceil((width * bitsPerPixel) / 8);
    const { pixels } = unfilter(raw, 0, width, height, bpp, rowBytes);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        writePixel(pixels, y * rowBytes, x, (y * width + x) * channels);
      }
    }
  } else {
    let used = 0;

    for (const [startX, startY, stepX, stepY] of ADAM7) {
      const passWidth = Math.ceil((width - startX) / stepX);
      const passHeight = Math.ceil((height - startY) / stepY);

      if (passWidth <= 0 || passHeight <= 0) continue;

      const rowBytes = Math.ceil((passWidth * bitsPerPixel) / 8);
      const pass = unfilter(raw, used, passWidth, passHeight, bpp, rowBytes);

      used += pass.used;

      for (let y = 0; y < passHeight; y++) {
        for (let x = 0; x < passWidth; x++) {
          const target = ((startY + y * stepY) * width + startX + x * stepX) * channels;

          writePixel(pass.pixels, y * rowBytes, x, target);
        }
      }
    }
  }

  return { channels, data, height, width };
};

// Width and height from a JPEG's frame header, for hosts that cannot decode it.
export const jpegSize = (file: Uint8Array): { height: number; width: number } | undefined => {
  let offset = 2;

  while (offset + 9 < file.length) {
    if (file[offset] !== 0xff) return undefined;

    const marker = file[offset + 1];
    const length = (file[offset + 2] << 8) | file[offset + 3];

    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return {
        height: (file[offset + 5] << 8) | file[offset + 6],
        width: (file[offset + 7] << 8) | file[offset + 8],
      };
    }

    offset += 2 + length;
  }

  return undefined;
};
