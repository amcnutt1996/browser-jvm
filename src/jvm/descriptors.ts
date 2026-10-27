export type MethodType = {
  args: string[];
  argSlots: number;
  ret: string;
};

const cache = new Map<string, MethodType>();

const typeEnd = (descriptor: string, start: number): number => {
  let end = start;

  while (descriptor[end] === "[") end++;

  return descriptor[end] === "L" ? descriptor.indexOf(";", end) + 1 : end + 1;
};

export const parseMethodDescriptor = (descriptor: string): MethodType => {
  const cached = cache.get(descriptor);

  if (cached) return cached;

  const args: string[] = [];
  let argSlots = 0;
  let index = 1;

  while (descriptor[index] !== ")") {
    const end = typeEnd(descriptor, index);
    const type = descriptor.slice(index, end);

    args.push(type);
    argSlots += type === "J" || type === "D" ? 2 : 1;
    index = end;
  }

  const result = { args, argSlots, ret: descriptor.slice(index + 1) };

  cache.set(descriptor, result);

  return result;
};

export const isWide = (type: string): boolean => type === "J" || type === "D";

export const PRIMITIVE_NAMES: Record<string, string> = {
  B: "byte",
  C: "char",
  D: "double",
  F: "float",
  I: "int",
  J: "long",
  S: "short",
  V: "void",
  Z: "boolean",
};

export const descriptorToClassName = (descriptor: string): string =>
  descriptor.startsWith("L") ? descriptor.slice(1, -1) : descriptor;

export const classNameToDescriptor = (name: string): string =>
  name.startsWith("[") || (name.length === 1 && name in PRIMITIVE_NAMES)
    ? name
    : `L${name};`;

export const defaultValue = (descriptor: string): unknown => {
  switch (descriptor[0]) {
    case "L":
    case "[":
      return null;
    case "J":
      return 0n;
    default:
      return 0;
  }
};

export const javaName = (internalName: string): string =>
  internalName.replaceAll("/", ".");

export const internalName = (javaClassName: string): string =>
  javaClassName.replaceAll(".", "/");
