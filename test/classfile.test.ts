import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  ACC_INTERFACE,
  CONSTANT_InvokeDynamic,
  CONSTANT_String,
  parseClassFile,
} from "../src/jvm/classfile.ts";
import { forEachInstruction } from "../src/jvm/opcodes.ts";
import { ZipArchive } from "../src/jvm/zip.ts";

const conformanceClasses = join(import.meta.dirname, "conformance/classes");
const runtime = new ZipArchive(readFileSync(join(import.meta.dirname, "../jars/runtime.jar")));

describe("class file parser", () => {
  it("parses every class in the runtime library", () => {
    const names = [...runtime.entries.keys()].filter((name) => name.endsWith(".class"));
    let instructions = 0;

    for (const name of names) {
      const cf = parseClassFile(runtime.read(name) as Uint8Array);

      assert.equal(`${cf.name}.class`, name);

      for (const method of cf.methods) {
        if (method.code) {
          forEachInstruction(method.code.code, () => {
            instructions++;
          });
        }
      }
    }

    assert.ok(names.length > 1000);
    assert.ok(instructions > 100_000);
  });

  it("reads members, attributes and bootstrap methods", () => {
    const cf = parseClassFile(runtime.read("java/util/Comparator.class") as Uint8Array);

    assert.deepEqual(
      {
        interface: Math.floor(cf.access / ACC_INTERFACE) % 2 === 1,
        sourceFile: cf.sourceFile,
        superName: cf.superName,
      },
      {
        interface: true,
        sourceFile: "Comparator.java",
        superName: "java/lang/Object",
      }
    );
    assert.ok(cf.methods.some((method) => method.name === "thenComparing"));
    assert.ok(cf.constantPool.some((entry) => entry?.tag === CONSTANT_InvokeDynamic));
    assert.ok(cf.bootstrapMethods.length > 0);
  });

  it("decodes modified UTF-8 strings", () => {
    const cf = parseClassFile(readFileSync(join(conformanceClasses, "Strings.class")));

    assert.ok(
      cf.constantPool.some((entry) => entry?.tag === CONSTANT_String && entry.value.includes("😀"))
    );
  });
});
