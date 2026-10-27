export const ACC_PUBLIC = 0x0001;
export const ACC_PRIVATE = 0x0002;
export const ACC_PROTECTED = 0x0004;
export const ACC_STATIC = 0x0008;
export const ACC_FINAL = 0x0010;
export const ACC_SYNCHRONIZED = 0x0020;
export const ACC_SUPER = 0x0020;
export const ACC_VOLATILE = 0x0040;
export const ACC_BRIDGE = 0x0040;
export const ACC_TRANSIENT = 0x0080;
export const ACC_VARARGS = 0x0080;
export const ACC_NATIVE = 0x0100;
export const ACC_INTERFACE = 0x0200;
export const ACC_ABSTRACT = 0x0400;
export const ACC_STRICT = 0x0800;
export const ACC_SYNTHETIC = 0x1000;
export const ACC_ANNOTATION = 0x2000;
export const ACC_ENUM = 0x4000;

export const CONSTANT_Utf8 = 1;
export const CONSTANT_Integer = 3;
export const CONSTANT_Float = 4;
export const CONSTANT_Long = 5;
export const CONSTANT_Double = 6;
export const CONSTANT_Class = 7;
export const CONSTANT_String = 8;
export const CONSTANT_Fieldref = 9;
export const CONSTANT_Methodref = 10;
export const CONSTANT_InterfaceMethodref = 11;
export const CONSTANT_NameAndType = 12;
export const CONSTANT_MethodHandle = 15;
export const CONSTANT_MethodType = 16;
export const CONSTANT_Dynamic = 17;
export const CONSTANT_InvokeDynamic = 18;
export const CONSTANT_Module = 19;
export const CONSTANT_Package = 20;

export type MemberRef = {
  className: string;
  descriptor: string;
  name: string;
  resolved?: unknown;
};

export type MethodHandleRef = {
  kind: number;
  ref: MemberRef;
  resolved?: unknown;
};

export type DynamicRef = {
  bootstrapIndex: number;
  descriptor: string;
  name: string;
  resolved?: unknown;
};

type TextEntry = {
  resolved?: unknown;
  tag:
    | typeof CONSTANT_Class
    | typeof CONSTANT_MethodType
    | typeof CONSTANT_Module
    | typeof CONSTANT_Package
    | typeof CONSTANT_String
    | typeof CONSTANT_Utf8;
  value: string;
};

type NumberEntry = {
  tag: typeof CONSTANT_Double | typeof CONSTANT_Float | typeof CONSTANT_Integer;
  value: number;
};

type LongEntry = { tag: typeof CONSTANT_Long; value: bigint };

type MemberEntry = {
  tag:
    | typeof CONSTANT_Fieldref
    | typeof CONSTANT_InterfaceMethodref
    | typeof CONSTANT_Methodref;
  value: MemberRef;
};

type MethodHandleEntry = {
  tag: typeof CONSTANT_MethodHandle;
  value: MethodHandleRef;
};

type NameAndTypeEntry = {
  tag: typeof CONSTANT_NameAndType;
  value: [string, string];
};

type DynamicEntry = {
  tag: typeof CONSTANT_Dynamic | typeof CONSTANT_InvokeDynamic;
  value: DynamicRef;
};

export type ConstantPoolEntry =
  | DynamicEntry
  | LongEntry
  | MemberEntry
  | MethodHandleEntry
  | NameAndTypeEntry
  | NumberEntry
  | TextEntry
  | undefined;

export type ExceptionHandler = {
  catchType: string | undefined;
  endPc: number;
  handlerPc: number;
  startPc: number;
};

export type CodeAttribute = {
  code: Uint8Array;
  exceptionTable: ExceptionHandler[];
  lineNumbers: number[];
  maxLocals: number;
  maxStack: number;
};

export type BootstrapMethod = {
  args: number[];
  methodRef: number;
};

export type InnerClass = {
  access: number;
  innerName: string | undefined;
  name: string;
  outerName: string | undefined;
};

export type FieldInfo = {
  access: number;
  annotations?: Uint8Array;
  constantValue?: number;
  descriptor: string;
  name: string;
  signature?: string;
};

export type MethodInfo = {
  access: number;
  annotationDefault?: Uint8Array;
  annotations?: Uint8Array;
  code?: CodeAttribute;
  descriptor: string;
  exceptions: string[];
  name: string;
  parameterAnnotations?: Uint8Array;
  signature?: string;
};

export type ClassFile = {
  access: number;
  annotations?: Uint8Array;
  bootstrapMethods: BootstrapMethod[];
  constantPool: ConstantPoolEntry[];
  enclosingMethod?: { className: string; descriptor?: string; name?: string };
  fields: FieldInfo[];
  innerClasses: InnerClass[];
  interfaces: string[];
  majorVersion: number;
  methods: MethodInfo[];
  minorVersion: number;
  name: string;
  nestHost?: string;
  signature?: string;
  sourceFile?: string;
  superName: string | undefined;
};

export const decodeModifiedUtf8 = (
  bytes: Uint8Array,
  start: number,
  length: number
): string => {
  const end = start + length;
  let ascii = true;

  for (let i = start; i < end; i++) {
    if (bytes[i] >= 0x80) {
      ascii = false;
      break;
    }
  }

  if (ascii) {
    let result = "";

    for (let i = start; i < end; i += 4096) {
      result += String.fromCharCode(
        ...bytes.subarray(i, Math.min(end, i + 4096))
      );
    }

    return result;
  }

  const units: number[] = [];

  for (let i = start; i < end; ) {
    const a = bytes[i++];

    if (a < 0x80) {
      units.push(a);
    } else if ((a & 0xe0) === 0xc0) {
      units.push(((a & 0x1f) << 6) | (bytes[i++] & 0x3f));
    } else {
      const b = bytes[i++];
      const c = bytes[i++];

      units.push(((a & 0x0f) << 12) | ((b & 0x3f) << 6) | (c & 0x3f));
    }
  }

  let result = "";

  for (let i = 0; i < units.length; i += 4096) {
    result += String.fromCharCode(...units.slice(i, i + 4096));
  }

  return result;
};

export class ClassFormatError extends Error {
  public override name = "ClassFormatError";
}

export const parseClassFile = (bytes: Uint8Array): ClassFile => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  const u1 = (): number => bytes[offset++];
  const u2 = (): number => {
    const value = view.getUint16(offset);

    offset += 2;

    return value;
  };
  const u4 = (): number => {
    const value = view.getUint32(offset);

    offset += 4;

    return value;
  };

  if (u4() !== 0xcafebabe) throw new ClassFormatError("Bad magic number");

  const minorVersion = u2();
  const majorVersion = u2();
  const poolCount = u2();
  const raw: [number, number, number][] = [];
  const utf8: (string | undefined)[] = [];
  const constantPool: ConstantPoolEntry[] = Array.from({ length: poolCount });

  for (let i = 1; i < poolCount; i++) {
    const tag = u1();

    switch (tag) {
      case CONSTANT_Utf8: {
        const length = u2();

        utf8[i] = decodeModifiedUtf8(bytes, offset, length);
        constantPool[i] = { tag, value: utf8[i] as string };
        offset += length;
        break;
      }
      case CONSTANT_Integer:
        constantPool[i] = { tag, value: view.getInt32(offset) };
        offset += 4;
        break;
      case CONSTANT_Float:
        constantPool[i] = { tag, value: view.getFloat32(offset) };
        offset += 4;
        break;
      case CONSTANT_Long:
        constantPool[i] = { tag, value: view.getBigInt64(offset) };
        offset += 8;
        i++;
        break;
      case CONSTANT_Double:
        constantPool[i] = { tag, value: view.getFloat64(offset) };
        offset += 8;
        i++;
        break;
      case CONSTANT_Class:
      case CONSTANT_String:
      case CONSTANT_MethodType:
      case CONSTANT_Module:
      case CONSTANT_Package:
        raw[i] = [tag, u2(), 0];
        break;
      case CONSTANT_Fieldref:
      case CONSTANT_Methodref:
      case CONSTANT_InterfaceMethodref:
      case CONSTANT_NameAndType:
      case CONSTANT_Dynamic:
      case CONSTANT_InvokeDynamic:
        raw[i] = [tag, u2(), u2()];
        break;
      case CONSTANT_MethodHandle:
        raw[i] = [tag, u1(), u2()];
        break;
      default:
        throw new ClassFormatError(`Bad constant pool tag ${tag} at ${i}`);
    }
  }

  const text = (index: number): string => {
    const value = utf8[index];

    if (value === undefined) {
      throw new ClassFormatError(`Expected Utf8 at ${index}`);
    }

    return value;
  };
  const nameAndType = (index: number): [string, string] => {
    const [, nameIndex, typeIndex] = raw[index];

    return [text(nameIndex), text(typeIndex)];
  };
  const memberRef = (index: number): MemberRef => {
    const [, classIndex, natIndex] = raw[index];
    const [name, descriptor] = nameAndType(natIndex);

    return { className: text(raw[classIndex][1]), descriptor, name };
  };

  for (let i = 1; i < poolCount; i++) {
    const entry = raw[i];

    if (!entry) continue;

    const [tag, a, b] = entry;

    switch (tag) {
      case CONSTANT_Class:
      case CONSTANT_String:
      case CONSTANT_MethodType:
      case CONSTANT_Module:
      case CONSTANT_Package:
        constantPool[i] = { tag, value: text(a) };
        break;
      case CONSTANT_NameAndType:
        constantPool[i] = { tag, value: nameAndType(i) };
        break;
      case CONSTANT_Fieldref:
      case CONSTANT_Methodref:
      case CONSTANT_InterfaceMethodref:
        constantPool[i] = { tag, value: memberRef(i) };
        break;
      case CONSTANT_Dynamic:
      case CONSTANT_InvokeDynamic: {
        const [name, descriptor] = nameAndType(b);

        constantPool[i] = {
          tag,
          value: { bootstrapIndex: a, descriptor, name },
        };
        break;
      }
      case CONSTANT_MethodHandle:
        constantPool[i] = { tag, value: { kind: a, ref: memberRef(b) } };
        break;
      default:
        break;
    }
  }

  const className = (index: number): string | undefined =>
    index === 0 ? undefined : text(raw[index][1]);
  const access = u2();
  const name = className(u2()) as string;
  const superName = className(u2());
  const interfaces = Array.from(
    { length: u2() },
    () => className(u2()) as string
  );
  const classFile: ClassFile = {
    access,
    bootstrapMethods: [],
    constantPool,
    fields: [],
    innerClasses: [],
    interfaces,
    majorVersion,
    methods: [],
    minorVersion,
    name,
    superName,
  };
  const attributes = (
    visit: (attributeName: string, end: number) => void
  ): void => {
    const count = u2();

    for (let i = 0; i < count; i++) {
      const attributeName = text(u2());
      const length = u4();
      const end = offset + length;

      visit(attributeName, end);
      offset = end;
    }
  };
  const slice = (end: number): Uint8Array => bytes.slice(offset, end);
  const readField = (): FieldInfo => {
    const fieldAccess = u2();
    const fieldName = text(u2());
    const field: FieldInfo = {
      access: fieldAccess,
      descriptor: text(u2()),
      name: fieldName,
    };

    attributes((attributeName, end) => {
      if (attributeName === "ConstantValue") field.constantValue = u2();
      else if (attributeName === "Signature") field.signature = text(u2());
      else if (attributeName === "RuntimeVisibleAnnotations") {
        field.annotations = slice(end);
      }
    });

    return field;
  };
  const readMethod = (): MethodInfo => {
    const methodAccess = u2();
    const methodName = text(u2());
    const method: MethodInfo = {
      access: methodAccess,
      descriptor: text(u2()),
      exceptions: [],
      name: methodName,
    };

    attributes((attributeName, end) => {
      switch (attributeName) {
        case "Code": {
          const maxStack = u2();
          const maxLocals = u2();
          const codeLength = u4();
          const code = bytes.slice(offset, offset + codeLength);

          offset += codeLength;

          const exceptionTable = Array.from(
            { length: u2() },
            (): ExceptionHandler => {
              const startPc = u2();
              const endPc = u2();
              const handlerPc = u2();

              return { catchType: className(u2()), endPc, handlerPc, startPc };
            }
          );
          const lineNumbers: number[] = [];

          attributes((codeAttributeName) => {
            if (codeAttributeName === "LineNumberTable") {
              const count = u2();

              for (let j = 0; j < count; j++) lineNumbers.push(u2(), u2());
            }
          });
          method.code = {
            code,
            exceptionTable,
            lineNumbers,
            maxLocals,
            maxStack,
          };
          break;
        }
        case "Exceptions":
          method.exceptions = Array.from(
            { length: u2() },
            () => className(u2()) as string
          );
          break;
        case "Signature":
          method.signature = text(u2());
          break;
        case "RuntimeVisibleAnnotations":
          method.annotations = slice(end);
          break;
        case "RuntimeVisibleParameterAnnotations":
          method.parameterAnnotations = slice(end);
          break;
        case "AnnotationDefault":
          method.annotationDefault = slice(end);
          break;
        default:
          break;
      }
    });

    return method;
  };

  classFile.fields = Array.from({ length: u2() }, readField);
  classFile.methods = Array.from({ length: u2() }, readMethod);

  attributes((attributeName, end) => {
    switch (attributeName) {
      case "BootstrapMethods": {
        const count = u2();

        for (let i = 0; i < count; i++) {
          const methodRef = u2();
          const args = Array.from({ length: u2() }, () => u2());

          classFile.bootstrapMethods.push({ args, methodRef });
        }
        break;
      }
      case "SourceFile":
        classFile.sourceFile = text(u2());
        break;
      case "Signature":
        classFile.signature = text(u2());
        break;
      case "NestHost":
        classFile.nestHost = className(u2());
        break;
      case "InnerClasses": {
        const count = u2();

        for (let i = 0; i < count; i++) {
          const innerIndex = u2();
          const outerIndex = u2();
          const nameIndex = u2();

          classFile.innerClasses.push({
            access: u2(),
            innerName: nameIndex === 0 ? undefined : text(nameIndex),
            name: className(innerIndex) as string,
            outerName: className(outerIndex),
          });
        }
        break;
      }
      case "EnclosingMethod": {
        const enclosingClass = className(u2()) as string;
        const natIndex = u2();

        classFile.enclosingMethod =
          natIndex === 0
            ? { className: enclosingClass }
            : {
                className: enclosingClass,
                descriptor: nameAndType(natIndex)[1],
                name: nameAndType(natIndex)[0],
              };
        break;
      }
      case "RuntimeVisibleAnnotations":
        classFile.annotations = slice(end);
        break;
      default:
        break;
    }
  });

  return classFile;
};
