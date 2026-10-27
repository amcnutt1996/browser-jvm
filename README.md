# browser-jvm

A Java Virtual Machine written from scratch in TypeScript. It runs real
`.jar` files in the browser (or in Node), with no Java installed and no
Java-to-JavaScript compiler: it loads the class files and executes their
bytecode. It also ships its own libGDX backend, so libGDX desktop games run
on WebGL2.

The proof is **[Shattered Pixel Dungeon](https://github.com/00-Evan/shattered-pixel-dungeon)
v4.0.2**, a full libGDX roguelike, running from its original, unmodified
desktop jar: title screen, a new run, the tutorial, exploring, fighting,
taking the stairs, saving, and continuing after a restart.

![Shattered Pixel Dungeon's welcome screen running on browser-jvm inside a desktop window in the browser](docs/screenshots/welcome.png)

## What it does

- **Runs real class files.** All of the JVM's roughly 200 opcodes, exact
  Java arithmetic (32-bit `int` overflow, `float` rounding, 64-bit `long`,
  NaN comparisons), exceptions with `finally`, interfaces with default
  methods, string concatenation and lambdas through `invokedynamic`, basic
  reflection, and multi-release jars. Tested with Java 8 and 11 bytecode
  (and OpenJDK 21's own library classes); newer `invokedynamic` features
  such as records and pattern-matching `switch` are not supported yet.
- **Never freezes the page.** Every Java call lives on an explicit frame
  stack instead of the JavaScript stack, so any thread can pause at any
  instruction. Java threads are green threads with real monitors,
  `wait`/`notify`, `sleep`, `join`, `park` and interrupts, scheduled in
  short time slices. It is designed to run in a Web Worker.
- **Compiles hot code.** A JIT turns frequently used methods into
  JavaScript functions and falls back to the interpreter whenever compiled
  code would have to wait. Shattered Pixel Dungeon's title scene went from
  37 ms per frame to under 4 ms.
- **Brings its own class library.** A small core written for this runner
  (`Object`, `String`, `Class`, `System`, `Thread`, reflection, NIO buffers
  on typed arrays, files over a pluggable file system) plus pure-Java
  classes taken unmodified from OpenJDK 21, packed into `jars/runtime.jar`.
- **Runs libGDX games.** `jars/gdx.jar` replaces libGDX's LWJGL3 desktop
  backend. Behind it, JavaScript natives draw with WebGL2 on an
  `OffscreenCanvas`, decode PNG and JPEG images, render FreeType fonts with
  opentype.js, play sound and music with Web Audio, and turn DOM keyboard,
  mouse and wheel events into libGDX input.
- **Talks to your app through one small interface.** Standard output and
  error, standard input, environment, system properties and the file
  system are all callbacks you supply, so saves can go to IndexedDB, a
  virtual desktop's file system, or memory.

## Milestones

It was built in nine milestones during one unattended run, from recon to a
playable game. The full story, with every status message and screenshot
along the way, is in [docs/build-log](docs/build-log/README.md).

| | |
| --- | --- |
| ![A Hello World jar double-clicked on a browser desktop prints in a console window](docs/screenshots/hello.png) | ![Hero selection with the Warrior's splash art](docs/screenshots/hero-select.png) |
| **Milestone 4:** a Hello World jar double-clicked on a browser desktop prints in a console window. | **Milestone 6:** the game's hero selection, with JPEG splash art and FreeType text. |
| ![Floor 1 of the dungeon in the browser](docs/screenshots/floor1.png) | ![The inventory pane opened by the scripted playthrough](docs/screenshots/inventory.png) |
| **Milestone 7:** floor 1, generated and rendered in the browser. | **Milestone 7:** inventory, opened by the scripted playthrough. |
| ![Exploring zoomed out and fighting rats](docs/screenshots/explore.png) | ![Floor 2 after taking the stairs down](docs/screenshots/floor2.png) |
| **Milestone 7:** exploring and fighting rats. | **Milestone 7:** down the stairs to floor 2. |

After closing the game (which saves) and opening it again, "Continue"
returns to floor 2 with the same health and experience:

![The run continued on floor 2 after closing and reopening the game](docs/screenshots/continued.png)

| Milestone | Result |
| --- | --- |
| 0. Recon and design | Every JDK class, `invokedynamic` and native method the game uses: [RECON.md](docs/RECON.md), [DESIGN.md](docs/DESIGN.md) |
| 1. Class files and jars | Parses all 2,817 runtime classes and the game's 6,339-entry jar |
| 2. Interpreter | 11 conformance programs match OpenJDK 21 byte for byte |
| 3. Threads | Green threads, monitors, `wait`/`notify`, clean shutdown |
| 4. Console apps | Text programs run in a browser window with stdin and stdout |
| 5. Class library | The game's `DesktopLauncher.main` runs unchanged |
| 6. libGDX bridge | WebGL2, input, Web Audio, saves through the host file system |
| 7. Playable | A Playwright script plays through every step above |
| 8. Performance | JIT compiler and lazy loading; browser profiling is next |

## Install

```sh
npm install github:amcnutt1996/browser-jvm#v1.0.0
```

Installing from GitHub builds `dist/` automatically. Node 22.18 or newer
is needed for the scripts and tests, which run TypeScript directly.

Your app also needs to serve the jars in `node_modules/browser-jvm/jars/`
as static files: `runtime.jar` (5.4 MB, always) and `gdx.jar` (28 KB, only
for libGDX games).

## Run a jar in Node

```ts
import { readFileSync } from "node:fs";
import { createJvm, mainClassOf, runMain } from "browser-jvm";

const vm = createJvm({
  classPath: [{ data: readFileSync("Hello World.jar"), path: "Hello World.jar" }],
  host: {
    stderr: (data) => process.stderr.write(data),
    stdout: (data) => process.stdout.write(data),
  },
  runtime: readFileSync("node_modules/browser-jvm/jars/runtime.jar"),
});

process.exitCode = await runMain(vm, mainClassOf(vm) ?? "HelloWorld");
```

Or from a clone of this repository:

```sh
node scripts/run.ts -jar "examples/Hello World.jar"
```

## Run a jar in the browser

Run the JVM in a Web Worker, so it gets a whole core and the page stays
responsive:

```ts
// jvm.worker.ts
import { createJvm, mainClassOf, runMain } from "browser-jvm";

const fetchBytes = async (url: string): Promise<Uint8Array> =>
  new Uint8Array(await (await fetch(url)).arrayBuffer());

self.onmessage = async ({ data }: MessageEvent<{ jarUrl: string }>) => {
  const decoder = new TextDecoder();
  const vm = createJvm({
    classPath: [{ data: await fetchBytes(data.jarUrl), path: data.jarUrl }],
    host: {
      stderr: (bytes) => postMessage({ stderr: decoder.decode(bytes) }),
      stdout: (bytes) => postMessage({ stdout: decoder.decode(bytes) }),
    },
    runtime: await fetchBytes("/jars/runtime.jar"),
  });
  const mainClass = mainClassOf(vm);

  postMessage({ exit: mainClass ? await runMain(vm, mainClass) : 1 });
};
```

Closing the worker (`worker.terminate()`) stops the program at once;
`vm.stop()` stops it from inside the worker.

The `host` object can also provide:

| Field | Purpose |
| --- | --- |
| `fs` | A `HostFileSystem` (`read`, `write`, `stat`, `list`, `mkdir`, `rename`, `delete`, all async) for `java.io.File` and friends. `createMemoryFileSystem()` gives an in-memory one. |
| `readStdin` | Returns the next chunk of standard input, or `undefined` at end of stream. |
| `env`, `properties` | Environment variables and Java system properties. |

## Run a libGDX game

libGDX desktop games (built for the LWJGL3 backend) need three more
pieces. `usesGdx(jarBytes)` tells you whether a jar needs them.

1. **Put `gdx.jar` first on the class path**, so its backend classes
   replace the ones bundled in the game jar.
2. **In the worker**, give the JVM the canvas and the libGDX natives:

   ```ts
   import { createEventState, createJvm, gdxNatives, mainClassOf, runMain } from "browser-jvm";

   // width, height and density (devicePixelRatio) come from the page.
   const state = createEventState(width, height, density);
   const vm = createJvm({
     classPath: [
       { data: gdxJar, path: "gdx.jar" },
       { data: gameJar, path: "game.jar" },
     ],
     host: { fs, stderr, stdout },
     natives: gdxNatives({
       canvas: offscreenCanvas, // from canvas.transferControlToOffscreen()
       nextFrame: () => new Promise((resolve) => requestAnimationFrame(() => resolve())),
       send: (command) => postMessage({ command }), // title, size, cursor, audio...
       state, // push input from the page into state.events
     }),
     runtime,
   });
   ```

3. **On the page**, attach the bridge to the canvas element. It forwards
   keyboard, mouse, wheel, focus and resize events as `PageEvent`s for the
   worker, and plays the audio that the worker's `send` commands describe:

   ```ts
   import { attachGdxCanvas } from "browser-jvm";

   const page = attachGdxCanvas(canvasElement, {
     onFullscreen: (fullscreen) => {},
     onSize: (width, height) => {},
     onTitle: (title) => (document.title = title),
     send: (event) => worker.postMessage({ event }),
   });

   worker.onmessage = ({ data }) => data.command && page.handle(data.command);
   ```

[gregOS](https://github.com/amcnutt1996/gregOS) is a complete, working
example of all of this: see its `components/apps/JavaRunner/`
(`javaRunner.worker.ts` for the worker side and `session.ts` for the page
side, including how input events are applied to the shared state and how
saves go to the desktop's file system).

## Repository layout

| Path | What it is |
| --- | --- |
| [`src/jvm/`](src/jvm) | The engine: class files, zip reader, interpreter, JIT, threads, natives |
| [`src/gdx/`](src/gdx) | libGDX natives (WebGL2, pixmaps, PNG, FreeType, input, audio) and the page-side bridge |
| [`java/base/`](java/base) | Java sources of the runner's own class library |
| [`java/gdx/`](java/gdx) | Java sources of the libGDX desktop backend |
| [`jars/`](jars) | Prebuilt `runtime.jar` and `gdx.jar` |
| [`test/`](test) | Class file, scheduler and conformance tests |
| [`scripts/`](scripts) | Build scripts for the jars, recon, a Node runner and the conformance diff tool |
| [`examples/`](examples) | Hello World and Guess the Number jars with their sources |
| [`docs/`](docs) | Design decisions, recon report, progress log and the full build log |

## Development

```sh
npm install
npm test            # 29 tests, including the conformance suite interpreted and JIT-compiled
npm run lint
npm run typecheck
npm run build       # compiles src/ to dist/
```

Rebuilding the jars needs JDK 21 (`javac` and `jmods/java.base.jmod`):

```sh
npm run build:runtime                            # jars/runtime.jar and docs/RUNTIME.md
npm run build:gdx -- path/to/game-with-libgdx.jar   # jars/gdx.jar
sh scripts/buildConformance.sh                   # recompiles conformance programs and records real java output
```

`scripts/run.ts` runs any jar under Node for debugging and profiling, with
`JAVA_RUNNER_JIT`, `JAVA_RUNNER_FRAMES`, `JAVA_RUNNER_EXIT_MS` and scripted
input in `JAVA_RUNNER_INPUT` (see the comment at the top of the file).

## Limitations

- `java.lang.invoke` method handles beyond `VarHandle`, annotation and
  generic-signature reflection, `java.nio.file` and networking are not
  implemented.
- libGDX: no GL30, `ETC1`, multiple windows or gamepads; HTTP requests fail.
- In headless Chromium with software WebGL the game boots in about 25
  seconds; profiling the browser build is the next step
  ([PROGRESS.md](docs/PROGRESS.md)).

## License

The TypeScript and Java sources of this project are MIT licensed
([LICENSE](LICENSE)). `jars/runtime.jar` also contains classes from OpenJDK
21, which are GPL-2.0 with the Classpath Exception; see
[NOTICE.md](NOTICE.md). No game is included: Shattered Pixel Dungeon is
GPL-3.0 and available from
[its repository](https://github.com/00-Evan/shattered-pixel-dungeon).
