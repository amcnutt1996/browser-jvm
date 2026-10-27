import {
  CONSTANT_InvokeDynamic,
  CONSTANT_MethodHandle,
  type ConstantPoolEntry,
  type MethodHandleRef,
} from "./classfile.ts";
import { parseMethodDescriptor } from "./descriptors.ts";
import { createLambdaFactory } from "./lambda.ts";
import {
  javaDoubleToString,
  javaFloatToString,
} from "./numbers.ts";
import {
  InternalError,
  type JClass,
  type JObject,
  type JThread,
} from "./types.ts";
import { type JVM } from "./vm.ts";

export type CallSite = {
  argTypes: string[];
  create?: (args: unknown[]) => unknown;
  format?: (args: unknown[], converted: boolean) => null | string;
};

const BOXES: Record<string, string> = {
  "java/lang/Boolean": "Z",
  "java/lang/Byte": "B",
  "java/lang/Character": "C",
  "java/lang/Double": "D",
  "java/lang/Float": "F",
  "java/lang/Integer": "I",
  "java/lang/Long": "J",
  "java/lang/Short": "S",
};

export const primitiveToString = (type: string, value: unknown): string => {
  switch (type) {
    case "Z":
      return value ? "true" : "false";
    case "C":
      return String.fromCharCode(value as number);
    case "F":
      return javaFloatToString(value as number);
    case "D":
      return javaDoubleToString(value as number);
    default:
      return String(value);
  }
};

export const quickToString = (value: unknown): string | undefined => {
  if (value === null) return "null";

  if (typeof value === "string") return value;

  const { $cls } = value as JObject;
  const box = $cls && BOXES[$cls.name];

  return box ? primitiveToString(box, (value as JObject)._value) : undefined;
};

const makeFormat = (
  recipe: string,
  constants: unknown[],
  argTypes: string[]
): CallSite["format"] => {
  const pieces: (number | string)[] = [];
  let literal = "";
  let argIndex = 0;
  let constantIndex = 0;

  for (const char of recipe) {
    if (char === "\u0001") {
      if (literal) pieces.push(literal);

      literal = "";
      pieces.push(argIndex++);
    } else if (char === "\u0002") {
      literal += String(constants[constantIndex++]);
    } else {
      literal += char;
    }
  }

  if (literal) pieces.push(literal);

  return (args, converted) => {
    let result = "";

    for (const piece of pieces) {
      if (typeof piece === "string") {
        result += piece;
        continue;
      }

      const type = argTypes[piece];
      const value = args[piece];

      if (!type.startsWith("L") && !type.startsWith("[")) {
        result += primitiveToString(type, value);
      } else if (converted) {
        result +=
          value === null || value === undefined ? "null" : (value as string);
      } else {
        const text = quickToString(value);

        if (text === undefined) return null;

        result += text;
      }
    }

    return result;
  };
};

const constantValue = (
  vm: JVM,
  cls: JClass,
  entry: ConstantPoolEntry
): unknown => {
  switch (entry?.tag) {
    case 3:
    case 4:
    case 5:
    case 6:
    case 8:
      return entry.value;
    case 7:
      return vm.loadClass(entry.value, cls.loader);
    default:
      return entry;
  }
};

let lambdaCount = 0;

export const bootstrapIndy = (
  vm: JVM,
  thread: JThread,
  cls: JClass,
  index: number
): CallSite => {
  const entry = cls.cf?.constantPool[index];

  if (entry?.tag !== CONSTANT_InvokeDynamic) {
    throw new InternalError(`Bad invokedynamic constant at ${index}`);
  }

  if (entry.value.resolved) return entry.value.resolved as CallSite;

  const cf = cls.cf as NonNullable<JClass["cf"]>;
  const bootstrap = cf.bootstrapMethods[entry.value.bootstrapIndex];
  const handle = cf.constantPool[bootstrap.methodRef];

  if (handle?.tag !== CONSTANT_MethodHandle) {
    throw new InternalError("Bad bootstrap method handle");
  }

  const { ref } = handle.value;
  const type = parseMethodDescriptor(entry.value.descriptor);
  const staticArgs = bootstrap.args.map((arg) => cf.constantPool[arg]);
  let site: CallSite;

  if (
    ref.className === "java/lang/invoke/StringConcatFactory" &&
    ref.name === "makeConcatWithConstants"
  ) {
    site = {
      argTypes: type.args,
      format: makeFormat(
        (staticArgs[0] as { value: string }).value,
        staticArgs.slice(1).map((arg) => constantValue(vm, cls, arg)),
        type.args
      ),
    };
  } else if (
    ref.className === "java/lang/invoke/StringConcatFactory" &&
    ref.name === "makeConcat"
  ) {
    site = {
      argTypes: type.args,
      format: makeFormat("\u0001".repeat(type.args.length), [], type.args),
    };
  } else if (
    ref.className === "java/lang/invoke/LambdaMetafactory" &&
    (ref.name === "metafactory" || ref.name === "altMetafactory")
  ) {
    const samType = (staticArgs[0] as { value: string }).value;
    const impl = (staticArgs[1] as { value: MethodHandleRef }).value;
    const iface = vm.loadClass(type.ret.slice(1, -1), cls.loader);
    const markers: JClass[] = [];
    const bridges: string[] = [];

    if (ref.name === "altMetafactory") {
      const flags = (staticArgs[3] as { value: number }).value;
      let next = 4;

      if (flags & 1) markers.push(vm.loadClass("java/io/Serializable"));

      if (flags & 2) {
        const count = (staticArgs[next++] as { value: number }).value;

        for (let i = 0; i < count; i++) {
          markers.push(
            vm.loadClass((staticArgs[next++] as { value: string }).value, cls.loader)
          );
        }
      }

      if (flags & 4) {
        const count = (staticArgs[next++] as { value: number }).value;

        for (let i = 0; i < count; i++) {
          bridges.push((staticArgs[next++] as { value: string }).value);
        }
      }
    }

    lambdaCount++;
    site = {
      argTypes: type.args,
      create: createLambdaFactory(
        vm,
        thread,
        `${cls.name}$$Lambda$${lambdaCount}`,
        cls,
        iface,
        entry.value.name,
        samType,
        impl,
        type.args.length,
        markers,
        bridges
      ),
    };
  } else {
    throw new InternalError(
      `Unsupported invokedynamic bootstrap ${ref.className}.${ref.name}`
    );
  }

  entry.value.resolved = site;

  return site;
};

export const methodTypeConstant = (
  vm: JVM,
  _cls: JClass,
  _entry: ConstantPoolEntry
): never =>
  vm.throwNew(
    "java/lang/UnsupportedOperationException",
    "MethodType constants are not supported"
  );

export const methodHandleConstant = (
  vm: JVM,
  _cls: JClass,
  _entry: ConstantPoolEntry
): never =>
  vm.throwNew(
    "java/lang/UnsupportedOperationException",
    "MethodHandle constants are not supported"
  );

export const bootstrapDynamicConstant = (
  vm: JVM,
  _thread: JThread,
  _cls: JClass,
  _entry: ConstantPoolEntry
): never =>
  vm.throwNew(
    "java/lang/UnsupportedOperationException",
    "Dynamic constants are not supported"
  );
