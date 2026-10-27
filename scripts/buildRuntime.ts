// Builds jars/runtime.jar: the runner's own class library (java/base) plus
// the OpenJDK java.base classes it borrows, chosen by following class
// references from the roots.
//
// Usage:
//   node scripts/buildRuntime.ts [roots.jar ...]
//
// Needs a JDK 21 (javac and jmods/java.base.jmod). Set JDK_HOME to override.
import { execFileSync } from "node:child_process";
import {
  existsSync,
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
import {
  ACC_NATIVE,
  CONSTANT_Class,
  CONSTANT_Fieldref,
  CONSTANT_InterfaceMethodref,
  CONSTANT_Methodref,
  type ClassFile,
  parseClassFile,
} from "../src/jvm/classfile.ts";
import { VM_EXCEPTIONS } from "../src/jvm/vm.ts";
import { ZipArchive } from "../src/jvm/zip.ts";

const root = join(import.meta.dirname, "..");
const javaSources = join(root, "java/base");
const output = join(root, "jars/runtime.jar");
const reportPath = join(root, "docs/RUNTIME.md");
const jdkHome =
  process.env.JDK_HOME ??
  join(execFileSync("readlink", ["-f", execFileSync("which", ["javac"]).toString().trim()]).toString().trim(), "../..");
const build = join(tmpdir(), "java-runner-build");

const listFiles = (dir: string, ext: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);

    return statSync(path).isDirectory()
      ? listFiles(path, ext)
      : path.endsWith(ext)
        ? [path]
        : [];
  });

rmSync(build, { force: true, recursive: true });
mkdirSync(join(build, "base"), { recursive: true });
execFileSync(
  join(jdkHome, "bin/javac"),
  [
    "-nowarn",
    "-g:source,lines",
    "--patch-module",
    `java.base=${javaSources}`,
    "-d",
    join(build, "base"),
    ...listFiles(javaSources, ".java"),
  ],
  { stdio: "inherit" }
);

const own = new Map<string, Uint8Array>();

for (const file of listFiles(join(build, "base"), ".class")) {
  own.set(relative(join(build, "base"), file).slice(0, -6), readFileSync(file));
}

const jmod = readFileSync(join(jdkHome, "jmods/java.base.jmod"));
const jdk = new ZipArchive(jmod.subarray(4));
const jdkClass = (name: string): Uint8Array | undefined =>
  jdk.read(`classes/${name}.class`);

const refsOf = (cf: ClassFile): Set<string> => {
  const refs = new Set<string>();
  const add = (name: string | undefined): void => {
    if (!name) return;

    const element = name.replace(/^\[+/, "");

    if (element.startsWith("L")) refs.add(element.slice(1, -1));
    else if (element.length > 1) refs.add(element);
  };
  const addDescriptor = (descriptor: string): void => {
    for (const match of descriptor.matchAll(/L([^;]+);/g)) refs.add(match[1]);
  };

  add(cf.superName);
  cf.interfaces.forEach(add);

  for (const entry of cf.constantPool) {
    if (!entry) continue;

    if (entry.tag === CONSTANT_Class) add(entry.value);
    else if (
      entry.tag === CONSTANT_Fieldref ||
      entry.tag === CONSTANT_Methodref ||
      entry.tag === CONSTANT_InterfaceMethodref
    ) {
      add(entry.value.className);
      addDescriptor(entry.value.descriptor);
    }
  }

  for (const field of cf.fields) addDescriptor(field.descriptor);

  for (const method of cf.methods) addDescriptor(method.descriptor);

  return refs;
};

// Packages whose classes are never borrowed: they are either replaced by the
// runner's own classes or are VM/OS plumbing the runner does not emulate.
const EXCLUDED =
  /^(?:java\/nio\/(?!(?:charset\/|BufferOverflowException|BufferUnderflowException|InvalidMarkException|ReadOnlyBufferException)\b)|sun\/nio\/(?:ch|fs)\/|java\/nio\/(?:channels|file)\/|jdk\/internal\/(?:loader|module|jimage|jrtfs|vm\/(?!(?:ThreadContainer|ThreadContainers|SharedThreadContainer|StackableScope|ScopedValueContainer)\b)|foreign|event|perf|logger|org\/objectweb|classfile)\/|java\/lang\/(?:invoke|module|foreign|runtime)\/|sun\/invoke\/|sun\/security\/(?!action\/)|java\/security\/(?!(?:BasicPermission|Permission|Guard|PermissionCollection|AllPermission|MessageDigestSpi|DigestException|SecureRandom|SecureRandomSpi|NoSuchAlgorithmException|GeneralSecurityException|PrivilegedAction|PrivilegedExceptionAction|PrivilegedActionException|AccessController|ProtectionDomain|MessageDigest)\b)|javax\/(?!net\/ssl\/SSL\w*Exception\b)|sun\/net\/|java\/net\/(?!(?:URI|URISyntaxException|URL|MalformedURLException|URLEncoder|URLDecoder|URLStreamHandler|URLConnection)\b)|sun\/launcher\/|sun\/reflect\/|jdk\/internal\/reflect\/(?!Reflection\b)|java\/lang\/ref\/|java\/lang\/reflect\/(?!(?:Modifier|Type|ParameterizedType|GenericArrayType|WildcardType|TypeVariable|GenericDeclaration|AnnotatedElement|Member|InvocationTargetException|UndeclaredThrowableException|MalformedParameterizedTypeException|GenericSignatureFormatError|InvocationHandler)\b))/;



// Whole packages a general-purpose Java program can expect to find.
const ROOT_PACKAGES =
  /^(?:java\/(?:lang|io|math|text|util|util\/concurrent|util\/concurrent\/atomic|util\/concurrent\/locks|util\/function|util\/regex|util\/stream|util\/zip|nio\/charset)\/[^/]+|java\/security\/(?:BasicPermission|Permission|Guard|PermissionCollection|AllPermission)|javax\/net\/ssl\/SSL\w*Exception|sun\/text\/resources\/(?:cldr\/)?FormatData\w*|sun\/util\/resources\/(?:cldr\/)?\w+)\.class$/;

// Referenced classes from these packages are included so that they can be
// named and reflected on, but their own references are not followed.
const LEAF = /^java\/lang\/invoke\//;

const roots = new Set<string>([
  ...own.keys(),
  ...VM_EXCEPTIONS,
  ...[...jdk.entries.keys()]
    .map((name) => name.replace(/^classes\//, ""))
    .filter((name) => ROOT_PACKAGES.test(name))
    .map((name) => name.slice(0, -6))
    .filter((name) => !EXCLUDED.test(name)),
]);

for (const jarPath of process.argv.slice(2)) {
  const jar = new ZipArchive(readFileSync(jarPath));

  for (const name of jar.entries.keys()) {
    if (!name.endsWith(".class") || name.startsWith("META-INF/")) continue;

    for (const ref of refsOf(parseClassFile(jar.read(name) as Uint8Array))) {
      if (/^(?:java|javax|jdk|sun)\//.test(ref)) roots.add(ref);
    }
  }
}

const included = new Map<string, { bytes: Uint8Array; cf: ClassFile; own: boolean }>();
const missing = new Map<string, Set<string>>();
const queue = [...roots].map((name) => [name, "(root)"] as [string, string]);

while (queue.length > 0) {
  const [name, from] = queue.pop() as [string, string];

  if (included.has(name)) continue;

  const ownBytes = own.get(name);
  const leaf = !ownBytes && LEAF.test(name);
  const bytes =
    ownBytes ?? (EXCLUDED.test(name) && !leaf ? undefined : jdkClass(name));

  if (!bytes) {
    if (!missing.has(name)) missing.set(name, new Set());

    missing.get(name)?.add(from);
    continue;
  }

  const cf = parseClassFile(bytes);

  included.set(name, { bytes, cf, own: Boolean(ownBytes) });

  if (leaf) continue;

  for (const ref of refsOf(cf)) {
    if (!included.has(ref)) queue.push([ref, name]);
  }
}

// Link check: member references from included classes to included classes.
const memberExists = (
  className: string,
  name: string,
  descriptor: string,
  isField: boolean,
  seen = new Set<string>()
): boolean => {
  if (seen.has(className)) return false;

  seen.add(className);

  const entry = included.get(className);

  if (!entry) return true;

  const { cf } = entry;
  const found = isField
    ? cf.fields.some((field) => field.name === name)
    : cf.methods.some(
        (method) => method.name === name && method.descriptor === descriptor
      );

  if (found) return true;

  if (
    !isField &&
    (className === "java/lang/invoke/MethodHandle" ||
      className === "java/lang/invoke/VarHandle")
  ) {
    return true;
  }

  return [cf.superName, ...cf.interfaces].some(
    (parent) =>
      parent !== undefined &&
      memberExists(parent, name, descriptor, isField, seen)
  );
};
const brokenLinks = new Map<string, Set<string>>();

for (const [name, { cf }] of included) {
  for (const entry of cf.constantPool) {
    if (
      !entry ||
      (entry.tag !== CONSTANT_Fieldref &&
        entry.tag !== CONSTANT_Methodref &&
        entry.tag !== CONSTANT_InterfaceMethodref)
    ) {
      continue;
    }

    const { className, descriptor, name: member } = entry.value;

    if (className.startsWith("[") || !included.has(className)) continue;

    if (
      !memberExists(className, member, descriptor, entry.tag === CONSTANT_Fieldref)
    ) {
      const key = `${className}.${member}${entry.tag === CONSTANT_Fieldref ? ":" : ""}${descriptor}`;

      if (!brokenLinks.has(key)) brokenLinks.set(key, new Set());

      brokenLinks.get(key)?.add(name);
    }
  }
}

const natives = [...included]
  .filter(([, { own: isOwn }]) => !isOwn)
  .flatMap(([name, { cf }]) =>
    cf.methods
      .filter((method) => method.access & ACC_NATIVE)
      .map((method) => `${name}.${method.name}${method.descriptor}`)
  );

const files: Record<string, Uint8Array> = {};

for (const [name, { bytes }] of [...included].sort((a, b) =>
  a[0].localeCompare(b[0])
)) {
  files[`${name}.class`] = bytes;
}

// Data files the class library reads from java.home, served from the jar.
for (const resource of ["lib/tzdb.dat"]) {
  const data = jdk.read(resource);

  if (data) files[resource] = data;
}

files["META-INF/MANIFEST.MF"] = new TextEncoder().encode(
  "Manifest-Version: 1.0\nCreated-By: gregOS Java Runner\n"
);

mkdirSync(join(root, "jars"), { recursive: true });
writeFileSync(output, zipSync(files, { level: 9, mtime: new Date("2026-01-01") }));

const report: string[] = [
  "# Java runner class library",
  "",
  "Generated by `scripts/javaRunner/buildRuntime.ts`. Do not edit.",
  "",
  `- Own classes: ${[...included.values()].filter((entry) => entry.own).length}`,
  `- Borrowed OpenJDK 21 classes: ${[...included.values()].filter((entry) => !entry.own).length}`,
  `- runtime.jar size: ${statSync(output).size.toLocaleString("en-US")} bytes`,
  "",
  "## Referenced but not included",
  "",
  "Loading these throws `NoClassDefFoundError`. Each is listed with up to three referencing classes.",
  "",
  ...[...missing]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(
      ([name, from]) =>
        `- \`${name}\` ← ${[...from].slice(0, 3).map((f) => `\`${f}\``).join(", ")}`
    ),
  "",
  "## Broken member links",
  "",
  "References from included classes to members that do not exist in the included version of the target class (usually a member the runner's own class does not provide).",
  "",
  ...[...brokenLinks]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(
      ([key, from]) =>
        `- \`${key}\` ← ${[...from].slice(0, 3).map((f) => `\`${f}\``).join(", ")}${from.size > 3 ? ` (+${from.size - 3})` : ""}`
    ),
  "",
  "## Native methods in borrowed classes",
  "",
  ...natives.sort().map((native) => `- \`${native}\``),
  "",
];

writeFileSync(reportPath, report.join("\n"));
console.log(
  `runtime.jar: ${included.size} classes, ${statSync(output).size} bytes; ${missing.size} missing, ${brokenLinks.size} broken links, ${natives.length} borrowed natives`
);

if (!existsSync(output)) process.exit(1);
