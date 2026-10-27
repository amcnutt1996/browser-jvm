// Builds jars/gdx.jar: the runner's libGDX desktop backend (java/gdx), which
// replaces the LWJGL3 backend classes of jars that bundle libGDX. WebGL20 is generated from the GL20
// interface so every GL call is a native backed by WebGL.
//
// Usage:
//   node scripts/buildGdx.ts <jar with libGDX 1.12 classes>
// For example the Shattered Pixel Dungeon v4.0.2 desktop jar.
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { zipSync } from "fflate";
import { ACC_STATIC, parseClassFile } from "../src/jvm/classfile.ts";
import { parseMethodDescriptor } from "../src/jvm/descriptors.ts";
import { ZipArchive } from "../src/jvm/zip.ts";

const root = join(import.meta.dirname, "..");
const sources = join(root, "java/gdx");
const output = join(root, "jars/gdx.jar");
const gdxJar = process.argv[2];

if (!gdxJar) {
  console.error("Usage: node scripts/buildGdx.ts <jar with libGDX classes>");
  process.exit(1);
}

const build = join(tmpdir(), "java-runner-gdx");

const listFiles = (dir: string, ext: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);

    return statSync(path).isDirectory()
      ? listFiles(path, ext)
      : path.endsWith(ext)
        ? [path]
        : [];
  });

const PRIMITIVES: Record<string, string> = {
  B: "byte",
  C: "char",
  D: "double",
  F: "float",
  I: "int",
  J: "long",
  S: "short",
  V: "void",
  Z: "boolean",
};

const javaType = (descriptor: string): string => {
  if (descriptor.startsWith("[")) return `${javaType(descriptor.slice(1))}[]`;

  if (descriptor.startsWith("L")) {
    return descriptor.slice(1, -1).replaceAll("/", ".").replaceAll("$", ".");
  }

  return PRIMITIVES[descriptor];
};

const generateGl = (zip: ZipArchive, name: string, className: string): string => {
  const bytes = zip.read(`com/badlogic/gdx/graphics/${name}.class`);

  if (!bytes) throw new Error(`${name} not found in ${gdxJar}`);

  const methods = parseClassFile(bytes)
    .methods.filter((method) => !(method.access & ACC_STATIC))
    .map((method) => {
      const { args, ret } = parseMethodDescriptor(method.descriptor);
      const params = args.map((arg, index) => `${javaType(arg)} p${index}`);

      return `    public native ${javaType(ret)} ${method.name}(${params.join(", ")});`;
    });

  return [
    "package com.badlogic.gdx.backends.lwjgl3;",
    "",
    `public class ${className} implements com.badlogic.gdx.graphics.${name} {`,
    ...methods,
    "}",
    "",
  ].join("\n");
};

rmSync(build, { force: true, recursive: true });
mkdirSync(join(build, "src/com/badlogic/gdx/backends/lwjgl3"), { recursive: true });
mkdirSync(join(build, "classes"), { recursive: true });

const generated = join(build, "src/com/badlogic/gdx/backends/lwjgl3/WebGL20.java");

writeFileSync(generated, generateGl(new ZipArchive(readFileSync(gdxJar)), "GL20", "WebGL20"));
execFileSync(
  "javac",
  [
    "-nowarn",
    "-g:source,lines",
    "--release",
    "11",
    "-cp",
    gdxJar,
    "-d",
    join(build, "classes"),
    generated,
    ...listFiles(sources, ".java"),
  ],
  { stdio: "inherit" }
);

const files: Record<string, Uint8Array> = {};

for (const file of listFiles(join(build, "classes"), ".class")) {
  files[relative(join(build, "classes"), file)] = readFileSync(file);
}

writeFileSync(output, zipSync(files, { level: 9, mtime: new Date("2026-01-01") }));
console.log(`${output}: ${Object.keys(files).length} classes`);
