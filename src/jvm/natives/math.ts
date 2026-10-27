import { d2i, d2l } from "../resolve.ts";
import { type NativeTable } from "../vm.ts";

const rint = (value: number): number => {
  if (!Number.isFinite(value)) return value;

  const floor = Math.floor(value);
  const diff = value - floor;

  if (diff < 0.5) return floor === 0 && value < 0 ? -0 : floor;

  if (diff > 0.5) return floor + 1;

  return floor % 2 === 0 ? floor : floor + 1;
};

const unary: Record<string, (value: number) => number> = {
  acos: Math.acos,
  asin: Math.asin,
  atan: Math.atan,
  cbrt: Math.cbrt,
  ceil: Math.ceil,
  cos: Math.cos,
  cosh: Math.cosh,
  exp: Math.exp,
  expm1: Math.expm1,
  floor: Math.floor,
  IEEEremainder: (value) => value,
  log: Math.log,
  log10: Math.log10,
  log1p: Math.log1p,
  rint,
  sin: Math.sin,
  sinh: Math.sinh,
  sqrt: Math.sqrt,
  tan: Math.tan,
  tanh: Math.tanh,
};

const binary: Record<string, (a: number, b: number) => number> = {
  atan2: Math.atan2,
  hypot: Math.hypot,
  pow: (a, b) => a ** b,
};

const EXACT = new Set(["ceil", "floor", "rint", "sqrt"]);

export const mathNatives = (): NativeTable => {
  const table: NativeTable = {};

  for (const owner of ["java/lang/Math", "java/lang/StrictMath"]) {
    for (const [name, fn] of Object.entries(unary)) {
      if (name === "IEEEremainder") continue;

      if (owner === "java/lang/StrictMath" && !EXACT.has(name)) continue;

      table[`${owner}.${name}(D)D`] = (_t, [value]) => fn(value as number);
    }

    for (const [name, fn] of Object.entries(binary)) {
      if (owner === "java/lang/StrictMath") continue;

      table[`${owner}.${name}(DD)D`] = (_t, [a, b]) => fn(a as number, b as number);
    }

    table[`${owner}.IEEEremainder(DD)D`] = (_t, [a, b]) => {
      const x = a as number;
      const y = b as number;

      return x - y * rint(x / y);
    };
    table[`${owner}.round(F)I`] = (_t, [value]) => d2i(Math.round(value as number));
    table[`${owner}.round(D)J`] = (_t, [value]) => d2l(Math.round(value as number));
    table[`${owner}.random()D`] = () => Math.random();
    table[`${owner}.abs(D)D`] = (_t, [value]) => Math.abs(value as number);
    table[`${owner}.abs(F)F`] = (_t, [value]) => Math.abs(value as number);
    table[`${owner}.max(FF)F`] = (_t, [a, b]) => Math.max(a as number, b as number);
    table[`${owner}.min(FF)F`] = (_t, [a, b]) => Math.min(a as number, b as number);
    table[`${owner}.max(DD)D`] = (_t, [a, b]) => Math.max(a as number, b as number);
    table[`${owner}.min(DD)D`] = (_t, [a, b]) => Math.min(a as number, b as number);
    table[`${owner}.max(II)I`] = (_t, [a, b]) => Math.max(a as number, b as number);
    table[`${owner}.min(II)I`] = (_t, [a, b]) => Math.min(a as number, b as number);
    table[`${owner}.abs(I)I`] = (_t, [value]) => Math.abs(value as number) | 0;
    table[`${owner}.signum(D)D`] = (_t, [value]) => Math.sign(value as number);
    table[`${owner}.signum(F)F`] = (_t, [value]) => Math.sign(value as number);
    table[`${owner}.toDegrees(D)D`] = (_t, [value]) =>
      (value as number) * 57.29577951308232;
    table[`${owner}.toRadians(D)D`] = (_t, [value]) =>
      (value as number) * 0.017453292519943295;
  }

  return table;
};
