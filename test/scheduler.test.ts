import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { zipSync } from "fflate";
import { createJvm, runMain } from "../src/jvm/launcher.ts";
import { type JVM } from "../src/jvm/vm.ts";

const classesDir = join(import.meta.dirname, "programs/classes");
const runtime = readFileSync(join(import.meta.dirname, "../jars/runtime.jar"));
const classes: Record<string, Uint8Array> = {};

for (const name of readdirSync(classesDir)) {
  classes[name] = readFileSync(join(classesDir, name));
}

const jar = zipSync(classes);

type Run = {
  output: () => { stderr: string; stdout: string };
  vm: JVM;
};

const start = (stdin: string[] = []): Run => {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let stdout = "";
  let stderr = "";
  const vm = createJvm({
    classPath: [{ data: jar, path: "programs.jar" }],
    host: {
      readStdin: () => {
        const next = stdin.shift();

        return Promise.resolve(next === undefined ? undefined : encoder.encode(next));
      },
      stderr: (data) => {
        stderr += decoder.decode(data);
      },
      stdout: (data) => {
        stdout += decoder.decode(data);
      },
    },
    runtime,
  });

  return { output: () => ({ stderr, stdout }), vm };
};

describe("threads and shutdown", () => {
  it("stops a program that never ends", async () => {
    const { output, vm } = start();
    const exited = runMain(vm, "Forever");

    await new Promise((resolve) => {
      setTimeout(resolve, 300);
    });
    vm.stop();

    assert.equal(await exited, 143);
    assert.equal(output().stdout, "started\n");
  });

  it("exits with the System.exit status while other threads sleep", async () => {
    const { output, vm } = start();

    assert.equal(await runMain(vm, "ExitCode"), 42);
    assert.equal(output().stdout, "exiting 0\nhook\n");

    vm.stop();
  });

  it("reports uncaught exceptions with a stack trace and exit status 1", async () => {
    const { output, vm } = start();

    assert.equal(await runMain(vm, "Uncaught"), 1);
    assert.equal(output().stdout, "before\n");
    assert.ok(
      output().stderr.includes(
        'Exception in thread "main" java.lang.IllegalStateException: broken on purpose\n\tat Uncaught.fail(Uncaught.java:3)\n\tat Uncaught.fail(Uncaught.java:4)'
      )
    );

    vm.stop();
  });

  it("reads standard input until end of stream", async () => {
    const { output, vm } = start(["first\nsec", "ond\n"]);

    assert.equal(await runMain(vm, "Echo"), 0);
    assert.equal(output().stdout, "echo: first\necho: second\ndone\n");

    vm.stop();
  });
});
