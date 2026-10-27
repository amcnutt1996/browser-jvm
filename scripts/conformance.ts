// Runs the conformance programs on the Java runner and diffs them against the
// recorded output of a real JVM. Usage: ... conformance.ts [Name ...]
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { zipSync } from "fflate";
import { createJvm, runMain } from "../src/jvm/launcher.ts";
import { createMemoryFileSystem } from "../src/jvm/memfs.ts";

const dir = join(import.meta.dirname, "../test/conformance");
const files: Record<string, Uint8Array> = {};

for (const name of readdirSync(join(dir, "classes"))) files[name] = readFileSync(join(dir, "classes", name));

const jar = zipSync(files);
const runtime = readFileSync(join(import.meta.dirname, "../jars/runtime.jar"));
const names = process.argv.slice(2).length > 0 ? process.argv.slice(2) : readdirSync(join(dir, "src")).map((n) => n.replace(".java", ""));
let failures = 0;

for (const name of names) {
  let out = "";
  let err = "";
  const decoder = new TextDecoder();
  const vm = createJvm({
    classPath: [{ data: jar, path: "conformance.jar" }],
    host: {
      fs: createMemoryFileSystem({ "/tmp/.keep": "" }),
      stderr: (data) => { err += decoder.decode(data); },
      stdout: (data) => { out += decoder.decode(data); },
    },
    runtime,
  });
  const start = performance.now();
  const code = await Promise.race([runMain(vm, name), new Promise<number>((resolve) => setTimeout(() => resolve(-999), 60000))]);
  vm.stop();
  const ms = Math.round(performance.now() - start);
  const expected = readFileSync(join(dir, "expected", `${name}.out`), "utf8");
  const expectedCode = Number(readFileSync(join(dir, "expected", `${name}.code`), "utf8"));

  if (out === expected && code === expectedCode) {
    console.log(`PASS ${name} (${ms} ms)`);
    continue;
  }

  failures++;
  console.log(`FAIL ${name} (${ms} ms, exit ${code}, expected ${expectedCode})`);
  const a = expected.split("\n");
  const b = out.split("\n");

  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      console.log(`  line ${i + 1}\n    want: ${a[i]}\n    got:  ${b[i]}`);
    }
  }

  if (err) console.log(`  stderr: ${err.slice(0, 3000)}`);
}

process.exit(failures ? 1 : 0);
