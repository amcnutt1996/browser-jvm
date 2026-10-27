/* eslint-disable max-classes-per-file */
// Compiles hot methods to JavaScript functions.
//
// A compiled method runs straight-line JavaScript over its locals and operand
// stack slots, dispatching on basic blocks. It never blocks: whenever it would
// have to (class initialization, a contended monitor, a native that waits, a
// callee that cannot be compiled, too deep a call chain, or the end of the
// thread's time slice) it throws `Suspend`, and every compiled activation on
// the JavaScript stack adds an ordinary interpreter frame describing its state
// to it. The interpreter then carries on from those frames, and resumes them
// in compiled code again whenever one of them is on top at a block start.
import {
  CONSTANT_Class,
  CONSTANT_Double,
  CONSTANT_Dynamic,
  CONSTANT_Float,
  CONSTANT_Integer,
  CONSTANT_Long,
  CONSTANT_MethodHandle,
  CONSTANT_MethodType,
  CONSTANT_String,
  type ConstantPoolEntry,
  type MemberRef,
} from "./classfile.ts";
import { parseMethodDescriptor } from "./descriptors.ts";
import { bootstrapIndy } from "./indy.ts";
import { enter, exit, type Lockable, tryEnter } from "./monitors.ts";
import { instructionLength } from "./opcodes.ts";
import {
  arrayIndexError,
  castError,
  d2i,
  d2l,
  describe,
  newMultiArray,
  resolveClass,
  resolveConstant,
  resolveField,
  resolveMethod,
} from "./resolve.ts";
import {
  Frame,
  INITIALIZED,
  type JArray,
  JavaThrow,
  type JClass,
  JMethod,
  type JObject,
  type JThread,
  TERMINATED,
} from "./types.ts";
import { type JVM } from "./vm.ts";

export class Suspend {
  public frames: Frame[] = [];

  public own = true;

  public preempted = false;
}

export class Terminated {
  public readonly terminated = true;
}

export type Entry = (thread: JThread, frame: Frame | null, ...args: unknown[]) => unknown;

export type Compiled = Entry & { blockStarts: Uint8Array };

const CHECK_INTERVAL = 4096;
const MAX_DEPTH = 700;
const MAX_CODE_LENGTH = 12_000;
const NEWARRAY_TYPES = ["", "", "", "", "Z", "C", "F", "D", "B", "S", "I", "J"];
const POLYMORPHIC = new Set(["java/lang/invoke/MethodHandle", "java/lang/invoke/VarHandle"]);

const wide = (descriptor: string): boolean => descriptor === "J" || descriptor === "D";

const slots = (descriptor: string): number => (wide(descriptor) ? 2 : 1);

const s16 = (code: Uint8Array, at: number): number => (((code[at] << 8) | code[at + 1]) << 16) >> 16;

const s32 = (code: Uint8Array, at: number): number =>
  (code[at] << 24) | (code[at + 1] << 16) | (code[at + 2] << 8) | code[at + 3];

const u16 = (code: Uint8Array, at: number): number => (code[at] << 8) | code[at + 1];

const monitorMethods = new WeakMap<JVM, JMethod>();

const monitorMethod = (vm: JVM): JMethod => {
  let method = monitorMethods.get(vm);

  if (!method) {
    method = new JMethod(vm.objectClass, { access: 0x1008, descriptor: "()V", exceptions: [], name: "<monitorenter>" });
    monitorMethods.set(vm, method);
  }

  return method;
};

type Instruction = { length: number; op: number; pc: number };

type Analysis = {
  blockStarts: Uint8Array;
  depth: Int32Array;
  instructions: Instruction[];
};

// Operand stack depth before every instruction, and the basic block starts.
const analyze = (method: JMethod): Analysis | undefined => {
  const { cls } = method;
  const { code } = method.code as { code: Uint8Array };
  const cp = (cls.cf as { constantPool: ConstantPoolEntry[] }).constantPool;
  const instructions: Instruction[] = [];
  const byPc = new Map<number, Instruction>();

  for (let pc = 0; pc < code.length; ) {
    const op = code[pc];
    const length = instructionLength(code, pc);

    if (op === 0xa8 || op === 0xa9 || op === 0xc9 || (op === 0xc4 && code[pc + 1] === 0xa9)) return undefined;

    const instruction = { length, op, pc };

    instructions.push(instruction);
    byPc.set(pc, instruction);
    pc += length;
  }

  const depth = new Int32Array(code.length).fill(-1);
  const blockStarts = new Uint8Array(code.length);
  const work: [number, number][] = [[0, 0]];

  blockStarts[0] = 1;

  for (const handler of method.handlers) {
    work.push([handler.handlerPc, 1]);
    blockStarts[handler.handlerPc] = 1;
  }

  const member = (at: number): MemberRef => (cp[u16(code, at)] as { value: MemberRef }).value;

  while (work.length > 0) {
    let [pc, sp] = work.pop() as [number, number];

    for (;;) {
      if (depth[pc] >= 0) break;

      depth[pc] = sp;

      const { length, op } = byPc.get(pc) as Instruction;
      const next = pc + length;
      let jumps: number[] = [];
      let falls = true;

      if (op <= 0x0f) sp += op === 0x09 || op === 0x0a || op === 0x0e || op === 0x0f ? 2 : op === 0x00 ? 0 : 1;
      else if (op <= 0x11) sp += 1;
      else if (op <= 0x13) sp += 1;
      else if (op === 0x14) sp += 2;
      else if (op <= 0x2d) sp += op === 0x16 || op === 0x18 || (op >= 0x1e && op <= 0x21) || (op >= 0x26 && op <= 0x29) ? 2 : 1;
      else if (op <= 0x35) sp += op === 0x2f || op === 0x31 ? 0 : -1;
      else if (op <= 0x4e) sp -= op === 0x37 || op === 0x39 || (op >= 0x3f && op <= 0x42) || (op >= 0x47 && op <= 0x4a) ? 2 : 1;
      else if (op <= 0x56) sp -= op === 0x50 || op === 0x52 ? 4 : 3;
      else if (op === 0x57) sp -= 1;
      else if (op === 0x58) sp -= 2;
      else if (op === 0x59 || op === 0x5a || op === 0x5b) sp += 1;
      else if (op === 0x5c || op === 0x5d || op === 0x5e) sp += 2;
      else if (op === 0x5f) sp += 0;
      else if (op <= 0x73) sp -= (op - 0x60) % 2 === 1 ? 2 : 1;
      else if (op <= 0x77) sp += 0;
      else if (op <= 0x7d) sp -= 1;
      else if (op <= 0x83) sp -= (op - 0x7e) % 2 === 1 ? 2 : 1;
      else if (op === 0x84) sp += 0;
      else if (op <= 0x93) {
        const change: Record<number, number> = {
          0x85: 1, 0x86: 0, 0x87: 1, 0x88: -1, 0x89: -1, 0x8a: 0, 0x8b: 0, 0x8c: 1,
          0x8d: 1, 0x8e: -1, 0x8f: 0, 0x90: -1, 0x91: 0, 0x92: 0, 0x93: 0,
        };

        sp += change[op];
      } else if (op === 0x94) sp -= 3;
      else if (op === 0x95 || op === 0x96) sp -= 1;
      else if (op === 0x97 || op === 0x98) sp -= 3;
      else if (op <= 0x9e) {
        sp -= 1;
        jumps = [pc + s16(code, pc + 1)];
      } else if (op <= 0xa6) {
        sp -= 2;
        jumps = [pc + s16(code, pc + 1)];
      } else if (op === 0xa7 || op === 0xc8) {
        jumps = [pc + (op === 0xa7 ? s16(code, pc + 1) : s32(code, pc + 1))];
        falls = false;
      } else if (op === 0xaa || op === 0xab) {
        const base = (pc + 4) & ~3;

        sp -= 1;
        jumps.push(pc + s32(code, base));

        if (op === 0xaa) {
          const low = s32(code, base + 4);
          const high = s32(code, base + 8);

          for (let i = 0; i <= high - low; i++) jumps.push(pc + s32(code, base + 12 + i * 4));
        } else {
          const pairs = s32(code, base + 4);

          for (let i = 0; i < pairs; i++) jumps.push(pc + s32(code, base + 12 + i * 8));
        }

        falls = false;
      } else if (op >= 0xac && op <= 0xb1) {
        falls = false;
      } else if (op === 0xb2 || op === 0xb3) {
        const size = slots(member(pc + 1).descriptor);

        sp += op === 0xb2 ? size : -size;
      } else if (op === 0xb4) {
        sp += slots(member(pc + 1).descriptor) - 1;
      } else if (op === 0xb5) {
        sp -= slots(member(pc + 1).descriptor) + 1;
      } else if (op >= 0xb6 && op <= 0xb9) {
        const ref = member(pc + 1);
        const type = parseMethodDescriptor(ref.descriptor);

        sp -= type.argSlots + (op === 0xb8 ? 0 : 1);
        sp += type.ret === "V" ? 0 : slots(type.ret);
      } else if (op === 0xba) {
        const type = parseMethodDescriptor((cp[u16(code, pc + 1)] as { value: { descriptor: string } }).value.descriptor);

        sp += (type.ret === "V" ? 0 : slots(type.ret)) - type.argSlots;
      } else if (op === 0xbb) sp += 1;
      else if (op <= 0xbe) sp += 0;
      else if (op === 0xbf) {
        falls = false;
      } else if (op <= 0xc1) sp += 0;
      else if (op <= 0xc3) sp -= 1;
      else if (op === 0xc4) {
        const sub = code[pc + 1];

        if (sub === 0x16 || sub === 0x18) sp += 2;
        else if (sub >= 0x15 && sub <= 0x19) sp += 1;
        else if (sub === 0x37 || sub === 0x39) sp -= 2;
        else if (sub >= 0x36 && sub <= 0x3a) sp -= 1;
      } else if (op === 0xc5) sp += 1 - code[pc + 3];
      else if (op === 0xc6 || op === 0xc7) {
        sp -= 1;
        jumps = [pc + s16(code, pc + 1)];
      } else {
        return undefined;
      }

      if (op === 0x12 || op === 0x13) {
        const entry = cp[op === 0x12 ? code[pc + 1] : u16(code, pc + 1)];

        if (entry?.tag === CONSTANT_Dynamic && wide(entry.value.descriptor)) sp += 1;
      }

      for (const target of jumps) {
        blockStarts[target] = 1;
        work.push([target, sp]);
      }

      // Suspension points and the instructions after them start blocks so
      // that a materialized frame can resume in compiled code.
      if (!falls || (op >= 0xb2 && op <= 0xbb) || op === 0xc2 || op === 0xc5 || op === 0x12 || op === 0x13 || jumps.length > 0) {
        if (op >= 0xb2) blockStarts[pc] = 1;

        if (next < code.length) blockStarts[next] = 1;
      }

      if (!falls || next >= code.length) break;

      pc = next;
    }
  }

  return { blockStarts, depth, instructions };
};

const literal = (value: unknown): string => {
  if (typeof value === "bigint") return `${value}n`;

  if (typeof value === "number") {
    if (Number.isNaN(value)) return "NaN";

    if (value === Infinity) return "Infinity";

    if (value === -Infinity) return "-Infinity";

    return Object.is(value, -0) ? "-0" : String(value);
  }

  return JSON.stringify(value);
};

const S = (index: number): string => `s${index}`;

const L = (index: number): string => `l${index}`;

const throwNpe = (ip: number, message?: string): string =>
  `H.npe(thread, d, ${ip}${message === undefined ? "" : `, ${literal(message)}`})`;

const backJump = (target: number, ip: number): string =>
  target <= ip
    ? `if (--V.jitBudget < 0 && (t0 = H.preempt()) !== undefined) { JP[d] = ${target}; throw t0; } pc = ${target}; continue;`
    : `pc = ${target}; continue;`;

const failures = new WeakSet<JMethod>();

const generate = (vm: JVM, method: JMethod): Compiled | undefined => {
  const analysis = analyze(method);

  if (!analysis) return undefined;

  const { blockStarts, depth, instructions } = analysis;
  const { cls } = method;
  const codeAttribute = method.code as { code: Uint8Array; maxLocals: number; maxStack: number };
  const { code, maxLocals, maxStack } = codeAttribute;
  const cp = (cls.cf as { constantPool: ConstantPoolEntry[] }).constantPool;
  const constants: unknown[] = [];
  const constantIds = new Map<unknown, string>();
  const body: string[] = [];
  const closureVars: string[] = [];
  const constant = (value: unknown): string => {
    let name = constantIds.get(value);

    if (!name) {
      name = `k${constants.length}`;
      constants.push(value);
      constantIds.set(value, name);
    }

    return name;
  };
  const emit = (line: string): void => {
    body.push(line);
  };
  const sync = method.isSynchronized;
  const nextPc = new Int32Array(code.length).fill(-1);
  const argSlotsAt = new Int32Array(code.length);

  for (const { length, pc } of instructions) nextPc[pc] = pc + length;

  const initCheck = (target: JClass, ip: number): void => {
    if (target.state === INITIALIZED) return;

    emit(`if (${constant(target)}.state !== ${INITIALIZED} && ${constant(target)}.initThread !== thread) { JP[d] = ${ip}; throw H.own(); }`);
  };
  for (const instruction of instructions) {
    const { op, pc } = instruction;
    const D = depth[pc];

    if (D < 0) continue;

    if (blockStarts[pc]) emit(`case ${pc}:`);

    const cpIndex = u16(code, pc + 1);
    const mark = body.length;

    try {
    switch (op) {
      case 0x00:
        break;
      case 0x01:
        emit(`${S(D)} = null;`);
        break;
      case 0x02:
      case 0x03:
      case 0x04:
      case 0x05:
      case 0x06:
      case 0x07:
      case 0x08:
        emit(`${S(D)} = ${op - 3};`);
        break;
      case 0x09:
      case 0x0a:
        emit(`${S(D)} = ${op - 9}n;`);
        break;
      case 0x0b:
      case 0x0c:
      case 0x0d:
        emit(`${S(D)} = ${op - 11};`);
        break;
      case 0x0e:
      case 0x0f:
        emit(`${S(D)} = ${op - 14};`);
        break;
      case 0x10:
        emit(`${S(D)} = ${(code[pc + 1] << 24) >> 24};`);
        break;
      case 0x11:
        emit(`${S(D)} = ${s16(code, pc + 1)};`);
        break;
      case 0x12:
      case 0x13:
      case 0x14: {
        const entry = cp[op === 0x12 ? code[pc + 1] : cpIndex];

        switch (entry?.tag) {
          case CONSTANT_Integer:
          case CONSTANT_Float:
          case CONSTANT_Double:
          case CONSTANT_Long:
          case CONSTANT_String:
            emit(`${S(D)} = ${literal(entry.value)};`);
            break;
          case CONSTANT_Class:
          case CONSTANT_MethodType:
          case CONSTANT_MethodHandle:
          case CONSTANT_Dynamic:
            emit(`JP[d] = ${pc}; ${S(D)} = H.ldc(thread, K, ${constant(entry)});`);
            break;
          default:
            return undefined;
        }
        break;
      }
      case 0x15:
      case 0x16:
      case 0x17:
      case 0x18:
      case 0x19:
        emit(`${S(D)} = ${L(code[pc + 1])};`);
        break;
      case 0x1a:
      case 0x1b:
      case 0x1c:
      case 0x1d:
        emit(`${S(D)} = ${L(op - 0x1a)};`);
        break;
      case 0x1e:
      case 0x1f:
      case 0x20:
      case 0x21:
        emit(`${S(D)} = ${L(op - 0x1e)};`);
        break;
      case 0x22:
      case 0x23:
      case 0x24:
      case 0x25:
        emit(`${S(D)} = ${L(op - 0x22)};`);
        break;
      case 0x26:
      case 0x27:
      case 0x28:
      case 0x29:
        emit(`${S(D)} = ${L(op - 0x26)};`);
        break;
      case 0x2a:
      case 0x2b:
      case 0x2c:
      case 0x2d:
        emit(`${S(D)} = ${L(op - 0x2a)};`);
        break;
      case 0x2e:
      case 0x2f:
      case 0x30:
      case 0x31:
      case 0x32:
      case 0x33:
      case 0x34:
      case 0x35:
        emit(`t0 = ${S(D - 2)}; t1 = ${S(D - 1)};`);
        emit(`if (t0 === null) ${throwNpe(pc)};`);
        emit(`if (t1 >>> 0 >= t0.length) H.bounds(thread, d, ${pc}, t1, t0.length);`);
        emit(`${S(D - 2)} = t0[t1];`);
        break;
      case 0x36:
      case 0x38:
      case 0x3a:
        emit(`${L(code[pc + 1])} = ${S(D - 1)};`);
        break;
      case 0x37:
      case 0x39:
        emit(`${L(code[pc + 1])} = ${S(D - 2)};`);
        break;
      case 0x3b:
      case 0x3c:
      case 0x3d:
      case 0x3e:
        emit(`${L(op - 0x3b)} = ${S(D - 1)};`);
        break;
      case 0x3f:
      case 0x40:
      case 0x41:
      case 0x42:
        emit(`${L(op - 0x3f)} = ${S(D - 2)};`);
        break;
      case 0x43:
      case 0x44:
      case 0x45:
      case 0x46:
        emit(`${L(op - 0x43)} = ${S(D - 1)};`);
        break;
      case 0x47:
      case 0x48:
      case 0x49:
      case 0x4a:
        emit(`${L(op - 0x47)} = ${S(D - 2)};`);
        break;
      case 0x4b:
      case 0x4c:
      case 0x4d:
      case 0x4e:
        emit(`${L(op - 0x4b)} = ${S(D - 1)};`);
        break;
      case 0x4f:
      case 0x51:
      case 0x54:
      case 0x55:
      case 0x56:
      case 0x50:
      case 0x52: {
        const size = op === 0x50 || op === 0x52 ? 2 : 1;
        const base = D - 2 - size;

        emit(`t0 = ${S(base)}; t1 = ${S(base + 1)};`);
        emit(`if (t0 === null) ${throwNpe(pc)};`);
        emit(`if (t1 >>> 0 >= t0.length) H.bounds(thread, d, ${pc}, t1, t0.length);`);
        emit(`t0[t1] = ${S(base + 2)};`);
        break;
      }
      case 0x53:
        emit(`H.aastore(thread, d, ${pc}, ${S(D - 3)}, ${S(D - 2)}, ${S(D - 1)});`);
        break;
      case 0x57:
      case 0x58:
        break;
      case 0x59:
        emit(`${S(D)} = ${S(D - 1)};`);
        break;
      case 0x5a:
        emit(`t0 = ${S(D - 1)}; ${S(D - 1)} = ${S(D - 2)}; ${S(D - 2)} = t0; ${S(D)} = t0;`);
        break;
      case 0x5b:
        emit(`t0 = ${S(D - 1)}; ${S(D - 1)} = ${S(D - 2)}; ${S(D - 2)} = ${S(D - 3)}; ${S(D - 3)} = t0; ${S(D)} = t0;`);
        break;
      case 0x5c:
        emit(`${S(D)} = ${S(D - 2)}; ${S(D + 1)} = ${S(D - 1)};`);
        break;
      case 0x5d:
        emit(`t0 = ${S(D - 2)}; t1 = ${S(D - 1)}; t2 = ${S(D - 3)};`);
        emit(`${S(D - 3)} = t0; ${S(D - 2)} = t1; ${S(D - 1)} = t2; ${S(D)} = t0; ${S(D + 1)} = t1;`);
        break;
      case 0x5e:
        emit(`t0 = ${S(D - 2)}; t1 = ${S(D - 1)}; t2 = ${S(D - 4)}; t3 = ${S(D - 3)};`);
        emit(`${S(D - 4)} = t0; ${S(D - 3)} = t1; ${S(D - 2)} = t2; ${S(D - 1)} = t3; ${S(D)} = t0; ${S(D + 1)} = t1;`);
        break;
      case 0x5f:
        emit(`t0 = ${S(D - 1)}; ${S(D - 1)} = ${S(D - 2)}; ${S(D - 2)} = t0;`);
        break;
      case 0x60:
        emit(`${S(D - 2)} = (${S(D - 2)} + ${S(D - 1)}) | 0;`);
        break;
      case 0x61:
        emit(`${S(D - 4)} = BigInt.asIntN(64, ${S(D - 4)} + ${S(D - 2)});`);
        break;
      case 0x62:
        emit(`${S(D - 2)} = Math.fround(${S(D - 2)} + ${S(D - 1)});`);
        break;
      case 0x63:
        emit(`${S(D - 4)} = ${S(D - 4)} + ${S(D - 2)};`);
        break;
      case 0x64:
        emit(`${S(D - 2)} = (${S(D - 2)} - ${S(D - 1)}) | 0;`);
        break;
      case 0x65:
        emit(`${S(D - 4)} = BigInt.asIntN(64, ${S(D - 4)} - ${S(D - 2)});`);
        break;
      case 0x66:
        emit(`${S(D - 2)} = Math.fround(${S(D - 2)} - ${S(D - 1)});`);
        break;
      case 0x67:
        emit(`${S(D - 4)} = ${S(D - 4)} - ${S(D - 2)};`);
        break;
      case 0x68:
        emit(`${S(D - 2)} = Math.imul(${S(D - 2)}, ${S(D - 1)});`);
        break;
      case 0x69:
        emit(`${S(D - 4)} = BigInt.asIntN(64, ${S(D - 4)} * ${S(D - 2)});`);
        break;
      case 0x6a:
        emit(`${S(D - 2)} = Math.fround(${S(D - 2)} * ${S(D - 1)});`);
        break;
      case 0x6b:
        emit(`${S(D - 4)} = ${S(D - 4)} * ${S(D - 2)};`);
        break;
      case 0x6c:
        emit(`if (${S(D - 1)} === 0) H.arithmetic(thread, d, ${pc});`);
        emit(`${S(D - 2)} = (${S(D - 2)} / ${S(D - 1)}) | 0;`);
        break;
      case 0x6d:
        emit(`if (${S(D - 2)} === 0n) H.arithmetic(thread, d, ${pc});`);
        emit(`${S(D - 4)} = BigInt.asIntN(64, ${S(D - 4)} / ${S(D - 2)});`);
        break;
      case 0x6e:
        emit(`${S(D - 2)} = Math.fround(${S(D - 2)} / ${S(D - 1)});`);
        break;
      case 0x6f:
        emit(`${S(D - 4)} = ${S(D - 4)} / ${S(D - 2)};`);
        break;
      case 0x70:
        emit(`if (${S(D - 1)} === 0) H.arithmetic(thread, d, ${pc});`);
        emit(`${S(D - 2)} = (${S(D - 2)} % ${S(D - 1)}) | 0;`);
        break;
      case 0x71:
        emit(`if (${S(D - 2)} === 0n) H.arithmetic(thread, d, ${pc});`);
        emit(`${S(D - 4)} = ${S(D - 4)} % ${S(D - 2)};`);
        break;
      case 0x72:
        emit(`${S(D - 2)} = Math.fround(${S(D - 2)} % ${S(D - 1)});`);
        break;
      case 0x73:
        emit(`${S(D - 4)} = ${S(D - 4)} % ${S(D - 2)};`);
        break;
      case 0x74:
        emit(`${S(D - 1)} = -${S(D - 1)} | 0;`);
        break;
      case 0x75:
        emit(`${S(D - 2)} = BigInt.asIntN(64, -${S(D - 2)});`);
        break;
      case 0x76:
        emit(`${S(D - 1)} = -${S(D - 1)};`);
        break;
      case 0x77:
        emit(`${S(D - 2)} = -${S(D - 2)};`);
        break;
      case 0x78:
        emit(`${S(D - 2)} = ${S(D - 2)} << ${S(D - 1)};`);
        break;
      case 0x79:
        emit(`${S(D - 3)} = BigInt.asIntN(64, ${S(D - 3)} << BigInt(${S(D - 1)} & 63));`);
        break;
      case 0x7a:
        emit(`${S(D - 2)} = ${S(D - 2)} >> ${S(D - 1)};`);
        break;
      case 0x7b:
        emit(`${S(D - 3)} = ${S(D - 3)} >> BigInt(${S(D - 1)} & 63);`);
        break;
      case 0x7c:
        emit(`${S(D - 2)} = (${S(D - 2)} >>> ${S(D - 1)}) | 0;`);
        break;
      case 0x7d:
        emit(`${S(D - 3)} = BigInt.asIntN(64, BigInt.asUintN(64, ${S(D - 3)}) >> BigInt(${S(D - 1)} & 63));`);
        break;
      case 0x7e:
        emit(`${S(D - 2)} = ${S(D - 2)} & ${S(D - 1)};`);
        break;
      case 0x7f:
        emit(`${S(D - 4)} = ${S(D - 4)} & ${S(D - 2)};`);
        break;
      case 0x80:
        emit(`${S(D - 2)} = ${S(D - 2)} | ${S(D - 1)};`);
        break;
      case 0x81:
        emit(`${S(D - 4)} = ${S(D - 4)} | ${S(D - 2)};`);
        break;
      case 0x82:
        emit(`${S(D - 2)} = ${S(D - 2)} ^ ${S(D - 1)};`);
        break;
      case 0x83:
        emit(`${S(D - 4)} = ${S(D - 4)} ^ ${S(D - 2)};`);
        break;
      case 0x84:
        emit(`${L(code[pc + 1])} = (${L(code[pc + 1])} + ${(code[pc + 2] << 24) >> 24}) | 0;`);
        break;
      case 0x85:
        emit(`${S(D - 1)} = BigInt(${S(D - 1)});`);
        break;
      case 0x86:
        emit(`${S(D - 1)} = Math.fround(${S(D - 1)});`);
        break;
      case 0x87:
        break;
      case 0x88:
        emit(`${S(D - 2)} = Number(BigInt.asIntN(32, ${S(D - 2)}));`);
        break;
      case 0x89:
        emit(`${S(D - 2)} = Math.fround(Number(${S(D - 2)}));`);
        break;
      case 0x8a:
        emit(`${S(D - 2)} = Number(${S(D - 2)});`);
        break;
      case 0x8b:
        emit(`${S(D - 1)} = H.d2i(${S(D - 1)});`);
        break;
      case 0x8c:
        emit(`${S(D - 1)} = H.d2l(${S(D - 1)});`);
        break;
      case 0x8d:
        break;
      case 0x8e:
        emit(`${S(D - 2)} = H.d2i(${S(D - 2)});`);
        break;
      case 0x8f:
        emit(`${S(D - 2)} = H.d2l(${S(D - 2)});`);
        break;
      case 0x90:
        emit(`${S(D - 2)} = Math.fround(${S(D - 2)});`);
        break;
      case 0x91:
        emit(`${S(D - 1)} = (${S(D - 1)} << 24) >> 24;`);
        break;
      case 0x92:
        emit(`${S(D - 1)} = ${S(D - 1)} & 0xffff;`);
        break;
      case 0x93:
        emit(`${S(D - 1)} = (${S(D - 1)} << 16) >> 16;`);
        break;
      case 0x94:
        emit(`t0 = ${S(D - 4)}; t1 = ${S(D - 2)}; ${S(D - 4)} = t0 < t1 ? -1 : t0 > t1 ? 1 : 0;`);
        break;
      case 0x95:
      case 0x96:
        emit(`t0 = ${S(D - 2)}; t1 = ${S(D - 1)}; ${S(D - 2)} = t0 > t1 ? 1 : t0 < t1 ? -1 : t0 === t1 ? 0 : ${op === 0x95 ? -1 : 1};`);
        break;
      case 0x97:
      case 0x98:
        emit(`t0 = ${S(D - 4)}; t1 = ${S(D - 2)}; ${S(D - 4)} = t0 > t1 ? 1 : t0 < t1 ? -1 : t0 === t1 ? 0 : ${op === 0x97 ? -1 : 1};`);
        break;
      case 0x99:
      case 0x9a:
      case 0x9b:
      case 0x9c:
      case 0x9d:
      case 0x9e: {
        const comparison = ["===", "!==", "<", ">=", ">", "<="][op - 0x99];
        const target = pc + s16(code, pc + 1);

        emit(`if (${S(D - 1)} ${comparison} 0) { ${backJump(target, pc)} }`);
        break;
      }
      case 0x9f:
      case 0xa0:
      case 0xa1:
      case 0xa2:
      case 0xa3:
      case 0xa4:
      case 0xa5:
      case 0xa6: {
        const comparison = ["===", "!==", "<", ">=", ">", "<=", "===", "!=="][op - 0x9f];
        const target = pc + s16(code, pc + 1);

        emit(`if (${S(D - 2)} ${comparison} ${S(D - 1)}) { ${backJump(target, pc)} }`);
        break;
      }
      case 0xa7:
      case 0xc8:
        emit(backJump(pc + (op === 0xa7 ? s16(code, pc + 1) : s32(code, pc + 1)), pc));
        break;
      case 0xaa:
      case 0xab: {
        const base = (pc + 4) & ~3;
        const cases: string[] = [];

        if (op === 0xaa) {
          const low = s32(code, base + 4);
          const high = s32(code, base + 8);

          for (let i = 0; i <= high - low; i++) {
            cases.push(`case ${low + i}: pc = ${pc + s32(code, base + 12 + i * 4)}; break;`);
          }
        } else {
          const pairs = s32(code, base + 4);

          for (let i = 0; i < pairs; i++) {
            cases.push(`case ${s32(code, base + 8 + i * 8)}: pc = ${pc + s32(code, base + 12 + i * 8)}; break;`);
          }
        }

        emit(`switch (${S(D - 1)}) { ${cases.join(" ")} default: pc = ${pc + s32(code, base)}; }`);
        emit("continue;");
        break;
      }
      case 0xac:
      case 0xad:
      case 0xae:
      case 0xaf:
      case 0xb0:
      case 0xb1: {
        const value = op === 0xb1 ? "" : ` ${S(D - (op === 0xad || op === 0xaf ? 2 : 1))}`;

        if (sync) emit("H.exit(thread, lock);");

        emit(`thread.jitDepth = d; return${value};`);
        break;
      }
      case 0xb2:
      case 0xb3: {
        const field = resolveField(vm, cls, (cp[cpIndex] as { value: MemberRef }).value);
        const owner = field.cls;
        const key = literal(field.key);

        initCheck(owner, pc);

        if (op === 0xb2) {
          emit(`${S(D)} = ${constant(owner)}.statics[${key}];`);
        } else {
          emit(`${constant(owner)}.statics[${key}] = ${S(D - slots(field.descriptor))};`);
        }
        break;
      }
      case 0xb4: {
        const field = resolveField(vm, cls, (cp[cpIndex] as { value: MemberRef }).value);

        emit(`t0 = ${S(D - 1)};`);
        emit(`if (t0 === null) ${throwNpe(pc, `Cannot read field "${field.name}" because value is null`)};`);
        emit(`${S(D - 1)} = t0[${literal(field.key)}];`);
        break;
      }
      case 0xb5: {
        const field = resolveField(vm, cls, (cp[cpIndex] as { value: MemberRef }).value);
        const size = slots(field.descriptor);

        emit(`t0 = ${S(D - size - 1)};`);
        emit(`if (t0 === null) ${throwNpe(pc, `Cannot assign field "${field.name}" because value is null`)};`);
        emit(`t0[${literal(field.key)}] = ${S(D - size)};`);
        break;
      }
      case 0xb6:
      case 0xb7:
      case 0xb8:
      case 0xb9: {
        const ref = (cp[cpIndex] as { value: MemberRef }).value;
        const resolved = resolveMethod(vm, cls, ref);

        if (POLYMORPHIC.has(resolved.cls.name)) return undefined;

        const base = D - resolved.argSlots;
        const args: string[] = [];
        let slot = base;

        if (!resolved.isStatic) args.push(S(slot++));

        for (const type of resolved.args) {
          args.push(S(slot));
          slot += slots(type);
        }

        argSlotsAt[pc] = resolved.argSlots;

        const result = resolved.ret === "V" ? "" : `${S(base)} = `;

        emit(`JP[d] = ${pc};`);

        if (op === 0xb8) {
          initCheck(resolved.cls, pc);

          const entry = constant(resolved);

          emit(`${result}(${entry}.entry ?? H.entry(${entry}))(thread, null${args.map((arg) => `, ${arg}`).join("")});`);
        } else if (op === 0xb7) {
          let target = resolved;

          if (resolved.name !== "<init>" && !resolved.isPrivate && !resolved.cls.isInterface && resolved.cls !== cls && cls.superClass) {
            target = cls.superClass.vtable.get(resolved.key) ?? resolved;
          }

          const entry = constant(target);

          emit(`if (${args[0]} === null || ${args[0]} === undefined) ${throwNpe(pc, `Cannot invoke "${resolved.cls.name.replaceAll("/", ".")}.${resolved.name}()" because value is null`)};`);

          if (target.name === "<init>" && target.cls === vm.stringClass) {
            emit(`t0 = ${args[0]}; t1 = (${entry}.entry ?? H.entry(${entry}))(thread, null${args.map((arg) => `, ${arg}`).join("")});`);

            for (let i = 0; i < base; i++) emit(`if (${S(i)} === t0) ${S(i)} = t1;`);

            for (let i = 0; i < maxLocals; i++) emit(`if (${L(i)} === t0) ${L(i)} = t1;`);
          } else {
            emit(`${result}(${entry}.entry ?? H.entry(${entry}))(thread, null${args.map((arg) => `, ${arg}`).join("")});`);
          }
        } else {
          const cacheClass = `c${pc}`;
          const cacheTarget = `f${pc}`;

          closureVars.push(cacheClass, cacheTarget);
          emit(`t0 = ${args[0]};`);
          emit(`if (t0 === null || t0 === undefined) ${throwNpe(pc, `Cannot invoke "${resolved.cls.name.replaceAll("/", ".")}.${resolved.name}()" because value is null`)};`);
          emit(`t1 = typeof t0 === "string" ? ${constant(vm.stringClass)} : t0.$cls;`);
          emit(`if (t1 !== ${cacheClass}) { ${cacheTarget} = H.target(t1, ${constant(resolved)}); ${cacheClass} = t1; }`);
          emit(`${result}${cacheTarget}(thread, null${args.map((arg) => `, ${arg}`).join("")});`);
        }
        break;
      }
      case 0xba: {
        const entry = cp[cpIndex] as { value: { descriptor: string } };
        const type = parseMethodDescriptor(entry.value.descriptor);
        const base = D - type.argSlots;
        const args: string[] = [];
        let slot = base;

        for (const arg of type.args) {
          args.push(S(slot));
          slot += slots(arg);
        }

        const site = `y${pc}`;

        closureVars.push(site);
        emit(`JP[d] = ${pc};`);
        emit(`if (${site} === undefined) ${site} = H.indy(thread, K, ${cpIndex});`);
        emit(`t0 = [${args.join(", ")}];`);
        emit(`if (${site}.format) { t1 = ${site}.format(t0, false); if (t1 === null) throw H.own(); } else { t1 = ${site}.create(t0); }`);

        if (type.ret !== "V") emit(`${S(base)} = t1;`);
        break;
      }
      case 0xbb: {
        const target = resolveClass(vm, cls, cp[cpIndex]);

        if (target.isInterface || (target.access & 0x400) !== 0) {
          emit(`JP[d] = ${pc}; throw H.own();`);
          break;
        }

        initCheck(target, pc);
        emit(
          target === vm.stringClass
            ? `${S(D)} = { $cls: ${constant(target)} };`
            : `${S(D)} = new ${constant(target)}.ctor();`
        );
        break;
      }
      case 0xbc:
        emit(`${S(D - 1)} = H.newArray(thread, d, ${pc}, ${literal(NEWARRAY_TYPES[code[pc + 1]])}, ${S(D - 1)});`);
        break;
      case 0xbd: {
        const component = resolveClass(vm, cls, cp[cpIndex]);

        emit(`${S(D - 1)} = H.newArrayOf(thread, d, ${pc}, ${constant(component)}, ${S(D - 1)});`);
        break;
      }
      case 0xbe:
        emit(`t0 = ${S(D - 1)}; if (t0 === null) ${throwNpe(pc)}; ${S(D - 1)} = t0.length;`);
        break;
      case 0xbf:
        emit(`JP[d] = ${pc}; t0 = ${S(D - 1)}; if (t0 === null) ${throwNpe(pc)}; throw H.javaThrow(t0);`);
        break;
      case 0xc0: {
        const target = resolveClass(vm, cls, cp[cpIndex]);
        const name = constant(target);

        emit(`t0 = ${S(D - 1)};`);
        emit(`if (t0 !== null && (typeof t0 === "string" ? ${constant(vm.stringClass)} : t0.$cls) !== ${name} && !V.classOf(t0).isSubclassOf(${name})) H.cast(thread, d, ${pc}, t0, ${name});`);
        break;
      }
      case 0xc1: {
        const target = resolveClass(vm, cls, cp[cpIndex]);
        const name = constant(target);

        emit(`t0 = ${S(D - 1)}; ${S(D - 1)} = t0 === null ? 0 : V.classOf(t0).isSubclassOf(${name}) ? 1 : 0;`);
        break;
      }
      case 0xc2:
        emit(`t0 = ${S(D - 1)}; if (t0 === null) ${throwNpe(pc)};`);
        emit(`if (!H.tryEnter(thread, t0)) { JP[d] = ${pc}; throw H.own(); }`);
        break;
      case 0xc3:
        emit(`t0 = ${S(D - 1)}; if (t0 === null) ${throwNpe(pc)}; JP[d] = ${pc}; H.exit(thread, t0);`);
        break;
      case 0xc4: {
        const sub = code[pc + 1];
        const index = u16(code, pc + 2);

        if (sub >= 0x15 && sub <= 0x19) emit(`${S(D)} = ${L(index)};`);
        else if (sub === 0x37 || sub === 0x39) emit(`${L(index)} = ${S(D - 2)};`);
        else if (sub >= 0x36 && sub <= 0x3a) emit(`${L(index)} = ${S(D - 1)};`);
        else if (sub === 0x84) emit(`${L(index)} = (${L(index)} + ${s16(code, pc + 4)}) | 0;`);
        else return undefined;
        break;
      }
      case 0xc5: {
        const target = resolveClass(vm, cls, cp[cpIndex]);
        const dimensions = code[pc + 3];
        const counts = Array.from({ length: dimensions }, (_, i) => S(D - dimensions + i));

        emit(`${S(D - dimensions)} = H.multiArray(thread, d, ${pc}, ${constant(target)}, [${counts.join(", ")}]);`);
        break;
      }
      case 0xc6:
      case 0xc7: {
        const target = pc + s16(code, pc + 1);

        emit(`if (${S(D - 1)} ${op === 0xc6 ? "===" : "!=="} null) { ${backJump(target, pc)} }`);
        break;
      }
      default:
        return undefined;
    }
    } catch (error) {
      if (!(error instanceof JavaThrow)) throw error;

      // Resolution failed; the interpreter raises the error if this runs.
      body.length = mark;
      emit(`JP[d] = ${pc}; throw H.own();`);
    }
  }

  const locals = Array.from({ length: maxLocals }, (_, i) => L(i));
  const stack = Array.from({ length: maxStack }, (_, i) => S(i));
  const values = [...locals, ...stack].join(", ");
  const parameters: string[] = [];
  const argumentLocals: string[] = [];
  let slot = 0;

  if (!method.isStatic) {
    parameters.push("a0");
    argumentLocals.push(`${L(slot++)} = a0;`);
  }

  for (const type of method.args) {
    const name = `a${parameters.length}`;

    parameters.push(name);
    argumentLocals.push(`${L(slot)} = ${name};`);
    slot += slots(type);
  }

  const resumeLocals = locals.map((name, i) => `${name} = frame.locals[${i}];`).join(" ");
  const resumeStack = stack.map((name, i) => `${name} = frame.stack[${i}];`).join(" ");
  const depthTable = constant(Int32Array.from(depth));
  const argTable = constant(argSlotsAt);
  const nextTable = constant(nextPc);
  const source = `
${closureVars.length > 0 ? `let ${closureVars.join(", ")};` : ""}
return function jit_${method.name.replaceAll(/\W/g, "_")}(thread, frame${parameters.map((name) => `, ${name}`).join("")}) {
  let ${[...locals, ...stack, "t0", "t1", "t2", "t3"].join(", ")};
  let pc = 0, lock = null;
  const d = thread.jitDepth;
  if (frame === null) {
    if (d >= ${MAX_DEPTH}) throw H.own();
    ${argumentLocals.join(" ")}
  } else {
    pc = frame.pc; ${resumeLocals} ${resumeStack}
    lock = frame.lockedMonitor ?? null;
  }
  const JP = thread.jitPcs;
  thread.jitMethods[d] = METHOD;
  JP[d] = pc;
  thread.jitDepth = d + 1;
  ${
    sync
      ? `if (frame === null) {
    lock = ${method.isStatic ? "K" : L(0)};
    if (!H.tryEnter(thread, lock)) { thread.jitDepth = d; throw H.syncEntry(thread, METHOD, lock, [${values}]); }
  }`
      : ""
  }
  for (;;) {
    try {
      switch (pc) {
${body.join("\n")}
        default: throw new Error("No compiled block at " + pc);
      }
    } catch (error) {
      const ip = JP[d];
      thread.jitDepth = d;
      if (error instanceof H.Suspend) {
        const own = error.own;
        error.own = false;
        error.frames.unshift(H.materialize(METHOD, [${values}], ip, own ? ${depthTable}[ip] : ${depthTable}[ip] - ${argTable}[ip], own ? -1 : ${nextTable}[ip], lock, own && !error.preempted));
        error.preempted = false;
        throw error;
      }
      const exception = H.toJava(error);
      const handler = H.handler(METHOD, ip, exception);
      if (handler < 0) {
        if (lock !== null) H.exit(thread, lock);
        throw error instanceof H.JavaThrow ? error : H.javaThrow(exception);
      }
      thread.jitDepth = d + 1;
      s0 = exception;
      pc = handler;
    }
  }
};`;

  const names = constants.map((_, i) => `k${i}`);
  const factory = new Function("H", "V", "K", "METHOD", ...names, source) as (...args: unknown[]) => Compiled;
  const fn = factory(vm.jitHelpers, vm, cls, method, ...constants);

  fn.blockStarts = blockStarts;

  return fn;
};

// Returns false when the method cannot be compiled; it then stays interpreted.
export const compile = (vm: JVM, method: JMethod): boolean => {
  if (method.compiled !== undefined) return method.compiled !== null;

  if (failures.has(method) || !method.code || method.native || method.code.code.length > MAX_CODE_LENGTH) {
    method.compiled = null;

    return false;
  }

  method.compiled = null;

  try {
    const fn = generate(vm, method);

    if (!fn) return false;

    method.compiled = fn;

    return true;
  } catch (error) {
    failures.add(method);

    if (typeof process !== "undefined" && process.env.JAVA_RUNNER_JIT_DEBUG) {
      console.error(`JIT failed for ${method.toString()}`, error);
    }

    return false;
  }
};

const helperFrame = (method: JMethod, values: unknown[]): Frame => {
  const code = method.code as { maxLocals: number; maxStack: number };
  const frame = new Frame(method, code.maxLocals, code.maxStack);

  for (let i = 0; i < code.maxLocals; i++) frame.locals[i] = values[i];

  return frame;
};

// Runtime support called from generated code.
export class JitRuntime {
  public readonly d2i = d2i;

  public readonly d2l = d2l;

  public readonly JavaThrow = JavaThrow;

  public readonly Suspend = Suspend;

  public readonly tryEnter = tryEnter;

  private readonly vm: JVM;

  public constructor(vm: JVM) {
    this.vm = vm;
  }

  public aastore(thread: JThread, depth: number, ip: number, array: JArray | null, index: number, value: unknown): void {
    if (array === null) {
      thread.jitPcs[depth] = ip;
      this.vm.throwNew("java/lang/NullPointerException");
    }

    if (index >>> 0 >= array.length) {
      thread.jitPcs[depth] = ip;
      arrayIndexError(this.vm, index, array.length);
    }

    if (value !== null && !this.vm.classOf(value).isSubclassOf(array.$cls.componentType as JClass)) {
      thread.jitPcs[depth] = ip;
      this.vm.throwNew("java/lang/ArrayStoreException", describe(this.vm, value));
    }

    (array as unknown[])[index] = value;
  }

  public arithmetic(thread: JThread, depth: number, ip: number): never {
    thread.jitPcs[depth] = ip;

    return this.vm.throwNew("java/lang/ArithmeticException", "/ by zero");
  }

  public bounds(thread: JThread, depth: number, ip: number, index: number, length: number): never {
    thread.jitPcs[depth] = ip;

    return arrayIndexError(this.vm, index, length);
  }

  public cast(thread: JThread, depth: number, ip: number, value: unknown, cls: JClass): never {
    thread.jitPcs[depth] = ip;

    return castError(this.vm, value, cls);
  }

  // The callable used by compiled code: the compiled method, a wrapper around
  // a synchronous native, or a stub that hands the call to the interpreter.
  public entry(method: JMethod): Entry {
    if (method.entry) return method.entry;

    const { vm } = this;

    if (method.native === undefined) method.native = vm.lookupNative(method);

    const { native } = method;

    if (native && !native.generator) {
      const { fn } = native;

      method.entry = (thread, _frame, ...args) => {
        const result = fn(thread, args);

        if (vm.exitCode !== undefined || thread.state === TERMINATED) throw new Terminated();

        return result;
      };
    } else if (!native && method.code && compile(vm, method)) {
      method.entry = method.compiled as Entry;
    } else {
      method.entry = () => {
        throw new Suspend();
      };
    }

    return method.entry;
  }

  public exit(thread: JThread, target: Lockable): void {
    exit(this.vm, thread, target);
  }

  public handler(method: JMethod, pc: number, exception: JObject): number {
    for (const handler of method.handlers) {
      if (pc < handler.startPc || pc >= handler.endPc) continue;

      if (handler.catchClass === undefined) {
        handler.catchClass = this.vm.loadClass(handler.catchType as string, method.cls.loader);
      }

      if (handler.catchClass === null || exception.$cls.isSubclassOf(handler.catchClass)) {
        return handler.handlerPc;
      }
    }

    return -1;
  }

  public indy(thread: JThread, cls: JClass, index: number): ReturnType<typeof bootstrapIndy> {
    return bootstrapIndy(this.vm, thread, cls, index);
  }

  public javaThrow(exception: JObject): JavaThrow {
    return new JavaThrow(exception);
  }

  public ldc(thread: JThread, cls: JClass, constant: ConstantPoolEntry): unknown {
    return resolveConstant(this.vm, thread, cls, constant);
  }

  public materialize(
    method: JMethod,
    values: unknown[],
    pc: number,
    sp: number,
    resumePc: number,
    lock: Lockable | null,
    bail: boolean
  ): Frame {
    const code = method.code as { maxLocals: number; maxStack: number };
    const frame = helperFrame(method, values);

    for (let i = 0; i < sp; i++) frame.stack[i] = values[code.maxLocals + i];

    frame.pc = pc;
    frame.sp = sp;
    frame.resumePc = resumePc;
    frame.lockedMonitor = lock ?? undefined;
    frame.bailPc = bail ? pc : -1;

    return frame;
  }

  public multiArray(thread: JThread, depth: number, ip: number, cls: JClass, counts: number[]): JArray {
    thread.jitPcs[depth] = ip;

    for (const count of counts) {
      if (count < 0) this.vm.throwNew("java/lang/NegativeArraySizeException", String(count));
    }

    return newMultiArray(this.vm, cls, counts, 0);
  }

  public newArray(thread: JThread, depth: number, ip: number, type: string, length: number): JArray {
    thread.jitPcs[depth] = ip;

    return this.vm.newArray(type, length);
  }

  public newArrayOf(thread: JThread, depth: number, ip: number, cls: JClass, length: number): JArray {
    thread.jitPcs[depth] = ip;

    return this.vm.newArrayOf(cls, length);
  }

  public npe(thread: JThread, depth: number, ip: number, message?: string): never {
    thread.jitPcs[depth] = ip;

    return this.vm.throwNew("java/lang/NullPointerException", message);
  }

  public own(): Suspend {
    return new Suspend();
  }

  public preempt(): Suspend | undefined {
    const { vm } = this;

    vm.jitBudget = CHECK_INTERVAL;

    if (performance.now() < vm.deadline) return undefined;

    const suspend = new Suspend();

    suspend.preempted = true;

    return suspend;
  }

  public syncEntry(thread: JThread, method: JMethod, lock: Lockable, values: unknown[]): Suspend {
    const suspend = new Suspend();
    const frame = helperFrame(method, values);
    const generator = new Frame(monitorMethod(this.vm), 0, 0);

    frame.pendingLock = lock;
    generator.gen = enter(this.vm, thread, lock);
    suspend.own = false;
    suspend.frames.push(frame, generator);

    return suspend;
  }

  public target(cls: JClass, resolved: JMethod): Entry {
    if (resolved.isPrivate) return this.entry(resolved);

    const method = cls.vtable.get(resolved.key);

    if (method) return this.entry(method);

    if (resolved.isStatic || resolved.isAbstract) {
      return this.vm.throwNew("java/lang/AbstractMethodError", resolved.toString());
    }

    return this.entry(resolved);
  }

  public toJava(error: unknown): JObject {
    if (error instanceof JavaThrow) return error.exception;

    if (error instanceof RangeError && /call stack/i.test(error.message)) {
      return this.vm.newThrowable("java/lang/StackOverflowError");
    }

    throw error;
  }
}

export const jitHelpers = (vm: JVM): JitRuntime => new JitRuntime(vm);
