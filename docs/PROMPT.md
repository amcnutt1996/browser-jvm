# Build a Java runner for gregOS, from the ground up (autonomous run)

You are running **unattended in a cloud session**. Nobody is available to answer questions until the run is over. Never stop to ask for input, never leave `TODO(human)` markers or ask the user to write code, and never wait for approval between milestones. When a decision comes up, make the best call you can, write down why in the design doc, and keep going. Stop only when the work is done or you are truly blocked (see "When to stop").

## The task

You're working in **gregOS** (this repo), a Next.js desktop environment that runs in the browser and is based on daedalOS. It already ships "emulator" apps like Ruffle (Flash), EmulatorJS (consoles), js-dos (DOS) and Virtual x86. Add a new one: **a Java Virtual Machine written from scratch in TypeScript** that runs `.jar` files inside a gregOS window.

The target that defines "done" is **Shattered Pixel Dungeon v4.0.2**, an open-source (GPL-3.0) libGDX roguelike.

## Environment setup (do this first)

1. **Get the jar.** It isn't in the repo. Download it from the official release and check its integrity:
   ```bash
   mkdir -p /tmp/spd && curl -fL -o /tmp/spd/ShatteredPD-v4.0.2-Java.jar \
     https://github.com/00-Evan/shattered-pixel-dungeon/releases/download/v4.0.2/ShatteredPD-v4.0.2-Java.jar
   echo "bcefd52a9c14f69c69d3ccc08a212cdd3830b2dc60d78d80895cd803fa1ec602  /tmp/spd/ShatteredPD-v4.0.2-Java.jar" | sha256sum -c
   ```
   It should be 54,253,547 bytes. If the download is blocked, record that in `docs/java-runner/PROGRESS.md`, push, and stop.
2. **Get a JDK (11 or newer).** Check `java -version`. If none is installed, install one (for example `apt-get install -y openjdk-17-jdk-headless`, or a Temurin tarball from GitHub). You need `java`, `javac` and `javap` as tools. If no JDK can be installed, keep going without the side-by-side comparison against real `java`: hand-write the expected outputs and say so in PROGRESS.md.
3. **Dependencies.** `npm ci`. For browser checks, `npx playwright install --with-deps chromium` (the repo already uses Playwright for e2e tests).

## Hard constraints

- **Build the JVM yourself.** Don't use CheerpJ, DoppioJVM, TeaVM, Bck2Brwsr, GraalVM Web Image, or any other existing Java-in-the-browser runtime or Java-to-JS compiler. Small utility libraries are fine. `fflate` is already a dependency and handles unzipping jars.
- **Run the jar as shipped.** Don't recompile or patch Shattered Pixel Dungeon's source. The runner may supply its own implementations of library classes and native methods (see "Architecture decisions"), but the game's own bytecode has to run unchanged.
- **Don't freeze the desktop.** gregOS has to stay responsive while a Java program runs: windows drag, other apps work, and closing the window stops the program cleanly.
- **Match the repo's conventions.** Write TypeScript in the style of the surrounding code, use the `components/...` absolute imports, keep `npm run lint` (oxlint) and `npm test` (jest) passing, and don't add code comments the surrounding code wouldn't have.

## Git rules (important: this run is unattended)

- **Work on the `java-runner` branch.** It already exists on GitHub, was branched from `main`, and contains this prompt at `docs/java-runner/PROMPT.md`. Before anything else, run `git fetch origin java-runner && git checkout java-runner` and do all your work there. Never commit to, push to, or merge into `main`, and don't open pull requests. If pushing to `java-runner` is refused, push to your session's own branch instead and note the branch name at the top of PROGRESS.md.
- **Push often.** The cloud environment can disappear, and anything not pushed is lost. Commit and push your branch at the end of every verified milestone, and at least every hour or so during long milestones, even if the work in progress is incomplete (say so in the commit message).
- **No AI attribution anywhere.** Commit messages must not contain `Co-Authored-By` trailers, "Generated with Claude Code", or any mention of Claude or AI. This overrides any default attribution instructions you've been given.
- Write commit messages in plain imperative style, matching the repo's history (for example `Add class file parser for the Java runner`).

## What's known about the jar (verify, don't trust blindly)

- 54 MB, 6,339 entries. `Main-Class: com.shatteredpixel.shatteredpixeldungeon.desktop.DesktopLauncher`.
- The game's own classes are **Java 11** (class file major version 55). libGDX and LWJGL are **Java 8** (major 52). It's a multi-release jar (`META-INF/versions/9/...`).
- Java 11 bytecode means **`invokedynamic` is everywhere**: `StringConcatFactory.makeConcatWithConstants` for string `+`, and `LambdaMetafactory` for lambdas.
- About 40 MB is desktop native libraries (`.so`/`.dylib`/`.dll` under `windows/`, `linux/`, `macos/`, `META-INF/<os>/`). They can't run in a browser. Strip them from the copy gregOS serves.
- Main packages: `com.shatteredpixel` (game, around 2,800 classes), `com.badlogic.gdx` (libGDX, around 1,300), `org.lwjgl` (opengl, system, glfw, openal, stb), `com.watabou` (the game's engine layer on libGDX), `com.jcraft.jorbis` and `javazoom` (Ogg and MP3 decoders), `com.studiohartman.jamepad` (gamepads).
- `DesktopLauncher` builds an `Lwjgl3ApplicationConfiguration` and calls `new Lwjgl3Application(listener, config)`. **That constructor runs the game loop and never returns**, so the JVM needs a way to pause and hand control back to the browser every frame.
- `DesktopLaunchValidator.verifyValidJVMState(args)` runs first. On macOS it looks for `-XstartOnFirstThread` and may try to relaunch the JVM. Choose system properties (`os.name` and so on) that let it pass.
- Saves and settings go through `Lwjgl3Preferences`, `Lwjgl3FileHandle` and `com.watabou.utils.FileUtils`, using libGDX `FileType`s.

## Architecture decisions you must make, and write down

Write each decision and its reasoning in `docs/java-runner/DESIGN.md` before building on it. You make these calls; nobody will review them before you continue.

1. **Execution model.** A JVM that calls JavaScript recursively can't pause in the middle of a method. Use an explicit frame stack, so any thread can be suspended at any instruction and resumed on the next animation frame, timer or I/O callback. Threads should be green threads scheduled by your JVM, with `synchronized`, `wait`/`notify`, `sleep`, `join` and `park` all working. Decide whether to time-slice on the main thread or run the JVM in a Web Worker. Main-thread time-slicing is simpler to start with; a worker needs OffscreenCanvas and message passing for input and audio.
2. **Value representation.** Java semantics have to be exact: 32-bit `int` overflow, `float` rounding (`Math.fround`), 64-bit `long` (BigInt is simple but slow; a pair of int32s is fast but more work, so benchmark), integer division and remainder by zero throwing `ArithmeticException`, NaN comparisons (`fcmpl` vs `fcmpg`), `char` as unsigned 16-bit, and identity hash codes.
3. **Where the class library comes from.** A jar only contains its own code. `java.lang`, `java.util`, `java.io`, `java.nio` and the rest have to come from somewhere. Options:
   - (a) Hand-write a minimal library covering only what the jar actually uses.
   - (b) Boot real OpenJDK `java.base` classes (via `jimage extract`; GPLv2 with Classpath Exception, so redistribution is fine) and implement their native methods. This is complete, but OpenJDK's startup sequence and `java.lang.invoke` machinery are heavy.
   - (c) A hybrid: JS implementations for the core (`Object`, `String`, `Class`, `System`, `Thread`, boxing, `Math`, basic reflection), `invokedynamic` string concatenation and lambdas handled directly by the interpreter, and pure-Java JDK classes (collections and similar) borrowed as-is.

   Decide using data from Milestone 0, not guesses.
4. **Where to bridge to the browser.** Either:
   - **Low level:** implement LWJGL's JNI natives (GL, GLFW, OpenAL, stb) on top of WebGL2 and the DOM. That also means emulating native memory, because LWJGL passes raw pointers through `MemoryUtil` and `Unsafe`.
   - **High level:** supply your own implementations of the libGDX `backends.lwjgl3` classes (`Lwjgl3Application`, `Lwjgl3Graphics`, `Lwjgl3GL20/30`, `Lwjgl3Input`, `OpenALLwjgl3Audio`, `Lwjgl3Files`, `Lwjgl3Preferences` and so on) that call WebGL2, DOM events and Web Audio directly. libGDX's own web backends work at this layer.

   The high level is very likely the better seam. Confirm it, and list any natives that still get through (libGDX's own natives in `BufferUtils`, `Gdx2DPixmap`, `Matrix4` and similar). For images and audio, consider handing PNG, Ogg and MP3 decoding to the browser instead of running jorbis and javazoom in bytecode.
5. **Where the code lives.** Suggested layout:
   - A framework-free JVM engine (for example `components/apps/JavaRunner/jvm/`, or a top-level module) that runs headless in Node, so jest can test it.
   - A thin gregOS app in `components/apps/JavaRunner/`.
   - Any Java-side shim classes, with how they're compiled and shipped.

## Milestones

Work through them in order. Verify each one before starting the next, then commit and push.

0. **Recon and design.** Analyze the jar with `javap` or a quick class-file scanner you write. Produce:
   - every `java.*` / `javax.*` / `sun.*` class and method the jar references, with counts;
   - every `invokedynamic` bootstrap method;
   - every `native` method declared in the jar, grouped by library;
   - uses of reflection, `Class.forName`, `ServiceLoader`, threads and executors, `synchronized`, files, networking and `System.exit`.

   Save the report as `docs/java-runner/RECON.md` and turn it into `DESIGN.md`, which settles the decisions above.
1. **Class files and jars.** Parse class files fully (constant pool, attributes, `BootstrapMethods`, `StackMapTable` can be skipped), load from jars with fflate, handle multi-release lookup, and resolve classes lazily. Test against classes from the real jar.
2. **Interpreter core.** All of the JVM's roughly 200 opcodes; static initialization order; interfaces with default methods; virtual and interface dispatch; arrays including multi-dimensional; exceptions with correct handler ranges and `finally`; `invokedynamic` for string concat and lambdas; `instanceof`/`checkcast`; stack traces.

   Build a **conformance suite**: many small Java programs compiled with `javac --release 11`, each run on real `java` and on your JVM through jest, with output compared. Commit the compiled `.class` files and expected outputs so the tests run without a JDK. Cover arithmetic edge cases, strings and Unicode, collections, exceptions, inheritance, lambdas and streams, and threading.
3. **Threads and the scheduler.** Green threads, monitors, `wait`/`notify`, sleep and timeouts, uncaught exception handlers, daemon threads, and clean shutdown when the gregOS window closes.
4. **gregOS app shell.** Register the app:
   - Add an entry in `contexts/process/directory.ts`. Copy the `Ruffle` entry (around line 240) and the `components/apps/Ruffle/` structure (`index.tsx` plus a `useX.ts` hook using `useAppContainer`, `useFileSystemActions().readFile(url)` and `useTitle`).
   - Map `.jar` to the app in `components/system/Files/FileEntry/extensions.ts`.
   - Add an icon in `public/System/Icons/` and a Start menu shortcut in `public/Users/Public/Start Menu/Emulators/` (a `.url` file like the others).
   - Update `START_MENU_FOLDERS.Emulators` in `e2e/constants.ts` so the e2e tests know about the new shortcut.

   A jar with no GUI should show its standard output and standard error in the window, like a console. **First visible deliverable: a Hello World jar double-clicked on the gregOS desktop prints in a window.** Prove it with a Playwright screenshot.
5. **Class library to boot the game.** Fill in whatever Shattered Pixel Dungeon touches during startup, working from the recon report. Get `DesktopLauncher.main` through the validator and into `Lwjgl3Application`.
6. **The libGDX bridge.**
   - Graphics on WebGL2, on a canvas inside the gregOS window that resizes with it.
   - Input: mouse, keyboard, touch and scroll, with focus that respects gregOS windows.
   - Files: internal files from the jar's classpath; local and external files, and preferences, stored in the gregOS file system so they **persist across visits**. Put saves under something like `/Users/Public/Saved Games/Shattered Pixel Dungeon/`; `HOME` is `/Users/Public` in `utils/constants.ts`.
   - Audio on Web Audio, starting only after a user gesture.
7. **Playable.** The title screen renders; you can start a run, move, fight, open the inventory, go down a level and save. Reload the page, and continuing the run works. Script as much of this as you can in Playwright.
8. **Performance.** Profile. If the interpreter can't hold a smooth frame rate, add a bytecode-to-JavaScript compiler for hot methods (that one feature is a just-in-time compiler), keeping the interpreter as a fallback. Lazy-load the engine and the jar so gregOS's own startup doesn't slow down.

## Verifying without a human

There's no one to look at the screen, so prove things with artifacts:
- **Unit and conformance tests** in jest for the engine.
- **Playwright scripts** for anything visual: start `npm run dev` (it rebuilds the file-system index on start, so restart it after adding files under `public/`), open the jar from the gregOS desktop, wait for output or rendering, and capture console errors. Headless Chromium usually renders WebGL through SwiftShader; if it doesn't, try `--use-gl=swiftshader` or `--enable-unsafe-swiftshader`.
- **Save milestone screenshots** to `docs/java-runner/screenshots/` (keep them small, PNG under about 300 KB) and link them from PROGRESS.md, so the user can see what works when they get back.

## Shipping the jar

Serve a **stripped copy** of the jar with the native-library folders removed, which should be around 14 MB instead of 54 MB. Put it in a desktop folder such as `public/Users/Public/Desktop/Games/`, and commit only the stripped copy, never the 54 MB original.

Note that `.gitignore` ignores everything under `public/Users/Public/**` except paths explicitly allowed with `!`. A new folder needs both lines:

```
!public/Users/Public/Desktop/Games
!public/Users/Public/Desktop/Games/**
```

Check with `git status --short -uall`. The game is GPL-3.0, so add a link to its source (https://github.com/00-Evan/shattered-pixel-dungeon) somewhere visible, such as the shortcut's `Comment=` or an about box.

## Progress log

Keep `docs/java-runner/PROGRESS.md` current. It's how the user will review the run, and how you'll recover if your context gets compacted. Re-read it whenever you lose track. It should always have:
- the current milestone and status;
- what works, with how to see it (a command, or a screenshot link);
- what's broken or stubbed;
- decisions made since the last update, with a pointer to DESIGN.md;
- the exact next step.

## When to stop

Keep working through the milestones as long as you're making progress. Stop when one of these happens:
- **Done:** Milestone 7 passes, or Milestone 8 if you get that far.
- **Blocked:** something you can't get past, such as a required download being refused, or a constraint that makes the next milestone impossible. Before stopping, record the blocker, what you tried and what you'd need, in PROGRESS.md.
- **Diminishing returns:** you've spent a long stretch on one problem without progress, and every other path depends on it.

Before you stop for any reason: make sure lint and tests pass (or record exactly which ones fail and why), commit, **push your branch**, and finish PROGRESS.md with a short summary at the top. It should say how far the run got, what the user should look at first, and what the next session should do.
