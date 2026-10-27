import {
  ensureInitialized,
} from "./helpers.ts";
import {
  type JArray,
  JavaThrow,
  type JClass,
  type JObject,
  type JThread,
} from "../types.ts";
import { type JVM, type NativeTable } from "../vm.ts";

const FIELD_BASE = 1 << 20;
const ARRAY_BASE = 16;

type Memory = { data: Uint8Array; view: DataView };

const ELEMENT_SIZES: Record<string, number> = {
  B: 1,
  C: 2,
  D: 8,
  F: 4,
  I: 4,
  J: 8,
  S: 2,
  Z: 1,
};

const viewOf = (array: JArray): DataView => {
  const typed = array as unknown as Int8Array;

  return new DataView(typed.buffer, typed.byteOffset, typed.byteLength);
};

export const unsafeNatives = (vm: JVM): NativeTable => {
  const keys: string[] = [];
  const ids = new Map<string, number>();
  const offsetOf = (key: string): bigint => {
    let id = ids.get(key);

    if (id === undefined) {
      id = keys.length;
      keys.push(key);
      ids.set(key, id);
    }

    return BigInt(FIELD_BASE + id);
  };
  const memory = new Map<number, Memory>();
  let nextAddress = 0x10000;
  const findMemory = (address: number): [Memory, number] => {
    for (const [base, block] of memory) {
      if (address >= base && address < base + block.data.length) {
        return [block, address - base];
      }
    }

    return vm.throwNew("java/lang/InternalError", `Bad native address ${address}`);
  };
  const elementSize = (array: JArray): number => {
    const component = array.$cls.componentType as JClass;

    return component.isPrimitive
      ? ELEMENT_SIZES[vm.primitiveDescriptor(component)]
      : 4;
  };

  type Kind = "B" | "C" | "D" | "F" | "I" | "J" | "L" | "S" | "Z";

  const readView = (view: DataView, at: number, kind: Kind): unknown => {
    switch (kind) {
      case "B":
      case "Z":
        return view.getInt8(at);
      case "C":
        return view.getUint16(at, true);
      case "S":
        return view.getInt16(at, true);
      case "I":
        return view.getInt32(at, true);
      case "F":
        return view.getFloat32(at, true);
      case "J":
        return view.getBigInt64(at, true);
      case "D":
        return view.getFloat64(at, true);
      default:
        return vm.throwNew("java/lang/InternalError", "reference in raw memory");
    }
  };
  const writeView = (view: DataView, at: number, kind: Kind, value: unknown): void => {
    switch (kind) {
      case "B":
      case "Z":
        view.setInt8(at, value as number);
        break;
      case "C":
        view.setUint16(at, value as number, true);
        break;
      case "S":
        view.setInt16(at, value as number, true);
        break;
      case "I":
        view.setInt32(at, value as number, true);
        break;
      case "F":
        view.setFloat32(at, value as number, true);
        break;
      case "J":
        view.setBigInt64(at, value as bigint, true);
        break;
      case "D":
        view.setFloat64(at, value as number, true);
        break;
      default:
        vm.throwNew("java/lang/InternalError", "reference in raw memory");
    }
  };
  const read = (target: unknown, offset: bigint, kind: Kind): unknown => {
    const at = Number(offset);

    if (target === null) {
      const [block, index] = findMemory(at);

      return readView(block.view, index, kind);
    }

    if (at >= FIELD_BASE) return (target as JObject)[keys[at - FIELD_BASE]];

    const array = target as JArray;

    if (Array.isArray(array)) return array[(at - ARRAY_BASE) / 4];

    const size = elementSize(array);
    const wanted = kind === "L" ? 4 : ELEMENT_SIZES[kind];

    if (size === wanted) return (array as unknown as unknown[])[(at - ARRAY_BASE) / size];

    return readView(viewOf(array), at - ARRAY_BASE, kind);
  };
  const write = (target: unknown, offset: bigint, kind: Kind, value: unknown): void => {
    const at = Number(offset);

    if (target === null) {
      const [block, index] = findMemory(at);

      writeView(block.view, index, kind, value);

      return;
    }

    if (at >= FIELD_BASE) {
      (target as JObject)[keys[at - FIELD_BASE]] = value;

      return;
    }

    const array = target as JArray;

    if (Array.isArray(array)) {
      array[(at - ARRAY_BASE) / 4] = value;

      return;
    }

    const size = elementSize(array);
    const wanted = kind === "L" ? 4 : ELEMENT_SIZES[kind];

    if (size === wanted) {
      (array as unknown as unknown[])[(at - ARRAY_BASE) / size] = value;

      return;
    }

    writeView(viewOf(array), at - ARRAY_BASE, kind, value);
  };
  const U = "jdk/internal/misc/Unsafe.";
  const table: NativeTable = {
    [`${U}allocateInstance(Ljava/lang/Class;)Ljava/lang/Object;`]: {
      *gen(t, [, cls]) {
        yield* ensureInitialized(vm, t, cls as JClass);

        return vm.newObject(cls as JClass);
      },
    },
    [`${U}allocateMemory0(J)J`]: (_t, [, bytes]) => {
      const size = Math.max(1, Number(bytes));
      const address = nextAddress;
      const data = new Uint8Array(size);

      memory.set(address, { data, view: new DataView(data.buffer) });
      nextAddress += (size + 15) & ~15;

      return BigInt(address);
    },
    [`${U}arrayBaseOffset0(Ljava/lang/Class;)I`]: () => ARRAY_BASE,
    [`${U}arrayIndexScale0(Ljava/lang/Class;)I`]: (_t, [, cls]) => {
      const component = (cls as JClass).componentType as JClass;

      return component.isPrimitive
        ? ELEMENT_SIZES[vm.primitiveDescriptor(component)]
        : 4;
    },
    [`${U}copyMemory0(Ljava/lang/Object;JLjava/lang/Object;JJ)V`]: (
      _t,
      [, src, srcOffset, dest, destOffset, bytes]
    ) => {
      const count = Number(bytes);
      const buffer: unknown[] = [];

      for (let i = 0; i < count; i++) {
        buffer.push(read(src, (srcOffset as bigint) + BigInt(i), "B"));
      }

      for (let i = 0; i < count; i++) {
        write(dest, (destOffset as bigint) + BigInt(i), "B", buffer[i]);
      }
    },
    [`${U}ensureClassInitialized0(Ljava/lang/Class;)V`]: {
      *gen(t, [, cls]) {
        yield* ensureInitialized(vm, t, cls as JClass);
      },
    },
    [`${U}freeMemory0(J)V`]: (_t, [, address]) => {
      memory.delete(Number(address));
    },
    [`${U}fullFence()V`]: () => null,
    [`${U}getLoadAverage0([DI)I`]: () => -1,
    [`${U}objectFieldOffset0(Ljava/lang/reflect/Field;)J`]: (_t, [, field]) => {
      const reflected = field as JObject;
      const cls = reflected._clazz as JClass;

      return offsetOf(cls.declaredFields[reflected._slot as number].key);
    },
    [`${U}objectFieldOffset1(Ljava/lang/Class;Ljava/lang/String;)J`]: (
      _t,
      [, cls, name]
    ) => {
      const field = (cls as JClass).field(name as string);

      if (!field) vm.throwNew("java/lang/InternalError", name as string);

      return offsetOf(field.key);
    },
    [`${U}park(ZJ)V`]: {
      *gen(t, [, absolute, time]) {
        if (t.parkPermit) {
          t.parkPermit = false;

          return;
        }

        if (t.interrupted) return;

        const delay = absolute
          ? Number(time) - Date.now()
          : Number(time) / 1_000_000;

        if (absolute && delay <= 0) return;

        yield vm.wait(
          new Promise<void>((resolve) => {
            let cancel: (() => void) | undefined;
            const done = (): void => {
              cancel?.();

              t.parkWaiter = undefined;
              t.interruptWaiter = undefined;
              resolve();
            };

            t.parkWaiter = done;
            t.interruptWaiter = done;

            if ((time as bigint) > 0n) cancel = vm.setTimer(done, Math.max(0, delay));
          })
        );
        t.parkPermit = false;
      },
    },
    [`${U}reallocateMemory0(JJ)J`]: (_t, [, address, bytes]) => {
      const size = Math.max(1, Number(bytes));
      const old = memory.get(Number(address));
      const fresh = nextAddress;
      const data = new Uint8Array(size);

      if (old) {
        data.set(old.data.subarray(0, Math.min(size, old.data.length)));
        memory.delete(Number(address));
      }

      memory.set(fresh, { data, view: new DataView(data.buffer) });
      nextAddress += (size + 15) & ~15;

      return BigInt(fresh);
    },
    [`${U}registerNatives()V`]: () => null,
    [`${U}setMemory0(Ljava/lang/Object;JJB)V`]: (_t, [, target, offset, bytes, value]) => {
      for (let i = 0n; i < (bytes as bigint); i++) {
        write(target, (offset as bigint) + i, "B", value);
      }
    },
    [`${U}shouldBeInitialized0(Ljava/lang/Class;)Z`]: (_t, [, cls]) =>
      (cls as JClass).state === 3 ? 0 : 1,
    [`${U}staticFieldBase0(Ljava/lang/reflect/Field;)Ljava/lang/Object;`]: (
      _t,
      [, field]
    ) => ((field as JObject)._clazz as JClass).statics,
    [`${U}staticFieldOffset0(Ljava/lang/reflect/Field;)J`]: (_t, [, field]) => {
      const reflected = field as JObject;
      const cls = reflected._clazz as JClass;

      return offsetOf(cls.declaredFields[reflected._slot as number].key);
    },
    [`${U}throwException(Ljava/lang/Throwable;)V`]: (_t, [, exception]) => {
      throw new JavaThrow(exception as JObject);
    },
    [`${U}unpark(Ljava/lang/Object;)V`]: (_t, [, threadObject]) => {
      const thread = (threadObject as JObject | null)?.$thread as JThread | undefined;

      if (!thread) return;

      if (thread.parkWaiter) thread.parkWaiter();
      else thread.parkPermit = true;
    },
  };
  const kinds: [string, Kind][] = [
    ["Int", "I"],
    ["Long", "J"],
    ["Short", "S"],
    ["Char", "C"],
    ["Byte", "B"],
    ["Boolean", "Z"],
    ["Float", "F"],
    ["Double", "D"],
    ["Reference", "L"],
  ];

  for (const [name, kind] of kinds) {
    const descriptor = kind === "L" ? "Ljava/lang/Object;" : kind;

    for (const suffix of ["", "Volatile"]) {
      table[`${U}get${name}${suffix}(Ljava/lang/Object;J)${descriptor}`] = (
        _t,
        [, target, offset]
      ) => read(target, offset as bigint, kind);
      table[`${U}put${name}${suffix}(Ljava/lang/Object;J${descriptor})V`] = (
        _t,
        [, target, offset, value]
      ) => write(target, offset as bigint, kind, value);
    }

    if (kind === "I" || kind === "J" || kind === "L") {
      table[`${U}compareAndSet${name}(Ljava/lang/Object;J${descriptor}${descriptor})Z`] = (
        _t,
        [, target, offset, expected, value]
      ) => {
        if (read(target, offset as bigint, kind) !== expected) return 0;

        write(target, offset as bigint, kind, value);

        return 1;
      };
      table[
        `${U}compareAndExchange${name}(Ljava/lang/Object;J${descriptor}${descriptor})${descriptor}`
      ] = (_t, [, target, offset, expected, value]) => {
        const current = read(target, offset as bigint, kind);

        if (current === expected) write(target, offset as bigint, kind, value);

        return current;
      };
    }
  }

  return table;
};
