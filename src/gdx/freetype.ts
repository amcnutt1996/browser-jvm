import type * as OpenType from "opentype.js";
import { bufferBytes, newDirectByteBuffer } from "./buffers.ts";
import { type JObject } from "../jvm/types.ts";
import { type JVM, type NativeTable } from "../jvm/vm.ts";

type Point = [number, number];
type Segment = [number, number, number, number];

type Outline = {
  advance: number;
  segments: Segment[];
  xMax: number;
  xMin: number;
  yMax: number;
  yMin: number;
};

type Bitmap = {
  buffer: Uint8Array;
  left: number;
  rows: number;
  top: number;
  width: number;
};

type Face = {
  font: OpenType.Font;
  scale: number;
  size: number;
  slot: Slot;
};

type Slot = {
  bitmap?: Bitmap;
  face: Face;
  linearAdvance: number;
  outline?: Outline;
};

type Glyph = {
  bitmap?: Bitmap;
  outline: Outline;
};

type Stroker = { radius: number };

const FACE_FLAG_SCALABLE = 1;
const FACE_FLAG_SFNT = 8;
const FACE_FLAG_HORIZONTAL = 16;
const FACE_FLAG_KERNING = 64;
const LOAD_RENDER = 4;
const RENDER_MODE_MONO = 2;
const GLYPH_FORMAT_OUTLINE = 1869968492;
const GLYPH_FORMAT_BITMAP = 1651078259;
const PIXEL_MODE_GRAY = 2;

const fixed = (value: number): number => Math.round(value * 64);
const floor64 = (value: number): number => Math.floor(value * 64) & -64;
const ceil64 = (value: number): number => (Math.ceil(value * 64) + 63) & -64;
const round64 = (value: number): number => (Math.round(value * 64) + 32) & -64;

const flatten = (commands: OpenType.PathCommand[]): Segment[] => {
  const segments: Segment[] = [];
  let start: Point = [0, 0];
  let current: Point = [0, 0];
  const lineTo = (x: number, y: number): void => {
    if (x !== current[0] || y !== current[1]) segments.push([current[0], current[1], x, y]);

    current = [x, y];
  };

  for (const command of commands) {
    switch (command.type) {
      case "M":
        if (current[0] !== start[0] || current[1] !== start[1]) lineTo(...start);

        start = [command.x, command.y];
        current = [command.x, command.y];
        break;
      case "L":
        lineTo(command.x, command.y);
        break;
      case "Q": {
        const [x0, y0] = current;
        const steps = Math.max(1, Math.ceil(Math.sqrt(Math.hypot(command.x - x0, command.y - y0) * 2)));

        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const u = 1 - t;

          lineTo(u * u * x0 + 2 * u * t * command.x1 + t * t * command.x, u * u * y0 + 2 * u * t * command.y1 + t * t * command.y);
        }
        break;
      }
      case "C": {
        const [x0, y0] = current;
        const steps = Math.max(1, Math.ceil(Math.sqrt(Math.hypot(command.x - x0, command.y - y0) * 3)));

        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const u = 1 - t;

          lineTo(
            u * u * u * x0 + 3 * u * u * t * command.x1 + 3 * u * t * t * command.x2 + t * t * t * command.x,
            u * u * u * y0 + 3 * u * u * t * command.y1 + 3 * u * t * t * command.y2 + t * t * t * command.y
          );
        }
        break;
      }
      case "Z":
        lineTo(...start);
        break;
      default:
        break;
    }
  }

  if (current[0] !== start[0] || current[1] !== start[1]) lineTo(...start);

  return segments;
};

// Signed-area coverage accumulation, after Raph Levien's font-rs.
const rasterize = (segments: Segment[], width: number, height: number, offsetX: number, offsetY: number): Float32Array => {
  const accumulation = new Float32Array(width * height + 4);

  for (const [ax, ay, bx, by] of segments) {
    let [x0, y0, x1, y1] = [ax - offsetX, ay - offsetY, bx - offsetX, by - offsetY];

    if (y0 === y1) continue;

    let direction = 1;

    if (y0 > y1) {
      direction = -1;
      [x0, y0, x1, y1] = [x1, y1, x0, y0];
    }

    const dxdy = (x1 - x0) / (y1 - y0);
    let x = x0;

    if (y0 < 0) x -= y0 * dxdy;

    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(height, Math.ceil(y1)); y++) {
      const line = y * width;
      const dy = Math.min(y + 1, y1) - Math.max(y, y0);
      const next = x + dxdy * dy;
      const d = dy * direction;
      const [left, right] = x < next ? [x, next] : [next, x];
      const leftFloor = Math.floor(left);
      const leftIndex = Math.max(0, leftFloor);
      const rightIndex = Math.ceil(right);

      if (rightIndex <= leftIndex + 1) {
        const middle = 0.5 * (x + next) - leftFloor;

        accumulation[line + leftIndex] += d - d * middle;
        accumulation[line + leftIndex + 1] += d * middle;
      } else {
        const s = 1 / (right - left);
        const leftFraction = left - leftFloor;
        const a0 = 0.5 * s * (1 - leftFraction) ** 2;
        const rightFraction = right - rightIndex + 1;
        const am = 0.5 * s * rightFraction * rightFraction;

        accumulation[line + leftIndex] += d * a0;

        if (rightIndex === leftIndex + 2) {
          accumulation[line + leftIndex + 1] += d * (1 - a0 - am);
        } else {
          const a1 = s * (1.5 - leftFraction);

          accumulation[line + leftIndex + 1] += d * (a1 - a0);

          for (let xi = leftIndex + 2; xi < rightIndex - 1; xi++) accumulation[line + xi] += d * s;

          const a2 = a1 + (rightIndex - leftIndex - 3) * s;

          accumulation[line + rightIndex - 1] += d * (1 - a2 - am);
        }

        accumulation[line + rightIndex] += d * am;
      }

      x = next;
    }
  }

  const coverage = new Float32Array(width * height);
  let sum = 0;

  for (let i = 0; i < coverage.length; i++) {
    sum += accumulation[i];
    coverage[i] = Math.min(1, Math.abs(sum));
  }

  return coverage;
};

const distanceToSegment = (px: number, py: number, [ax, ay, bx, by]: Segment): number => {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length));

  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

const render = (outline: Outline, mono: boolean, border = 0): Bitmap => {
  const left = Math.floor(outline.xMin - border);
  const right = Math.ceil(outline.xMax + border);
  const top = Math.ceil(outline.yMax + border);
  const bottom = Math.floor(outline.yMin - border);
  const width = Math.max(0, right - left);
  const rows = Math.max(0, top - bottom);
  const buffer = new Uint8Array(width * rows);

  if (width === 0 || rows === 0) return { buffer, left, rows, top, width };

  const segments = outline.segments.map(([ax, ay, bx, by]): Segment => [ax, -ay, bx, -by]);
  const coverage = rasterize(segments, width, rows, left, -top);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < width; x++) {
      let value = coverage[y * width + x];

      if (border > 0 && value < 1) {
        let distance = Infinity;
        const px = left + x + 0.5;
        const py = -top + y + 0.5;

        for (const segment of segments) {
          distance = Math.min(distance, distanceToSegment(px, py, segment));

          if (distance === 0) break;
        }

        value = Math.max(value, Math.min(1, Math.max(0, border + 0.5 - distance)));
      }

      buffer[y * width + x] = mono ? (value >= 0.5 ? 255 : 0) : Math.round(value * 255);
    }
  }

  return { buffer, left, rows, top, width };
};

const setSize = (current: Face, size: number): boolean => {
  current.size = Math.max(1, size);
  current.scale = current.size / current.font.unitsPerEm;

  return true;
};

const hhea = (current: Face): { ascender: number; descender: number; lineGap: number } =>
  current.font.tables.hhea as unknown as { ascender: number; descender: number; lineGap: number };

let opentype: Promise<typeof OpenType> | undefined;

const loadOpenType = (): Promise<typeof OpenType> => {
  opentype ??= import("opentype.js").then(
    (module) => ((module as unknown as { default?: typeof OpenType }).default ?? module)
  );

  return opentype;
};

export const freeTypeNatives = (vm: JVM): NativeTable => {
  const handles = new Map<number, unknown>([[1, "library"]]);
  const objectIds = new WeakMap<object, number>();
  let nextHandle = 2;
  let lastError = 0;

  const handle = (value: object): bigint => {
    let id = objectIds.get(value);

    if (!id) {
      id = nextHandle++;
      handles.set(id, value);
      objectIds.set(value, id);
    }

    return BigInt(id);
  };
  const get = (id: unknown): unknown => handles.get(Number(id));
  const face = (id: unknown): Face => get(id) as Face;
  const views = new WeakMap<object, Record<string, object>>();
  const view = (kind: string, target: object): bigint => {
    let entry = views.get(target);

    if (!entry) {
      entry = {};
      views.set(target, entry);
    }

    entry[kind] ??= { kind, target };

    return handle(entry[kind]);
  };
  const release = (id: unknown): void => {
    const glyph = handles.get(Number(id)) as Glyph | undefined;

    if (glyph?.bitmap) handles.delete(objectIds.get(glyph.bitmap) ?? 0);

    handles.delete(Number(id));
  };
  const target = (id: unknown): unknown => (get(id) as { target: unknown }).target;

  const loadGlyph = (current: Face, glyphIndex: number, flags: number): boolean => {
    const glyph = current.font.glyphs.get(glyphIndex);

    if (!glyph) {
      lastError = 6;

      return false;
    }

    const path = glyph.getPath(0, 0, current.size);
    const segments = flatten(path.commands).map(([ax, ay, bx, by]): Segment => [ax, -ay, bx, -by]);
    const metrics = glyph.getMetrics();
    const {scale} = current;
    const hasPoints = segments.length > 0;

    current.slot.outline = {
      advance: (glyph.advanceWidth ?? 0) * scale,
      segments,
      xMax: hasPoints ? metrics.xMax * scale : 0,
      xMin: hasPoints ? metrics.xMin * scale : 0,
      yMax: hasPoints ? metrics.yMax * scale : 0,
      yMin: hasPoints ? metrics.yMin * scale : 0,
    };
    current.slot.linearAdvance = (glyph.advanceWidth ?? 0) * scale;
    current.slot.bitmap = flags & LOAD_RENDER ? render(current.slot.outline, false) : undefined;

    return true;
  };


  const bitmapBuffers = new WeakMap<Bitmap, JObject>();

  const F = "com/badlogic/gdx/graphics/g2d/freetype/FreeType$";
  const glyphMetric = (id: unknown, read: (outline: Outline) => number): number => {
    const { outline } = target(id) as Slot;

    return outline ? fixed(read(outline)) : 0;
  };
  const sizeMetric = (id: unknown, read: (current: Face) => number): number => read(target(id) as Face);

  return {
    [`${F}Bitmap.getBuffer(J)Ljava/nio/ByteBuffer;`]: (_t, [id]) => {
      const bitmap = (get(id) as Bitmap);
      let buffer = bitmapBuffers.get(bitmap);

      if (!buffer) {
        buffer = newDirectByteBuffer(vm, bitmap.buffer);
        bitmapBuffers.set(bitmap, buffer);
      }

      return buffer;
    },
    [`${F}Bitmap.getNumGray(J)I`]: () => 256,
    [`${F}Bitmap.getPitch(J)I`]: (_t, [id]) => (get(id) as Bitmap).width,
    [`${F}Bitmap.getPixelMode(J)I`]: () => PIXEL_MODE_GRAY,
    [`${F}Bitmap.getRows(J)I`]: (_t, [id]) => (get(id) as Bitmap).rows,
    [`${F}Bitmap.getWidth(J)I`]: (_t, [id]) => (get(id) as Bitmap).width,
    [`${F}Face.doneFace(J)V`]: (_t, [id]) => {
      handles.delete(Number(id));
    },
    [`${F}Face.getAscender(J)I`]: (_t, [id]) => hhea(face(id)).ascender,
    [`${F}Face.getCharIndex(JI)I`]: (_t, [id, code]) => face(id).font.charToGlyphIndex(String.fromCodePoint(code as number)),
    [`${F}Face.getDescender(J)I`]: (_t, [id]) => hhea(face(id)).descender,
    [`${F}Face.getFaceFlags(J)I`]: (_t, [id]) => {
      const { font } = face(id);
      const kerning = font.kerningPairs && Object.keys(font.kerningPairs).length > 0;

      return FACE_FLAG_SCALABLE | FACE_FLAG_SFNT | FACE_FLAG_HORIZONTAL | (kerning ? FACE_FLAG_KERNING : 0);
    },
    [`${F}Face.getGlyph(J)J`]: (_t, [id]) => handle(face(id).slot),
    [`${F}Face.getHeight(J)I`]: (_t, [id]) => {
      const metrics = hhea(face(id));

      return metrics.ascender - metrics.descender + metrics.lineGap;
    },
    [`${F}Face.getKerning(JIII)I`]: (_t, [id, left, right, mode]) => {
      const current = face(id);
      const value = current.font.getKerningValue(left as number, right as number);

      if (mode === 2) return value;

      return mode === 1 ? fixed(value * current.scale) : round64(value * current.scale);
    },
    [`${F}Face.getMaxAdvanceHeight(J)I`]: (_t, [id]) => {
      const metrics = hhea(face(id));

      return metrics.ascender - metrics.descender;
    },
    [`${F}Face.getMaxAdvanceWidth(J)I`]: (_t, [id]) =>
      (face(id).font.tables.hhea as unknown as { advanceWidthMax: number }).advanceWidthMax,
    [`${F}Face.getNumGlyphs(J)I`]: (_t, [id]) => face(id).font.numGlyphs,
    [`${F}Face.getSize(J)J`]: (_t, [id]) => view("size", face(id)),
    [`${F}Face.getStyleFlags(J)I`]: () => 0,
    [`${F}Face.getUnderlinePosition(J)I`]: (_t, [id]) =>
      (face(id).font.tables.post as unknown as { underlinePosition: number }).underlinePosition,
    [`${F}Face.getUnderlineThickness(J)I`]: (_t, [id]) =>
      (face(id).font.tables.post as unknown as { underlineThickness: number }).underlineThickness,
    [`${F}Face.hasKerning(J)Z`]: (_t, [id]) => {
      const { font } = face(id);

      return font.kerningPairs && Object.keys(font.kerningPairs).length > 0 ? 1 : 0;
    },
    [`${F}Face.loadChar(JII)Z`]: (_t, [id, code, flags]) => {
      const current = face(id);

      return loadGlyph(current, current.font.charToGlyphIndex(String.fromCodePoint(code as number)), flags as number) ? 1 : 0;
    },
    [`${F}Face.loadGlyph(JII)Z`]: (_t, [id, index, flags]) => (loadGlyph(face(id), index as number, flags as number) ? 1 : 0),
    [`${F}Face.selectSize(JI)Z`]: () => 0,
    [`${F}Face.setCharSize(JIIII)Z`]: (_t, [id, width, height, horizontalDpi, verticalDpi]) => {
      const points = ((height as number) || (width as number)) / 64;
      const dpi = (verticalDpi as number) || (horizontalDpi as number) || 72;

      return setSize(face(id), (points * dpi) / 72) ? 1 : 0;
    },
    [`${F}Face.setPixelSizes(JII)Z`]: (_t, [id, width, height]) =>
      setSize(face(id), (height as number) || (width as number)) ? 1 : 0,
    [`${F}Glyph.done(J)V`]: (_t, [id]) => release(id),
    [`${F}Glyph.getBitmap(J)J`]: (_t, [id]) => {
      const glyph = (get(id) as Glyph);

      glyph.bitmap ??= render(glyph.outline, false);

      return handle(glyph.bitmap);
    },
    [`${F}Glyph.getLeft(J)I`]: (_t, [id]) => (get(id) as Glyph).bitmap?.left ?? 0,
    [`${F}Glyph.getTop(J)I`]: (_t, [id]) => (get(id) as Glyph).bitmap?.top ?? 0,
    [`${F}Glyph.strokeBorder(JJZ)J`]: (_t, [id, strokerId]) => {
      const glyph = (get(id) as Glyph);
      const stroker = (get(strokerId) as Stroker);
      const stroked: Glyph & { border: number } = {
        border: stroker.radius,
        outline: glyph.outline,
      };

      release(id);

      return handle(stroked);
    },
    [`${F}Glyph.toBitmap(JI)J`]: (_t, [id, mode]) => {
      const glyph = (get(id) as Glyph & { border?: number });

      glyph.bitmap = render(glyph.outline, mode === RENDER_MODE_MONO, glyph.border ?? 0);

      return id;
    },
    [`${F}GlyphMetrics.getHeight(J)I`]: (_t, [id]) => glyphMetric(id, (outline) => outline.yMax - outline.yMin),
    [`${F}GlyphMetrics.getHoriAdvance(J)I`]: (_t, [id]) => glyphMetric(id, (outline) => outline.advance),
    [`${F}GlyphMetrics.getHoriBearingX(J)I`]: (_t, [id]) => glyphMetric(id, (outline) => outline.xMin),
    [`${F}GlyphMetrics.getHoriBearingY(J)I`]: (_t, [id]) => glyphMetric(id, (outline) => outline.yMax),
    [`${F}GlyphMetrics.getVertAdvance(J)I`]: (_t, [id]) => fixed((target(id) as Slot).face.size),
    [`${F}GlyphMetrics.getVertBearingX(J)I`]: () => 0,
    [`${F}GlyphMetrics.getVertBearingY(J)I`]: () => 0,
    [`${F}GlyphMetrics.getWidth(J)I`]: (_t, [id]) => glyphMetric(id, (outline) => outline.xMax - outline.xMin),
    [`${F}GlyphSlot.getAdvanceX(J)I`]: (_t, [id]) => fixed((get(id) as Slot).outline?.advance ?? 0),
    [`${F}GlyphSlot.getAdvanceY(J)I`]: () => 0,
    [`${F}GlyphSlot.getBitmap(J)J`]: (_t, [id]) => {
      const slot = (get(id) as Slot);

      slot.bitmap ??= slot.outline ? render(slot.outline, false) : { buffer: new Uint8Array(0), left: 0, rows: 0, top: 0, width: 0 };

      return handle(slot.bitmap);
    },
    [`${F}GlyphSlot.getBitmapLeft(J)I`]: (_t, [id]) => (get(id) as Slot).bitmap?.left ?? 0,
    [`${F}GlyphSlot.getBitmapTop(J)I`]: (_t, [id]) => (get(id) as Slot).bitmap?.top ?? 0,
    [`${F}GlyphSlot.getFormat(J)I`]: (_t, [id]) => ((get(id) as Slot).bitmap ? GLYPH_FORMAT_BITMAP : GLYPH_FORMAT_OUTLINE),
    [`${F}GlyphSlot.getGlyph(J)J`]: (_t, [id]) => {
      const slot = (get(id) as Slot);
      const glyph: Glyph = {
        outline: slot.outline ?? { advance: 0, segments: [], xMax: 0, xMin: 0, yMax: 0, yMin: 0 },
      };

      return handle(glyph);
    },
    [`${F}GlyphSlot.getLinearHoriAdvance(J)I`]: (_t, [id]) => Math.round((get(id) as Slot).linearAdvance * 65536),
    [`${F}GlyphSlot.getLinearVertAdvance(J)I`]: (_t, [id]) => Math.round((get(id) as Slot).face.size * 65536),
    [`${F}GlyphSlot.getMetrics(J)J`]: (_t, [id]) => view("metrics", (get(id) as Slot)),
    [`${F}GlyphSlot.renderGlyph(JI)Z`]: (_t, [id, mode]) => {
      const slot = (get(id) as Slot);

      if (!slot.outline) return 0;

      slot.bitmap = render(slot.outline, mode === RENDER_MODE_MONO);

      return 1;
    },
    [`${F}Library.doneFreeType(J)V`]: () => null,
    [`${F}Library.newMemoryFace(JLjava/nio/ByteBuffer;II)J`]: {
      *gen(_t, [, buffer, size]) {
        const library = (yield vm.wait(loadOpenType())) as typeof OpenType;
        const bytes = bufferBytes(buffer as JObject).slice(0, size as number);

        try {
          const font = library.parse(bytes.buffer);
          const current = { font, scale: 1, size: font.unitsPerEm } as Face;

          current.slot = { face: current, linearAdvance: 0 };

          return handle(current);
        } catch {
          lastError = 2;

          return 0n;
        }
      },
    },
    [`${F}Library.strokerNew(J)J`]: () => handle({ radius: 0 } satisfies Stroker),
    [`${F}Size.getMetrics(J)J`]: (_t, [id]) => view("sizeMetrics", target(id) as Face),
    [`${F}SizeMetrics.getAscender(J)I`]: (_t, [id]) => sizeMetric(id, (current) => ceil64(hhea(current).ascender * current.scale)),
    [`${F}SizeMetrics.getDescender(J)I`]: (_t, [id]) => sizeMetric(id, (current) => floor64(hhea(current).descender * current.scale)),
    [`${F}SizeMetrics.getHeight(J)I`]: (_t, [id]) =>
      sizeMetric(id, (current) => {
        const metrics = hhea(current);

        return round64((metrics.ascender - metrics.descender + metrics.lineGap) * current.scale);
      }),
    [`${F}SizeMetrics.getMaxAdvance(J)I`]: (_t, [id]) =>
      sizeMetric(id, (current) => round64((current.font.tables.hhea as unknown as { advanceWidthMax: number }).advanceWidthMax * current.scale)),
    [`${F}SizeMetrics.getXppem(J)I`]: (_t, [id]) => sizeMetric(id, (current) => Math.round(current.size)),
    [`${F}SizeMetrics.getXscale(J)I`]: (_t, [id]) => sizeMetric(id, (current) => Math.round(current.scale * 64 * 65536)),
    [`${F}SizeMetrics.getYppem(J)I`]: (_t, [id]) => sizeMetric(id, (current) => Math.round(current.size)),
    [`${F}SizeMetrics.getYscale(J)I`]: (_t, [id]) => sizeMetric(id, (current) => Math.round(current.scale * 64 * 65536)),
    [`${F}Stroker.done(J)V`]: (_t, [id]) => {
      handles.delete(Number(id));
    },
    [`${F}Stroker.set(JIIII)V`]: (_t, [id, radius]) => {
      (get(id) as Stroker).radius = (radius as number) / 64;
    },
    "com/badlogic/gdx/graphics/g2d/freetype/FreeType.getLastErrorCode()I": () => lastError,
    "com/badlogic/gdx/graphics/g2d/freetype/FreeType.initFreeTypeJni()J": () => 1n,
  };
};
