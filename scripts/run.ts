// Runs a class or jar on the Java runner under Node, for development.
// Usage: node scripts/run.ts [-cp dir-or-jar] [-jar file.jar] [Main] [args...]
// For libGDX jars, JAVA_RUNNER_FRAMES=n exits after n frames (for profiling).
// JAVA_RUNNER_JIT=n compiles methods after n interpreted entries (-1: never).
// JAVA_RUNNER_EXIT_MS=n exits after n milliseconds.
// JAVA_RUNNER_INPUT is a JSON list of scripted input for libGDX jars, played
// against a 1280x660 window: ["click", ms, x, y] or ["key", ms, gdxKeyCode].
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { zipSync } from "fflate";
import { gdxNatives, usesGdx } from "../src/gdx/index.ts";
import { createEventState, GDX_EVENT } from "../src/gdx/host.ts";
import { createJvm, mainClassOf, runMain } from "../src/jvm/launcher.ts";
import { createMemoryFileSystem } from "../src/jvm/memfs.ts";

const args = process.argv.slice(2);
const classPath: { data: Uint8Array; path: string }[] = [];
let mainClass: string | undefined;
let jarMode = false;

const listFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);

    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });

while (args.length > 0 && args[0].startsWith("-")) {
  const flag = args.shift() as string;
  const value = args.shift() as string;

  if (statSync(value).isDirectory()) {
    const files: Record<string, Uint8Array> = {};

    for (const file of listFiles(value)) files[relative(value, file)] = readFileSync(file);

    classPath.push({ data: zipSync(files), path: value });
  } else {
    classPath.push({ data: readFileSync(value), path: value });
  }

  if (flag === "-jar") jarMode = true;
}

const start = performance.now();
const jars = join(import.meta.dirname, "../jars");
const gdx = classPath.some((entry) => usesGdx(entry.data));
let frames = 0;

if (gdx) classPath.unshift({ data: readFileSync(join(jars, "gdx.jar")), path: "gdx.jar" });

const state = createEventState(1280, 660);

if (process.env.JAVA_RUNNER_EXIT_MS) {
  setTimeout(() => process.exit(0), Number(process.env.JAVA_RUNNER_EXIT_MS)).unref();
}

const input = JSON.parse(process.env.JAVA_RUNNER_INPUT ?? "[]") as [string, number, number, number?][];

for (const [kind, at, a, b] of input) {
  setTimeout(() => {
    console.error(`[input ${kind} ${a}${b === undefined ? "" : `,${b}`}]`);

    if (kind === "click") {
      state.events.push(GDX_EVENT.TOUCH_DOWN, a, b ?? 0, 0, 0, GDX_EVENT.TOUCH_UP, a, b ?? 0, 0, 0);
    } else {
      state.events.push(GDX_EVENT.KEY_DOWN, a, 0, 0, 0, GDX_EVENT.KEY_UP, a, 0, 0, 0);
    }
  }, at).unref();
}

const vm = createJvm({
  classPath,
  host: {
    env: gdx ? { XDG_DATA_HOME: "/home" } : undefined,
    fs: createMemoryFileSystem({ "/home/.keep": "" }),
    stderr: (data) => process.stderr.write(data),
    stdout: (data) => process.stdout.write(data),
  },
  natives: gdx
    ? gdxNatives({
        nextFrame: () =>
          new Promise((resolve) => {
            frames++;

            if (frames % 60 === 0) console.error(`[frame ${frames} at ${Math.round(performance.now() - start)} ms]`);

            if (frames === Number(process.env.JAVA_RUNNER_FRAMES)) process.exit(0);

            setTimeout(resolve, 0);
          }),
        send: (command) => {
          if (command.type !== "audio") console.error(`[gdx ${command.type}]`);
        },
        state,
      })
    : [],
  runtime: readFileSync(join(jars, "runtime.jar")),
});

if (process.env.JAVA_RUNNER_JIT !== undefined) vm.jitThreshold = Number(process.env.JAVA_RUNNER_JIT);

mainClass = jarMode ? mainClassOf(vm) : args.shift();

const code = await runMain(vm, mainClass as string, args);

console.error(`[exit ${code} after ${Math.round(performance.now() - start)} ms]`);
process.exit(code);
