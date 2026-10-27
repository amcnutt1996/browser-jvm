import { initialize } from "./initialize.ts";
import { pushGenerator } from "./interpreter.ts";
import { digestNatives } from "./natives/digest.ts";
import { stringArray } from "./natives/helpers.ts";
import { invokeNatives } from "./natives/invoke.ts";
import { ioNatives } from "./natives/io.ts";
import { langNatives } from "./natives/lang.ts";
import { mathNatives } from "./natives/math.ts";
import { nioNatives } from "./natives/nio.ts";
import { stringNatives } from "./natives/string.ts";
import { unsafeNatives } from "./natives/unsafe.ts";
import { zipNatives } from "./natives/zip.ts";
import { type Request, RUNNABLE } from "./types.ts";
import {
  type Host,
  JVM,
  type NativeTable,
  VM_EXCEPTIONS,
} from "./vm.ts";


export type LaunchOptions = {
  args?: string[];
  classPath?: { data: Uint8Array; path: string }[];
  host: Host;
  mainClass?: string;
  natives?: ((vm: JVM) => NativeTable)[];
  runtime: Uint8Array;
};

export const createJvm = (options: LaunchOptions): JVM => {
  const vm = new JVM(options.host);

  vm.addBootClassPath(options.runtime);

  for (const entry of options.classPath ?? []) vm.addClassPath(entry.data, entry.path);

  for (const natives of [
    langNatives,
    stringNatives,
    mathNatives,
    unsafeNatives,
    ioNatives,
    nioNatives,
    zipNatives,
    digestNatives,
    invokeNatives,
    ...(options.natives ?? []),
  ]) {
    vm.addNatives(natives(vm));
  }

  vm.properties["jdk.io.useMonitors"] = "true";

  return vm;
};

export const mainClassOf = (vm: JVM): string | undefined => {
  for (const manifest of vm.manifests.values()) {
    if (manifest["Main-Class"]) return manifest["Main-Class"];
  }

  return undefined;
};

export const runMain = (vm: JVM, mainClass: string, args: string[] = []): Promise<number> => {
  const thread = vm.createThread("main");

  const boot = function* boot(): Generator<Request, void, unknown> {
    vm.loadClass("java/lang/Object");
    vm.loadClass("java/lang/Class");
    vm.loadClass("java/lang/String");

    const groupClass = vm.loadClass("java/lang/ThreadGroup");
    const threadClass = vm.loadClass("java/lang/Thread");

    vm.forceInitialized(groupClass);
    vm.forceInitialized(threadClass);

    const group = vm.newObject(groupClass);

    group._name = "main";
    group._maxPriority = 10;

    const javaThread = vm.newObject(threadClass);

    javaThread._name = "main";
    javaThread._priority = 5;
    javaThread._group = group;
    javaThread._tid = 1n;
    javaThread._started = 1;
    thread.java = javaThread;
    (javaThread).$thread = thread;

    for (const name of VM_EXCEPTIONS) {
      yield* initialize(vm, thread, vm.loadClass(name));
    }

    yield* initialize(vm, thread, vm.loadClass("java/lang/System"));

    const vmClass = vm.loadClass("jdk/internal/misc/VM");

    yield* initialize(vm, thread, vmClass);
    vmClass.statics._initLevel = 4;

    const main = vm.loadClass(mainClass.replaceAll(".", "/"));

    yield* initialize(vm, thread, main);

    const method = main.methodMap.get("main([Ljava/lang/String;)V");

    if (!method?.isStatic) {
      vm.throwNew(
        "java/lang/NoSuchMethodError",
        `main method not found in class ${mainClass}`
      );
    }

    yield vm.invoke(method, [stringArray(vm, args)]);
  };

  const exited = new Promise<number>((resolve) => {
    vm.onExit(resolve);
  });

  pushGenerator(vm, thread, vm.bootMethod(), boot());
  thread.state = RUNNABLE;
  vm.enqueue(thread);

  return exited;
};
