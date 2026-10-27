import {
  type HostFile,
  type HostFileSystem,
} from "./vm.ts";

type Entry = { data?: Uint8Array; lastModified: number };

const parentOf = (path: string): string =>
  path.slice(0, path.lastIndexOf("/")) || "/";

export const createMemoryFileSystem = (
  initial: Record<string, string | Uint8Array> = {}
): HostFileSystem & { files: Map<string, Entry> } => {
  const files = new Map<string, Entry>([["/", { lastModified: Date.now() }]]);
  const mkdirs = (path: string): void => {
    if (files.has(path)) return;

    mkdirs(parentOf(path));
    files.set(path, { lastModified: Date.now() });
  };

  for (const [path, content] of Object.entries(initial)) {
    mkdirs(parentOf(path));
    files.set(path, {
      data:
        typeof content === "string"
          ? new TextEncoder().encode(content)
          : content,
      lastModified: Date.now(),
    });
  }

  const remove = (path: string): boolean => {
    const entry = files.get(path);

    if (!entry || path === "/") return false;

    if (
      !entry.data &&
      [...files.keys()].some((key) => key !== path && parentOf(key) === path)
    ) {
      return false;
    }

    return files.delete(path);
  };
  const list = (path: string): string[] | undefined => {
    const entry = files.get(path);

    if (!entry || entry.data) return undefined;

    return [...files.keys()]
      .filter((key) => key !== path && parentOf(key) === path)
      .map((key) => key.slice(key.lastIndexOf("/") + 1));
  };
  const mkdir = (path: string): boolean => {
    if (files.has(path) || !files.has(parentOf(path))) return false;

    files.set(path, { lastModified: Date.now() });

    return true;
  };
  const rename = (from: string, to: string): boolean => {
    if (!files.has(from) || !files.has(parentOf(to))) return false;

    const moved = [...files.keys()].filter(
      (key) => key === from || key.startsWith(`${from}/`)
    );

    for (const key of moved) {
      const value = files.get(key) as Entry;

      files.delete(key);
      files.set(to + key.slice(from.length), value);
    }

    return true;
  };
  const stat = (path: string): HostFile | undefined => {
    const entry = files.get(path);

    return entry
      ? {
          isDirectory: !entry.data,
          lastModified: entry.lastModified,
          size: entry.data?.length ?? 0,
        }
      : undefined;
  };
  const write = (path: string, data: Uint8Array, append: boolean): boolean => {
    if (!files.has(parentOf(path))) return false;

    const existing = files.get(path);

    if (existing && !existing.data) return false;

    const merged =
      append && existing?.data
        ? new Uint8Array([...existing.data, ...data])
        : new Uint8Array(data);

    files.set(path, { data: merged, lastModified: Date.now() });

    return true;
  };

  return {
    delete: (path) => Promise.resolve(remove(path)),
    files,
    list: (path) => Promise.resolve(list(path)),
    mkdir: (path) => Promise.resolve(mkdir(path)),
    read: (path) => Promise.resolve(files.get(path)?.data),
    rename: (from, to) => Promise.resolve(rename(from, to)),
    stat: (path) => Promise.resolve(stat(path)),
    write: (path, data, append) => Promise.resolve(write(path, data, append)),
  };
};
