import {
  bytesOf,
  stringArray,
} from "./helpers.ts";
import { type JArray, type JObject } from "../types.ts";
import {
  type HostFileSystem,
  type JVM,
  type NativeTable,
} from "../vm.ts";

type OpenFile = {
  append: boolean;
  data: Uint8Array;
  path: string;
  pending: Uint8Array[];
  position: number;
};

const fileOf = (fd: unknown): OpenFile | undefined =>
  (fd as JObject).$file as OpenFile | undefined;

const fdNumber = (fd: unknown): number => (fd as JObject)._fd as number;

const join = (chunks: Uint8Array[]): Uint8Array => {
  const size = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
};

export const ioNatives = (vm: JVM): NativeTable => {
  const fs = (): HostFileSystem => {
    if (!vm.host.fs) vm.throwNew("java/io/IOException", "No file system");

    return vm.host.fs;
  };
  let stdin: { data: Uint8Array; position: number } | undefined;
  // Files under java.home (time zone data) come from the runtime jar.
  const runtimeFile = (path: string): Uint8Array | undefined => {
    const home = `${vm.properties["java.home"]}/`;

    return path.startsWith(home) ? vm.readResource(path.slice(home.length)) : undefined;
  };

  const readStdin = function* readStdin(): Generator<
    ReturnType<JVM["wait"]>,
    { data: Uint8Array; position: number } | undefined,
    unknown
  > {
    if (stdin && stdin.position < stdin.data.length) return stdin;

    if (!vm.host.readStdin) return undefined;

    const data = (yield vm.wait(vm.host.readStdin())) as Uint8Array | undefined;

    if (!data || data.length === 0) return undefined;

    stdin = { data, position: 0 };

    return stdin;
  };
  const flush = function* flush(
    file: OpenFile
  ): Generator<ReturnType<JVM["wait"]>, void, unknown> {
    if (file.pending.length === 0) return;

    const data = join(file.pending);

    file.pending = [];

    const ok = (yield vm.wait(fs().write(file.path, data, file.append))) as boolean;

    file.append = true;

    if (!ok) vm.throwNew("java/io/IOException", `Could not write ${file.path}`);
  };

  const FIS = "java/io/FileInputStream.";
  const FOS = "java/io/FileOutputStream.";
  const FILE = "java/io/File.";

  return {
    [`${FILE}create0(Ljava/lang/String;)Z`]: {
      *gen(_t, [path]) {
        return (yield vm.wait(fs().write(path as string, new Uint8Array(0), false)))
          ? 1
          : 0;
      },
    },
    [`${FILE}delete0(Ljava/lang/String;)Z`]: {
      *gen(_t, [path]) {
        return (yield vm.wait(fs().delete(path as string))) ? 1 : 0;
      },
    },
    [`${FILE}list0(Ljava/lang/String;)[Ljava/lang/String;`]: {
      *gen(_t, [path]) {
        const names = (yield vm.wait(fs().list(path as string))) as
          | string[]
          | undefined;

        return names ? stringArray(vm, names) : null;
      },
    },
    [`${FILE}mkdir0(Ljava/lang/String;)Z`]: {
      *gen(_t, [path]) {
        return (yield vm.wait(fs().mkdir(path as string))) ? 1 : 0;
      },
    },
    [`${FILE}rename0(Ljava/lang/String;Ljava/lang/String;)Z`]: {
      *gen(_t, [from, to]) {
        return (yield vm.wait(fs().rename(from as string, to as string))) ? 1 : 0;
      },
    },
    [`${FILE}stat0(Ljava/lang/String;)[J`]: {
      *gen(_t, [path]) {
        const resource = runtimeFile(path as string);
        const stat = resource
          ? { isDirectory: false, lastModified: 0, size: resource.length }
          : ((yield vm.wait(fs().stat(path as string))) as
              | { isDirectory: boolean; lastModified: number; size: number }
              | undefined);

        if (!stat) return null;

        const array = vm.newArray("J", 3);
        const values = array as unknown as BigInt64Array;

        values[0] = stat.isDirectory ? 1n : 0n;
        values[1] = BigInt(stat.size);
        values[2] = BigInt(Math.round(stat.lastModified));

        return array;
      },
    },
    [`${FIS}available0(Ljava/io/FileDescriptor;)I`]: (_t, [fd]) => {
      const file = fileOf(fd) ?? (fdNumber(fd) === 0 ? stdin : undefined);

      return file ? file.data.length - file.position : 0;
    },
    [`${FIS}open0(Ljava/io/FileDescriptor;Ljava/lang/String;)V`]: {
      *gen(_t, [fd, path]) {
        const name = path as string;
        const resource = runtimeFile(name);

        if (resource) {
          (fd as JObject).$file = {
            append: false,
            data: resource,
            path: name,
            pending: [],
            position: 0,
          } satisfies OpenFile;

          return;
        }

        const stat = (yield vm.wait(fs().stat(name))) as
          | { isDirectory: boolean }
          | undefined;

        if (!stat) {
          vm.throwNew("java/io/FileNotFoundException", `${name} (No such file or directory)`);
        }

        if (stat.isDirectory) {
          vm.throwNew("java/io/FileNotFoundException", `${name} (Is a directory)`);
        }

        const data = (yield vm.wait(fs().read(name))) as Uint8Array | undefined;

        (fd as JObject).$file = {
          append: false,
          data: data ?? new Uint8Array(0),
          path: name,
          pending: [],
          position: 0,
        } satisfies OpenFile;
      },
    },
    [`${FIS}read0(Ljava/io/FileDescriptor;)I`]: {
      *gen(_t, [fd]) {
        const file = fileOf(fd);

        if (!file) {
          if (fdNumber(fd) !== 0) return -1;

          const input = yield* readStdin();

          return input ? input.data[input.position++] : -1;
        }

        return file.position < file.data.length ? file.data[file.position++] : -1;
      },
    },
    [`${FIS}readBytes(Ljava/io/FileDescriptor;[BII)I`]: {
      *gen(_t, [fd, bytes, offset, length]) {
        const file = fileOf(fd) ?? (fdNumber(fd) === 0 ? yield* readStdin() : undefined);

        if (!file || file.position >= file.data.length) return -1;

        const count = Math.min(length as number, file.data.length - file.position);

        bytesOf(bytes as JArray).set(
          file.data.subarray(file.position, file.position + count),
          offset as number
        );
        file.position += count;

        return count;
      },
    },
    [`${FIS}skip0(Ljava/io/FileDescriptor;J)J`]: (_t, [fd, count]) => {
      const file = fileOf(fd);

      if (!file) return 0n;

      const skipped = Math.max(
        0,
        Math.min(Number(count), file.data.length - file.position)
      );

      file.position += skipped;

      return BigInt(skipped);
    },
    [`${FOS}close0(Ljava/io/FileDescriptor;)V`]: {
      *gen(_t, [fd]) {
        const file = fileOf(fd);

        if (file) yield* flush(file);
      },
    },
    [`${FOS}flush0(Ljava/io/FileDescriptor;)V`]: {
      *gen(_t, [fd]) {
        const file = fileOf(fd);

        if (file) yield* flush(file);
      },
    },
    [`${FOS}open0(Ljava/io/FileDescriptor;Ljava/lang/String;Z)V`]: {
      *gen(_t, [fd, path, append]) {
        const name = path as string;
        const parent = name.slice(0, name.lastIndexOf("/")) || "/";
        const parentStat = (yield vm.wait(fs().stat(parent))) as
          | { isDirectory: boolean }
          | undefined;

        if (!parentStat?.isDirectory) {
          vm.throwNew("java/io/FileNotFoundException", `${name} (No such file or directory)`);
        }

        const stat = (yield vm.wait(fs().stat(name))) as
          | { isDirectory: boolean }
          | undefined;

        if (stat?.isDirectory) {
          vm.throwNew("java/io/FileNotFoundException", `${name} (Is a directory)`);
        }

        if (!append || !stat) {
          yield vm.wait(fs().write(name, new Uint8Array(0), false));
        }

        (fd as JObject).$file = {
          append: true,
          data: new Uint8Array(0),
          path: name,
          pending: [],
          position: 0,
        } satisfies OpenFile;
      },
    },
    [`${FOS}writeBytes(Ljava/io/FileDescriptor;[BII)V`]: (_t, [fd, bytes, offset, length]) => {
      const data = bytesOf(bytes as JArray).slice(
        offset as number,
        (offset as number) + (length as number)
      );
      const file = fileOf(fd);

      if (file) {
        file.pending.push(data);

        return;
      }

      if (fdNumber(fd) === 2) vm.host.stderr(data);
      else vm.host.stdout(data);
    },
  };
};
