import { newDirectByteBuffer, remainingBytes } from "./buffers.ts";
import { type GdxHost } from "./host.ts";
import { decodePng, isPng, jpegSize } from "./png.ts";
import { bytesOf } from "../jvm/natives/helpers.ts";
import { type JArray, type JObject } from "../jvm/types.ts";
import { type JVM, type NativeTable } from "../jvm/vm.ts";

const ALPHA = 1;
const LUMINANCE_ALPHA = 2;
const RGB888 = 3;
const RGBA8888 = 4;
const RGB565 = 5;
const RGBA4444 = 6;

const BYTES_PER_PIXEL: Record<number, number> = {
  [ALPHA]: 1,
  [LUMINANCE_ALPHA]: 2,
  [RGB565]: 2,
  [RGB888]: 3,
  [RGBA4444]: 2,
  [RGBA8888]: 4,
};

export type Pixmap = {
  blend: boolean;
  format: number;
  height: number;
  pixels: Uint8Array;
  scale: number;
  width: number;
};

const getPixel = (pixmap: Pixmap, x: number, y: number): number => {
  const { format, pixels } = pixmap;
  const at = (y * pixmap.width + x) * BYTES_PER_PIXEL[format];

  switch (format) {
    case ALPHA:
      return (0xffffff00 | pixels[at]) >>> 0;
    case LUMINANCE_ALPHA:
      return ((pixels[at] << 24) | (pixels[at] << 16) | (pixels[at] << 8) | pixels[at + 1]) >>> 0;
    case RGB888:
      return ((pixels[at] << 24) | (pixels[at + 1] << 16) | (pixels[at + 2] << 8) | 0xff) >>> 0;
    case RGBA8888:
      return ((pixels[at] << 24) | (pixels[at + 1] << 16) | (pixels[at + 2] << 8) | pixels[at + 3]) >>> 0;
    case RGB565: {
      const value = pixels[at] | (pixels[at + 1] << 8);
      const r = Math.trunc((((value & 0xf800) >> 11) * 255) / 31);
      const g = Math.trunc((((value & 0x7e0) >> 5) * 255) / 63);
      const b = Math.trunc(((value & 0x1f) * 255) / 31);

      return ((r << 24) | (g << 16) | (b << 8) | 0xff) >>> 0;
    }
    case RGBA4444: {
      const value = pixels[at] | (pixels[at + 1] << 8);
      const r = ((value & 0xf000) >> 12) * 17;
      const g = ((value & 0xf00) >> 8) * 17;
      const b = ((value & 0xf0) >> 4) * 17;
      const a = (value & 0xf) * 17;

      return ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
    }
    default:
      return 0;
  }
};

const storePixel = (pixmap: Pixmap, x: number, y: number, color: number): void => {
  const { format, pixels } = pixmap;
  const at = (y * pixmap.width + x) * BYTES_PER_PIXEL[format];
  const r = (color >>> 24) & 0xff;
  const g = (color >>> 16) & 0xff;
  const b = (color >>> 8) & 0xff;
  const a = color & 0xff;

  switch (format) {
    case ALPHA:
      pixels[at] = a;
      break;
    case LUMINANCE_ALPHA:
      pixels[at] = Math.trunc(0.2126 * r + 0.7152 * g + 0.0722 * b);
      pixels[at + 1] = a;
      break;
    case RGB888:
      pixels[at] = r;
      pixels[at + 1] = g;
      pixels[at + 2] = b;
      break;
    case RGBA8888:
      pixels[at] = r;
      pixels[at + 1] = g;
      pixels[at + 2] = b;
      pixels[at + 3] = a;
      break;
    case RGB565: {
      const value = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);

      pixels[at] = value & 0xff;
      pixels[at + 1] = value >> 8;
      break;
    }
    case RGBA4444: {
      const value = ((r >> 4) << 12) | ((g >> 4) << 8) | ((b >> 4) << 4) | (a >> 4);

      pixels[at] = value & 0xff;
      pixels[at + 1] = value >> 8;
      break;
    }
    default:
      break;
  }
};

const blend = (src: number, dst: number): number => {
  const srcA = src & 0xff;
  const mix = (shift: number): number => {
    const s = (src >>> shift) & 0xff;
    const d = (dst >>> shift) & 0xff;

    return d + Math.trunc((srcA * (s - d)) / 255);
  };
  const dstA = Math.trunc((1 - (1 - srcA / 255) * (1 - (dst & 0xff) / 255)) * 255);

  return ((mix(24) << 24) | (mix(16) << 16) | (mix(8) << 8) | dstA) >>> 0;
};

const setPixel = (pixmap: Pixmap, x: number, y: number, color: number): void => {
  if (x < 0 || y < 0 || x >= pixmap.width || y >= pixmap.height) return;

  storePixel(pixmap, x, y, pixmap.blend ? blend(color >>> 0, getPixel(pixmap, x, y)) : color);
};

const hline = (pixmap: Pixmap, x1: number, x2: number, y: number, color: number): void => {
  for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) setPixel(pixmap, x, y, color);
};

const drawLine = (pixmap: Pixmap, x0: number, y0: number, x1: number, y1: number, color: number): void => {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  let [x, y] = [x0, y0];

  for (;;) {
    setPixel(pixmap, x, y, color);

    if (x === x1 && y === y1) break;

    const doubled = 2 * error;

    if (doubled >= dy) {
      error += dy;
      x += sx;
    }

    if (doubled <= dx) {
      error += dx;
      y += sy;
    }
  }
};

const circle = (pixmap: Pixmap, cx: number, cy: number, radius: number, color: number, fill: boolean): void => {
  let f = 1 - radius;
  let ddx = 1;
  let ddy = -2 * radius;
  let x = 0;
  let y = radius;
  const plot = (px: number, py: number): void => {
    if (fill) {
      hline(pixmap, cx - px, cx + px, cy + py, color);

      if (py !== 0) hline(pixmap, cx - px, cx + px, cy - py, color);
    } else {
      for (const [ax, ay] of [[px, py], [-px, py], [px, -py], [-px, -py], [py, px], [-py, px], [py, -px], [-py, -px]]) {
        setPixel(pixmap, cx + ax, cy + ay, color);
      }
    }
  };

  if (fill) {
    hline(pixmap, cx - radius, cx + radius, cy, color);
  } else {
    plot(0, radius);
  }

  while (x < y) {
    if (f >= 0) {
      y--;
      ddy += 2;
      f += ddy;

      if (fill && x !== y) {
        hline(pixmap, cx - x, cx + x, cy + y + 1, color);
        hline(pixmap, cx - x, cx + x, cy - y - 1, color);
      }
    }

    x++;
    ddx += 2;
    f += ddx;

    if (fill) {
      hline(pixmap, cx - y, cx + y, cy + x, color);
      hline(pixmap, cx - y, cx + y, cy - x, color);
    } else {
      plot(x, y);
    }
  }
};

const edge = (ax: number, ay: number, bx: number, by: number, y: number): number =>
  by === ay ? ax : ax + ((bx - ax) * (y - ay)) / (by - ay);

const fillTriangle = (pixmap: Pixmap, points: number[], color: number): void => {
  const [[x1, y1], [x2, y2], [x3, y3]] = [
    [points[0], points[1]],
    [points[2], points[3]],
    [points[4], points[5]],
  ].sort((a, b) => a[1] - b[1]);

  for (let y = y1; y <= y3; y++) {
    const long = edge(x1, y1, x3, y3, y);
    const short = y < y2 ? edge(x1, y1, x2, y2, y) : edge(x2, y2, x3, y3, y);

    hline(pixmap, Math.round(Math.min(long, short)), Math.round(Math.max(long, short)), y, color);
  }
};

const drawPixmap = (src: Pixmap, dst: Pixmap, args: number[]): void => {
  const [srcX, srcY, srcWidth, srcHeight, dstX, dstY, dstWidth, dstHeight] = args;
  const sameSize = srcWidth === dstWidth && srcHeight === dstHeight;
  const xRatio = srcWidth / dstWidth;
  const yRatio = srcHeight / dstHeight;

  for (let i = 0; i < dstHeight; i++) {
    const dy = dstY + i;

    if (dy < 0 || dy >= dst.height) continue;

    for (let j = 0; j < dstWidth; j++) {
      const dx = dstX + j;

      if (dx < 0 || dx >= dst.width) continue;

      let color: number;

      if (sameSize || dst.scale === 0) {
        const sx = srcX + (sameSize ? j : Math.trunc(j * xRatio));
        const sy = srcY + (sameSize ? i : Math.trunc(i * yRatio));

        if (sx < 0 || sy < 0 || sx >= src.width || sy >= src.height) continue;

        color = getPixel(src, sx, sy);
      } else {
        const fx = srcX + j * xRatio;
        const fy = srcY + i * yRatio;
        const x0 = Math.trunc(fx);
        const y0 = Math.trunc(fy);

        if (x0 < 0 || y0 < 0 || x0 >= src.width || y0 >= src.height) continue;

        const x1 = Math.min(x0 + 1, src.width - 1);
        const y1 = Math.min(y0 + 1, src.height - 1);
        const wx = fx - x0;
        const wy = fy - y0;
        const corners = [getPixel(src, x0, y0), getPixel(src, x1, y0), getPixel(src, x0, y1), getPixel(src, x1, y1)];
        const weights = [(1 - wx) * (1 - wy), wx * (1 - wy), (1 - wx) * wy, wx * wy];
        let value = 0;

        for (const shift of [24, 16, 8, 0]) {
          const channel = corners.reduce((sum, corner, index) => sum + ((corner >>> shift) & 0xff) * weights[index], 0);

          value = (value | (Math.min(255, Math.round(channel)) << shift)) >>> 0;
        }

        color = value;
      }

      storePixel(dst, dx, dy, dst.blend ? blend(color, getPixel(dst, dx, dy)) : color);
    }
  }
};

export const pixmapNatives =
  (host: GdxHost) =>
  (vm: JVM): NativeTable => {
    const pixmaps = new Map<number, Pixmap>();
    let nextId = 1;
    let failure = "";
    const P = "com/badlogic/gdx/graphics/g2d/Gdx2DPixmap.";
    const get = (id: unknown): Pixmap => {
      const pixmap = pixmaps.get(Number(id));

      if (!pixmap) vm.throwNew("com/badlogic/gdx/utils/GdxRuntimeException", "Pixmap already disposed");

      return pixmap;
    };
    const create = (nativeData: unknown, pixmap: Pixmap): JObject => {
      const id = nextId++;
      const data = nativeData as BigInt64Array;

      pixmaps.set(id, pixmap);
      data[0] = BigInt(id);
      data[1] = BigInt(pixmap.width);
      data[2] = BigInt(pixmap.height);
      data[3] = BigInt(pixmap.format);

      return newDirectByteBuffer(vm, pixmap.pixels);
    };
    const decode = function* decode(file: Uint8Array): Generator<ReturnType<JVM["wait"]>, Pixmap | undefined, unknown> {
      if (isPng(file)) {
        const image = decodePng(file);

        return { blend: true, format: image.channels, height: image.height, pixels: image.data, scale: 1, width: image.width };
      }

      const size = jpegSize(file);

      if (!size) {
        failure = "unknown image type";

        return undefined;
      }

      const decoded = host.decodeImage
        ? ((yield vm.wait(host.decodeImage(new Uint8Array(file)))) as Awaited<ReturnType<NonNullable<GdxHost["decodeImage"]>>>)
        : undefined;
      const pixels = new Uint8Array(size.width * size.height * 3).fill(128);

      if (decoded) {
        for (let i = 0; i < size.width * size.height; i++) {
          pixels[i * 3] = decoded.data[i * 4];
          pixels[i * 3 + 1] = decoded.data[i * 4 + 1];
          pixels[i * 3 + 2] = decoded.data[i * 4 + 2];
        }
      }

      return { blend: true, format: RGB888, height: size.height, pixels, scale: 1, width: size.width };
    };
    const load = function* load(nativeData: unknown, file: Uint8Array): Generator<ReturnType<JVM["wait"]>, JObject | null, unknown> {
      let pixmap: Pixmap | undefined;

      try {
        pixmap = yield* decode(file);
      } catch (error) {
        failure = error instanceof Error ? error.message : String(error);
      }

      return pixmap ? create(nativeData, pixmap) : null;
    };

    return {
      [`${P}clear(JI)V`]: (_t, [id, color]) => {
        const pixmap = get(id);

        for (let y = 0; y < pixmap.height; y++) {
          for (let x = 0; x < pixmap.width; x++) storePixel(pixmap, x, y, color as number);
        }
      },
      [`${P}drawCircle(JIIII)V`]: (_t, [id, x, y, radius, color]) =>
        circle(get(id), x as number, y as number, radius as number, color as number, false),
      [`${P}drawLine(JIIIII)V`]: (_t, [id, x0, y0, x1, y1, color]) =>
        drawLine(get(id), x0 as number, y0 as number, x1 as number, y1 as number, color as number),
      [`${P}drawPixmap(JJIIIIIIII)V`]: (_t, [src, dst, ...args]) => drawPixmap(get(src), get(dst), args as number[]),
      [`${P}drawRect(JIIIII)V`]: (_t, [id, x, y, width, height, color]) => {
        const pixmap = get(id);
        const [left, top, w, h] = [x, y, width, height] as number[];

        hline(pixmap, left, left + w - 1, top, color as number);
        hline(pixmap, left, left + w - 1, top + h - 1, color as number);

        for (let row = top + 1; row < top + h - 1; row++) {
          setPixel(pixmap, left, row, color as number);
          setPixel(pixmap, left + w - 1, row, color as number);
        }
      },
      [`${P}fillCircle(JIIII)V`]: (_t, [id, x, y, radius, color]) =>
        circle(get(id), x as number, y as number, radius as number, color as number, true),
      [`${P}fillRect(JIIIII)V`]: (_t, [id, x, y, width, height, color]) => {
        const pixmap = get(id);

        for (let row = y as number; row < (y as number) + (height as number); row++) {
          if (row < 0 || row >= pixmap.height) continue;

          hline(pixmap, Math.max(0, x as number), Math.min(pixmap.width - 1, (x as number) + (width as number) - 1), row, color as number);
        }
      },
      [`${P}fillTriangle(JIIIIIII)V`]: (_t, [id, ...rest]) => {
        const values = rest as number[];

        fillTriangle(get(id), values.slice(0, 6), values[6]);
      },
      [`${P}free(J)V`]: (_t, [id]) => {
        pixmaps.delete(Number(id));
      },
      [`${P}getFailureReason()Ljava/lang/String;`]: () => failure,
      [`${P}getPixel(JII)I`]: (_t, [id, x, y]) => {
        const pixmap = get(id);

        if ((x as number) < 0 || (y as number) < 0 || (x as number) >= pixmap.width || (y as number) >= pixmap.height) return 0;

        return getPixel(pixmap, x as number, y as number) | 0;
      },
      [`${P}load([J[BII)Ljava/nio/ByteBuffer;`]: {
        *gen(_t, [nativeData, buffer, offset, length]) {
          const bytes = bytesOf(buffer as JArray).subarray(offset as number, (offset as number) + (length as number));

          return yield* load(nativeData, bytes);
        },
      },
      [`${P}loadByteBuffer([JLjava/nio/ByteBuffer;II)Ljava/nio/ByteBuffer;`]: {
        *gen(_t, [nativeData, buffer, offset, length]) {
          const bytes = remainingBytes(buffer as JObject).subarray(offset as number, (offset as number) + (length as number));

          return yield* load(nativeData, bytes);
        },
      },
      [`${P}newPixmap([JIII)Ljava/nio/ByteBuffer;`]: (_t, [nativeData, width, height, format]) =>
        create(nativeData, {
          blend: true,
          format: format as number,
          height: height as number,
          pixels: new Uint8Array((width as number) * (height as number) * (BYTES_PER_PIXEL[format as number] ?? 4)),
          scale: 1,
          width: width as number,
        }),
      [`${P}setBlend(JI)V`]: (_t, [id, mode]) => {
        get(id).blend = mode !== 0;
      },
      [`${P}setPixel(JIII)V`]: (_t, [id, x, y, color]) => setPixel(get(id), x as number, y as number, color as number),
      [`${P}setScale(JI)V`]: (_t, [id, scale]) => {
        get(id).scale = scale as number;
      },
    };
  };
