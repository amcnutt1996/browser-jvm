export const OPCODE_NAMES = [
  "nop",
  "aconst_null",
  "iconst_m1",
  "iconst_0",
  "iconst_1",
  "iconst_2",
  "iconst_3",
  "iconst_4",
  "iconst_5",
  "lconst_0",
  "lconst_1",
  "fconst_0",
  "fconst_1",
  "fconst_2",
  "dconst_0",
  "dconst_1",
  "bipush",
  "sipush",
  "ldc",
  "ldc_w",
  "ldc2_w",
  "iload",
  "lload",
  "fload",
  "dload",
  "aload",
  "iload_0",
  "iload_1",
  "iload_2",
  "iload_3",
  "lload_0",
  "lload_1",
  "lload_2",
  "lload_3",
  "fload_0",
  "fload_1",
  "fload_2",
  "fload_3",
  "dload_0",
  "dload_1",
  "dload_2",
  "dload_3",
  "aload_0",
  "aload_1",
  "aload_2",
  "aload_3",
  "iaload",
  "laload",
  "faload",
  "daload",
  "aaload",
  "baload",
  "caload",
  "saload",
  "istore",
  "lstore",
  "fstore",
  "dstore",
  "astore",
  "istore_0",
  "istore_1",
  "istore_2",
  "istore_3",
  "lstore_0",
  "lstore_1",
  "lstore_2",
  "lstore_3",
  "fstore_0",
  "fstore_1",
  "fstore_2",
  "fstore_3",
  "dstore_0",
  "dstore_1",
  "dstore_2",
  "dstore_3",
  "astore_0",
  "astore_1",
  "astore_2",
  "astore_3",
  "iastore",
  "lastore",
  "fastore",
  "dastore",
  "aastore",
  "bastore",
  "castore",
  "sastore",
  "pop",
  "pop2",
  "dup",
  "dup_x1",
  "dup_x2",
  "dup2",
  "dup2_x1",
  "dup2_x2",
  "swap",
  "iadd",
  "ladd",
  "fadd",
  "dadd",
  "isub",
  "lsub",
  "fsub",
  "dsub",
  "imul",
  "lmul",
  "fmul",
  "dmul",
  "idiv",
  "ldiv",
  "fdiv",
  "ddiv",
  "irem",
  "lrem",
  "frem",
  "drem",
  "ineg",
  "lneg",
  "fneg",
  "dneg",
  "ishl",
  "lshl",
  "ishr",
  "lshr",
  "iushr",
  "lushr",
  "iand",
  "land",
  "ior",
  "lor",
  "ixor",
  "lxor",
  "iinc",
  "i2l",
  "i2f",
  "i2d",
  "l2i",
  "l2f",
  "l2d",
  "f2i",
  "f2l",
  "f2d",
  "d2i",
  "d2l",
  "d2f",
  "i2b",
  "i2c",
  "i2s",
  "lcmp",
  "fcmpl",
  "fcmpg",
  "dcmpl",
  "dcmpg",
  "ifeq",
  "ifne",
  "iflt",
  "ifge",
  "ifgt",
  "ifle",
  "if_icmpeq",
  "if_icmpne",
  "if_icmplt",
  "if_icmpge",
  "if_icmpgt",
  "if_icmple",
  "if_acmpeq",
  "if_acmpne",
  "goto",
  "jsr",
  "ret",
  "tableswitch",
  "lookupswitch",
  "ireturn",
  "lreturn",
  "freturn",
  "dreturn",
  "areturn",
  "return",
  "getstatic",
  "putstatic",
  "getfield",
  "putfield",
  "invokevirtual",
  "invokespecial",
  "invokestatic",
  "invokeinterface",
  "invokedynamic",
  "new",
  "newarray",
  "anewarray",
  "arraylength",
  "athrow",
  "checkcast",
  "instanceof",
  "monitorenter",
  "monitorexit",
  "wide",
  "multianewarray",
  "ifnull",
  "ifnonnull",
  "goto_w",
  "jsr_w",
];

const OPERAND_BYTES = new Int8Array(256).fill(-1);

for (let op = 0; op < OPCODE_NAMES.length; op++) OPERAND_BYTES[op] = 0;
for (const op of [0x10, 0x12, 0x15, 0x16, 0x17, 0x18, 0x19]) {
  OPERAND_BYTES[op] = 1;
}
for (let op = 0x36; op <= 0x3a; op++) OPERAND_BYTES[op] = 1;
OPERAND_BYTES[0xa9] = 1;
OPERAND_BYTES[0xbc] = 1;
for (const op of [0x11, 0x13, 0x14, 0x84, 0xbb, 0xbd, 0xc0, 0xc1]) {
  OPERAND_BYTES[op] = 2;
}
for (let op = 0x99; op <= 0xa8; op++) OPERAND_BYTES[op] = 2;
for (let op = 0xb2; op <= 0xb8; op++) OPERAND_BYTES[op] = 2;
OPERAND_BYTES[0xc6] = 2;
OPERAND_BYTES[0xc7] = 2;
OPERAND_BYTES[0xc5] = 3;
OPERAND_BYTES[0xb9] = 4;
OPERAND_BYTES[0xba] = 4;
OPERAND_BYTES[0xc8] = 4;
OPERAND_BYTES[0xc9] = 4;

export const instructionLength = (code: Uint8Array, pc: number): number => {
  const op = code[pc];

  if (op === 0xaa || op === 0xab) {
    let next = (pc + 4) & ~3;

    if (op === 0xaa) {
      const low =
        (code[next + 4] << 24) |
        (code[next + 5] << 16) |
        (code[next + 6] << 8) |
        code[next + 7];
      const high =
        (code[next + 8] << 24) |
        (code[next + 9] << 16) |
        (code[next + 10] << 8) |
        code[next + 11];

      next += 12 + (high - low + 1) * 4;
    } else {
      const pairs =
        (code[next + 4] << 24) |
        (code[next + 5] << 16) |
        (code[next + 6] << 8) |
        code[next + 7];

      next += 8 + pairs * 8;
    }

    return next - pc;
  }

  if (op === 0xc4) return code[pc + 1] === 0x84 ? 6 : 4;

  const operands = OPERAND_BYTES[op];

  if (operands < 0) throw new Error(`Unknown opcode ${op} at ${pc}`);

  return 1 + operands;
};

export const forEachInstruction = (
  code: Uint8Array,
  visit: (op: number, pc: number) => void
): void => {
  for (let pc = 0; pc < code.length; pc += instructionLength(code, pc)) {
    visit(code[pc], pc);
  }
};
