import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { zipSync } from "fflate";
import { createJvm, runMain } from "../src/jvm/launcher.ts";
import { createMemoryFileSystem } from "../src/jvm/memfs.ts";

const root = join(import.meta.dirname, "conformance");
const runtime = readFileSync(join(import.meta.dirname, "../jars/runtime.jar"));
const classes: Record<string, Uint8Array> = {};

for (const name of readdirSync(join(root, "classes"))) {
  classes[name] = readFileSync(join(root, "classes", name));
}

const jar = zipSync(classes);
const programs = readdirSync(join(root, "src")).map((name) => name.replace(/\.java$/, ""));

const run = async (
  mainClass: string,
  jitThreshold: number
): Promise<{ code: number; stderr: string; stdout: string }> => {
  const decoder = new TextDecoder();
  let stdout = "";
  let stderr = "";
  const vm = createJvm({
    classPath: [{ data: jar, path: "conformance.jar" }],
    host: {
      fs: createMemoryFileSystem({ "/tmp/.keep": "" }),
      stderr: (data) => {
        stderr += decoder.decode(data);
      },
      stdout: (data) => {
        stdout += decoder.decode(data);
      },
    },
    runtime,
  });

  vm.jitThreshold = jitThreshold;

  const code = await runMain(vm, mainClass);

  vm.stop();

  return { code, stderr, stdout };
};

for (const [mode, jitThreshold] of [
  ["interpreted", -1],
  ["compiled", 0],
] as const) {
  describe(`conformance (${mode})`, () => {
    for (const name of programs) {
      it(`${name} matches the output of a real JVM`, { timeout: 60_000 }, async () => {
        const expected = readFileSync(join(root, "expected", `${name}.out`), "utf8");
        const expectedCode = Number(readFileSync(join(root, "expected", `${name}.code`), "utf8"));
        const { code, stdout } = await run(name, jitThreshold);

        assert.equal(stdout, expected);
        assert.equal(code, expectedCode);
      });
    }
  });
}
