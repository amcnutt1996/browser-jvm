import {
  type ClassFile,
  CONSTANT_Double,
  CONSTANT_Float,
  CONSTANT_Integer,
  CONSTANT_Long,
  CONSTANT_String,
  parseClassFile,
} from "./classfile.ts";
import {
  defaultValue,
  PRIMITIVE_NAMES,
} from "./descriptors.ts";
import { execute } from "./interpreter.ts";
import { jitHelpers } from "./jit.ts";
import {
  type ClassSource,
  Frame,
  INITIALIZED,
  INITIALIZING,
  InternalError,
  type JArray,
  JavaThrow,
  JClass,
  JField,
  JMethod,
  type JObject,
  JThread,
  LINKED,
  type Native,
  type NativeFunction,
  type NativeGenerator,
  type Request,
  RUNNABLE,
  TERMINATED,
} from "./types.ts";
import { ZipArchive } from "./zip.ts";

export type HostFile = {
  isDirectory: boolean;
  lastModified: number;
  size: number;
};

export type HostFileSystem = {
  delete: (path: string) => Promise<boolean>;
  list: (path: string) => Promise<string[] | undefined>;
  mkdir: (path: string) => Promise<boolean>;
  read: (path: string) => Promise<Uint8Array | undefined>;
  rename: (from: string, to: string) => Promise<boolean>;
  stat: (path: string) => Promise<HostFile | undefined>;
  write: (path: string, data: Uint8Array, append: boolean) => Promise<boolean>;
};

export type Host = {
  env?: Record<string, string>;
  fs?: HostFileSystem;
  properties?: Record<string, string>;
  readStdin?: () => Promise<Uint8Array | undefined>;
  schedule?: (callback: () => void, delay: number) => void;
  services?: Record<string, unknown>;
  stderr: (data: Uint8Array) => void;
  stdout: (data: Uint8Array) => void;
};

type ClassPathEntry = {
  multiRelease: boolean;
  source: ClassSource;
  zip: ZipArchive;
};

export type NativeTable = Record<
  string,
  { gen: NativeGenerator } | NativeFunction
>;

const PRIMITIVE_ARRAYS: Record<string, (length: number) => JArray> = {
  B: (length) => new Int8Array(length) as JArray,
  C: (length) => new Uint16Array(length) as JArray,
  D: (length) => new Float64Array(length) as JArray,
  F: (length) => new Float32Array(length) as JArray,
  I: (length) => new Int32Array(length) as JArray,
  J: (length) => new BigInt64Array(length) as JArray,
  S: (length) => new Int16Array(length) as JArray,
  Z: (length) => new Int8Array(length) as JArray,
};

export const RUNTIME_VERSION = 11;

// Exceptions the VM and its natives create directly; they are initialized at
// boot so they can be created without running Java code.
export const VM_EXCEPTIONS = [
  "java/io/EOFException",
  "java/io/FileNotFoundException",
  "java/io/IOException",
  "java/io/UnsupportedEncodingException",
  "java/lang/AbstractMethodError",
  "java/lang/ArithmeticException",
  "java/lang/ArrayIndexOutOfBoundsException",
  "java/lang/ArrayStoreException",
  "java/lang/ClassCastException",
  "java/lang/ClassNotFoundException",
  "java/lang/CloneNotSupportedException",
  "java/lang/ExceptionInInitializerError",
  "java/lang/IllegalAccessError",
  "java/lang/IllegalArgumentException",
  "java/lang/IllegalMonitorStateException",
  "java/lang/IllegalStateException",
  "java/lang/IncompatibleClassChangeError",
  "java/lang/IndexOutOfBoundsException",
  "java/lang/InstantiationError",
  "java/lang/InstantiationException",
  "java/lang/InternalError",
  "java/lang/InterruptedException",
  "java/lang/NegativeArraySizeException",
  "java/lang/NoClassDefFoundError",
  "java/lang/NoSuchFieldError",
  "java/lang/NoSuchMethodError",
  "java/lang/NullPointerException",
  "java/lang/NumberFormatException",
  "java/lang/OutOfMemoryError",
  "java/lang/StackOverflowError",
  "java/lang/StringIndexOutOfBoundsException",
  "java/lang/UnsatisfiedLinkError",
  "java/lang/UnsupportedOperationException",
  "java/lang/VerifyError",
  "java/lang/reflect/InvocationTargetException",
  "java/util/zip/DataFormatException",
  "java/util/zip/ZipException",
];

const SLICE_MS = 12;
const QUANTUM_MS = 4;

const isVirtual = (method: JMethod): boolean =>
  !method.isStatic && !method.isPrivate && !method.name.startsWith("<");

const now = (): number => performance.now();

export class JVM {
  public readonly appLoader: JObject | null = null;

  public readonly classes = new Map<string, JClass>();

  public classClass!: JClass;

  public currentThread: JThread | undefined;

  public deadline = 0;

  public exitCode: number | undefined;

  public exitStatusOnFinish = 0;

  public readonly host: Host;

  public jitBudget = 4096;

  public readonly jitHelpers: ReturnType<typeof jitHelpers>;

  // Interpreter entries into a method before it is compiled; -1 disables
  // the compiler.
  public jitThreshold = 3;

  public readonly manifests = new Map<string, Record<string, string>>();

  public readonly natives = new Map<string, Native>();

  public objectClass!: JClass;

  public readonly primitives = new Map<string, JClass>();

  public readonly properties: Record<string, string>;

  public readonly state: Record<string, unknown> = {};

  public stringClass!: JClass;

  public readonly threads: JThread[] = [];

  private readonly appPath: ClassPathEntry[] = [];

  private readonly bootPath: ClassPathEntry[] = [];

  private exitListeners: ((code: number) => void)[] = [];

  private hashSeed = 0x2545f491;

  private nextThreadId = 1;

  private pumpScheduled = false;

  private readonly runQueue: JThread[] = [];

  private readonly sourcesByLoader = new Map<JObject | null, ClassPathEntry[]>();

  private stopped = false;

  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  public constructor(host: Host) {
    this.host = host;
    this.jitHelpers = jitHelpers(this);
    this.properties = {
      "file.encoding": "UTF-8",
      "file.separator": "/",
      "java.class.path": "",
      "java.home": "/java",
      "java.io.tmpdir": "/tmp",
      "java.runtime.name": "gregOS Java Runner",
      "java.specification.version": String(RUNTIME_VERSION),
      "java.vendor": "gregOS",
      "java.version": `${RUNTIME_VERSION}.0.0`,
      "java.vm.name": "gregOS Java Runner",
      "line.separator": "\n",
      "native.encoding": "UTF-8",
      "os.arch": "amd64",
      "os.name": "Linux",
      "os.version": "6.0",
      "path.separator": ":",
      "stderr.encoding": "UTF-8",
      "stdout.encoding": "UTF-8",
      "sun.jnu.encoding": "UTF-8",
      "user.dir": "/",
      "user.home": "/",
      "user.language": "en",
      "user.name": "user",
      ...host.properties,
    };

    for (const descriptor of Object.keys(PRIMITIVE_NAMES)) {
      const cls = new JClass(
        PRIMITIVE_NAMES[descriptor],
        undefined,
        { loader: null },
        "primitive"
      );

      cls.state = INITIALIZED;
      this.primitives.set(descriptor, cls);
    }

    this.sourcesByLoader.set(null, this.bootPath);
  }

  public addBootClassPath(data: Uint8Array, path = "runtime.jar"): void {
    this.bootPath.push({
      multiRelease: false,
      source: { loader: null, path },
      zip: new ZipArchive(data),
    });
  }

  public addClassPath(data: Uint8Array, path = "app.jar"): ZipArchive {
    const zip = new ZipArchive(data);
    const manifestBytes = zip.read("META-INF/MANIFEST.MF");
    const manifest: Record<string, string> = {};

    if (manifestBytes) {
      const text = new TextDecoder()
        .decode(manifestBytes)
        .replaceAll(/\r?\n /g, "");

      for (const line of text.split(/\r?\n/)) {
        const colon = line.indexOf(":");

        if (colon > 0) {
          manifest[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
        }
      }
    }

    this.manifests.set(path, manifest);

    const multiRelease = manifest["Multi-Release"]?.toLowerCase() === "true";

    this.appPath.push({
      multiRelease,
      source: { loader: this.appLoader, path },
      zip,
    });
    this.properties["java.class.path"] = this.appPath
      .map((entry) => entry.source.path)
      .join(":");

    return zip;
  }

  public addNatives(table: NativeTable): void {
    for (const [key, value] of Object.entries(table)) {
      this.natives.set(
        key,
        typeof value === "function"
          ? { fn: value, generator: false }
          : { fn: value.gen, generator: true }
      );
    }
  }

  public arrayClass(component: JClass): JClass {
    if (component.arrayClass) return component.arrayClass;

    const name = component.isArray
      ? `[${component.name}`
      : component.isPrimitive
        ? `[${this.primitiveDescriptor(component)}`
        : `[L${component.name};`;
    const cls = new JClass(
      name,
      undefined,
      { loader: component.loader },
      "array"
    );

    cls.componentType = component;
    cls.dimensions = component.dimensions + 1;
    cls.superClass = this.objectClass;
    cls.interfaces = [
      this.loadClass("java/lang/Cloneable"),
      this.loadClass("java/io/Serializable"),
    ];
    cls.access = (component.access & 0x7) | 0x410;
    cls.supers.add(this.objectClass);

    for (const iface of cls.interfaces) cls.supers.add(iface);

    for (const sup of component.isPrimitive ? [] : component.supers) {
      cls.supers.add(this.arrayClass(sup));
    }

    cls.vtable = this.objectClass.vtable;
    cls.state = INITIALIZED;
    this.mirror(cls);
    component.arrayClass = cls;
    this.classes.set(name, cls);

    return cls;
  }

  public classOf(value: unknown): JClass {
    return typeof value === "string"
      ? this.stringClass
      : (value as JObject).$cls;
  }

  public createThread(name: string, daemon = false): JThread {
    const thread = new JThread(this.nextThreadId++, name);

    thread.daemon = daemon;
    this.threads.push(thread);

    return thread;
  }

  public mirror(cls: JClass): void {
    cls.$cls = this.classClass;

    for (const field of this.classClass.instanceFields) {
      if (!(field.key in cls)) cls[field.key] = defaultValue(field.descriptor);
    }
  }

  public crash(thread: JThread, error: unknown): void {
    const javaStack = thread.frames
      .map((frame) => `\tat ${frame.method.toString()} pc=${frame.pc}`)
      .reverse()
      .join("\n");
    const message = `Internal JVM error in thread "${thread.name}": ${
      error instanceof Error ? (error.stack ?? error.message) : String(error)
    }\n${javaStack}\n`;

    this.host.stderr(new TextEncoder().encode(message));
    this.exit(134);
  }

  public bootMethod(): JMethod {
    return new JMethod(
      this.objectClass ?? new JClass("<boot>", undefined, { loader: null }),
      { access: 0x1008, descriptor: "()V", exceptions: [], name: "<boot>" }
    );
  }

  public enqueue(thread: JThread): void {
    if (!this.runQueue.includes(thread)) this.runQueue.push(thread);

    this.schedule();
  }

  public exit(code: number): void {
    if (this.exitCode !== undefined) return;

    this.exitCode = code;

    for (const thread of this.threads) this.terminate(thread);

    for (const timer of this.timers) clearTimeout(timer);

    this.timers.clear();

    for (const listener of this.exitListeners) listener(code);

    this.exitListeners = [];
  }

  public identityHash(value: JArray | JClass | JObject | string): number {
    if (typeof value === "string") return this.stringHash(value);

    if (value.$hash === undefined) {
      let x = this.hashSeed;

      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      this.hashSeed = x;
      value.$hash = x & 0x7fffffff;
    }

    return value.$hash;
  }

  public initialized(name: string): JClass | undefined {
    const cls = this.classes.get(name);

    return cls?.state === INITIALIZED ? cls : undefined;
  }

  public instanceOf(value: unknown, cls: JClass): boolean {
    if (value === null || value === undefined) return false;

    return this.classOf(value).isSubclassOf(cls);
  }

  public loadClass(name: string, loader: JObject | null = null): JClass {
    const existing = this.classes.get(name);

    if (existing) return existing;

    if (name.startsWith("[")) {
      const component = name.slice(1);
      const componentClass =
        component.startsWith("[")
          ? this.loadClass(component, loader)
          : component.startsWith("L")
            ? this.loadClass(component.slice(1, -1), loader)
            : this.primitives.get(component);

      if (!componentClass) this.throwNew("java/lang/NoClassDefFoundError", name);

      return this.arrayClass(componentClass);
    }

    const found = this.findClassBytes(name, loader);

    if (!found) {
      if (name === "java/lang/NoClassDefFoundError") {
        throw new InternalError("java/lang/NoClassDefFoundError is missing");
      }

      throw new JavaThrow(
        this.newThrowable("java/lang/NoClassDefFoundError", name)
      );
    }

    return this.defineClass(parseClassFile(found.bytes), found.source);
  }

  public lookupNative(method: JMethod): Native | null {
    return this.natives.get(`${method.cls.name}.${method.key}`) ?? null;
  }

  public newArray(descriptor: string, length: number): JArray {
    if (length < 0) {
      this.throwNew("java/lang/NegativeArraySizeException", String(length));
    }

    const create = PRIMITIVE_ARRAYS[descriptor];
    const array: JArray = create
      ? create(length)
      : (new Array<unknown>(length).fill(null) as JArray);

    array.$cls = this.loadClass(`[${descriptor}`);

    return array;
  }

  public newArrayOf(cls: JClass, length: number): JArray {
    return this.newArray(
      cls.isPrimitive
        ? this.primitiveDescriptor(cls)
        : cls.isArray
          ? cls.name
          : `L${cls.name};`,
      length
    );
  }

  public newObject(cls: JClass): JObject {
    const { ctor: Instance } = cls;

    return new Instance();
  }

  public newThrowable(className: string, message?: string): JObject {
    const cls = this.loadClass(className);

    this.forceInitialized(cls);

    const exception = this.newObject(cls);

    exception._detailMessage = message ?? null;
    exception._cause = exception;
    exception._backtrace = this.currentThread
      ? this.captureBacktrace(this.currentThread)
      : [];

    return exception;
  }

  public onExit(listener: (code: number) => void): void {
    this.exitListeners.push(listener);
  }

  public primitiveDescriptor(cls: JClass): string {
    return (
      Object.keys(PRIMITIVE_NAMES).find(
        (key) => PRIMITIVE_NAMES[key] === cls.name
      ) ?? "V"
    );
  }

  public readResource(
    name: string,
    loader: JObject | null = null
  ): Uint8Array | undefined {
    for (const entry of this.searchPath(loader)) {
      const data = entry.zip.read(name);

      if (data) return data;
    }

    return undefined;
  }

  public schedule(): void {
    if (this.pumpScheduled || this.stopped) return;

    this.pumpScheduled = true;

    const schedule = this.host.schedule ?? ((fn) => setTimeout(fn, 0));

    schedule(() => {
      this.pumpScheduled = false;
      this.pump();
    }, 0);
  }

  public startThread(thread: JThread, method: JMethod, args: unknown[]): void {
    const frame = this.frameFor(method, args);

    thread.frames.push(frame);
    thread.state = RUNNABLE;
    this.runQueue.push(thread);
    this.schedule();
  }

  public stop(): void {
    this.stopped = true;
    this.exit(this.exitCode ?? 143);

    for (const timer of this.timers) clearTimeout(timer);

    this.timers.clear();
  }

  public setTimer(callback: () => void, delay: number): () => void {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, delay);

    this.timers.add(timer);

    return () => {
      clearTimeout(timer);
      this.timers.delete(timer);
    };
  }

  public stringHash(value: string): number {
    let hash = 0;

    for (let i = 0; i < value.length; i++) {
      hash = (Math.imul(hash, 31) + value.charCodeAt(i)) | 0;
    }

    return hash;
  }

  public terminate(thread: JThread): void {
    if (thread.state === TERMINATED) return;

    thread.state = TERMINATED;
    thread.frames.length = 0;
    thread.blocked = false;

    for (const waiter of thread.terminationWaiters) waiter();

    thread.terminationWaiters = [];

    if (
      this.exitCode === undefined &&
      this.threads.every((t) => t.state === TERMINATED || t.daemon)
    ) {
      this.exit(this.exitStatusOnFinish);
    }
  }

  public throwNew(className: string, message?: string): never {
    throw new JavaThrow(this.newThrowable(className, message));
  }

  public wake(thread: JThread, value?: unknown, error?: unknown): void {
    if (thread.state === TERMINATED) return;

    thread.resumeValue = value;
    thread.resumeError = error;
    thread.blocked = false;

    if (!this.runQueue.includes(thread)) this.runQueue.push(thread);

    this.schedule();
  }

  // The Java call stack, outermost first: interpreter frames, then the
  // compiled activations running on top of the frame that entered them.
  public javaStack(thread: JThread): [JMethod, number][] {
    const stack = thread.frames
      .filter((frame) => !frame.gen)
      .map((frame): [JMethod, number] => [frame.method, frame.pc]);

    if (thread.jitDepth > 0) {
      stack.pop();

      for (let i = 0; i < thread.jitDepth; i++) {
        stack.push([thread.jitMethods[i], thread.jitPcs[i]]);
      }
    }

    return stack;
  }

  public captureBacktrace(thread: JThread): [JMethod, number][] {
    return this.javaStack(thread).reverse();
  }

  public defineClass(cf: ClassFile, source: ClassSource): JClass {
    const cls = new JClass(cf.name, cf, source);

    this.classes.set(cf.name, cls);

    try {
      this.link(cls);
    } catch (error) {
      this.classes.delete(cf.name);
      throw error;
    }

    return cls;
  }

  public forceInitialized(cls: JClass): void {
    for (let c: JClass | null = cls; c; c = c.superClass) {
      if (c.state === INITIALIZED) break;

      if (c.methodMap.has("<clinit>()V") && c.state !== INITIALIZING) {
        throw new InternalError(
          `${c.name} needs <clinit> before ${cls.name} can be created natively`
        );
      }

      c.state = INITIALIZED;
    }
  }

  public frameFor(method: JMethod, args: unknown[]): Frame {
    const {code} = method;
    const frame = new Frame(
      method,
      Math.max(code?.maxLocals ?? 0, method.argSlots),
      code?.maxStack ?? 0
    );
    let slot = 0;
    let index = 0;

    if (!method.isStatic) frame.locals[slot++] = args[index++];

    for (const type of method.args) {
      frame.locals[slot] = args[index++];
      slot += type === "J" || type === "D" ? 2 : 1;
    }

    return frame;
  }

  public invoke(method: JMethod, args: unknown[]): Request {
    return { args, kind: "invoke", method };
  }

  public resolveVirtual(receiver: unknown, key: string): JMethod {
    const method = this.classOf(receiver).vtable.get(key);

    if (!method) this.throwNew("java/lang/AbstractMethodError", key);

    return method;
  }

  public wait(promise: PromiseLike<unknown>): Request {
    return { kind: "wait", promise };
  }

  private findClassBytes(
    name: string,
    loader: JObject | null
  ): { bytes: Uint8Array; source: ClassSource } | undefined {
    const path = `${name}.class`;

    for (const entry of this.searchPath(loader)) {
      if (entry.multiRelease) {
        for (let version = RUNTIME_VERSION; version >= 9; version--) {
          const bytes = entry.zip.read(`META-INF/versions/${version}/${path}`);

          if (bytes) return { bytes, source: entry.source };
        }
      }

      const bytes = entry.zip.read(path);

      if (bytes) return { bytes, source: entry.source };
    }

    return undefined;
  }

  private link(cls: JClass): void {
    const cf = cls.cf as ClassFile;

    if (cf.superName) {
      cls.superClass = this.loadClass(cf.superName, cls.loader);
    } else if (cf.name !== "java/lang/Object") {
      throw new InternalError(`${cf.name} has no superclass`);
    }

    cls.interfaces = cf.interfaces.map((name) =>
      this.loadClass(name, cls.loader)
    );

    if (cls.superClass) {
      cls.supers.add(cls.superClass);

      for (const sup of cls.superClass.supers) cls.supers.add(sup);
    }

    for (const iface of cls.interfaces) {
      cls.supers.add(iface);

      for (const sup of iface.supers) cls.supers.add(sup);
    }

    const inheritedKeys = new Set(
      cls.superClass?.instanceFields.map((field) => field.key)
    );

    cls.declaredFields = cf.fields.map((info) => {
      const field = new JField(cls, info);

      if (!field.isStatic && inheritedKeys.has(field.key)) {
        field.key = `${field.key}$${cls.supers.size}`;
      }

      return field;
    });
    cls.instanceFields = [
      ...(cls.superClass?.instanceFields ?? []),
      ...cls.declaredFields.filter((field) => !field.isStatic),
    ];

    for (const field of cls.declaredFields) {
      if (!field.isStatic) continue;

      const constant =
        field.info.constantValue === undefined
          ? undefined
          : cf.constantPool[field.info.constantValue];

      cls.statics[field.key] =
        constant &&
        (constant.tag === CONSTANT_Integer ||
          constant.tag === CONSTANT_Float ||
          constant.tag === CONSTANT_Long ||
          constant.tag === CONSTANT_Double ||
          constant.tag === CONSTANT_String)
          ? constant.value
          : defaultValue(field.descriptor);
    }

    const body = cls.instanceFields
      .map((field) => {
        const value = defaultValue(field.descriptor);

        return `this[${JSON.stringify(field.key)}]=${
          value === null ? "null" : value === 0n ? "0n" : "0"
        };`;
      })
      .join("");
    // eslint-disable-next-line typescript/no-implied-eval, no-new-func
    const ctor = new Function(body) as new () => JObject;

    (ctor.prototype as JObject).$cls = cls;
    cls.ctor = ctor;

    cls.declaredMethods = cf.methods.map((info) => new JMethod(cls, info));

    for (const method of cls.declaredMethods) {
      cls.methodMap.set(method.key, method);
    }

    this.buildVtable(cls);

    if (cf.name === "java/lang/Object") this.objectClass = cls;

    if (cf.name === "java/lang/String") this.stringClass = cls;

    if (cf.name === "java/lang/Class") {
      this.classClass = cls;

      for (const loaded of this.classes.values()) this.mirror(loaded);

      for (const primitive of this.primitives.values()) this.mirror(primitive);
    }

    if (this.classClass) this.mirror(cls);

    cls.state = LINKED;
  }

  private buildVtable(cls: JClass): void {
    const vtable = new Map(cls.superClass?.vtable);

    if (cls.isInterface) vtable.clear();

    for (const method of cls.declaredMethods) {
      if (isVirtual(method)) vtable.set(method.key, method);
    }

    for (const iface of cls.supers) {
      if (!iface.isInterface) continue;

      for (const method of iface.declaredMethods) {
        if (!isVirtual(method)) continue;

        const existing = vtable.get(method.key);

        if (
          !existing ||
          (existing.cls.isInterface &&
            ((existing.isAbstract && !method.isAbstract) ||
              (existing.isAbstract === method.isAbstract &&
                method.cls.isSubclassOf(existing.cls))))
        ) {
          vtable.set(method.key, method);
        }
      }
    }

    cls.vtable = vtable;
  }

  private pump(): void {
    if (this.stopped || this.exitCode !== undefined) return;

    const sliceEnd = now() + SLICE_MS;

    while (this.runQueue.length > 0 && this.exitCode === undefined) {
      const thread = this.runQueue.shift() as JThread;

      if (thread.state === TERMINATED || thread.blocked) continue;

      this.currentThread = thread;

      try {
        execute(this, thread, Math.min(sliceEnd, now() + QUANTUM_MS));
      } catch (error) {
        this.crash(thread, error);
      }

      this.currentThread = undefined;

      if (thread.state !== TERMINATED && !thread.blocked) {
        this.runQueue.push(thread);
      }

      if (now() >= sliceEnd) break;
    }

    if (this.runQueue.length > 0) this.schedule();
  }

  private searchPath(loader: JObject | null): ClassPathEntry[] {
    return loader === null && this.appPath.length > 0
      ? [...this.bootPath, ...this.appPath]
      : this.bootPath;
  }

}
