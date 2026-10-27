import { type GdxHost } from "./host.ts";
import { bytesOf } from "../jvm/natives/helpers.ts";
import { type JArray } from "../jvm/types.ts";
import { type JVM, type NativeTable } from "../jvm/vm.ts";

const CURSORS = [
  "default",
  "text",
  "crosshair",
  "pointer",
  "ew-resize",
  "ns-resize",
  "nwse-resize",
  "nesw-resize",
  "move",
  "not-allowed",
  "none",
];

const intArray = (vm: JVM, values: number[]): JArray => {
  const array = vm.newArray("I", values.length);

  (array as unknown as Int32Array).set(values);

  return array;
};

export const backendNatives =
  (host: GdxHost) =>
  (vm: JVM): NativeTable => {
    const HOST = "com/badlogic/gdx/backends/lwjgl3/WebHost.";
    const AUDIO = "com/badlogic/gdx/backends/lwjgl3/audio/WebAudio.";
    const { state } = host;
    let nextSound = 1;
    let nextInstance = 1;

    const backBuffer = (size: number): number => Math.max(1, Math.round(size * state.density));

    return {
      [`${AUDIO}getPosition(I)F`]: (_t, [id]) => state.positions.get(id as number) ?? 0,
      [`${AUDIO}load([BLjava/lang/String;Z)I`]: (_t, [data, name, stream]) => {
        const id = nextSound++;

        host.send({
          data: new Uint8Array(bytesOf(data as JArray)),
          id,
          name: name as string,
          op: "load",
          stream: Boolean(stream),
          type: "audio",
        });

        return id;
      },
      [`${AUDIO}pause(IJ)V`]: (_t, [id, instance]) =>
        host.send({ id: id as number, instance: Number(instance), op: "pause", type: "audio" }),
      [`${AUDIO}play(IFFFZ)J`]: (_t, [id, volume, pitch, pan, loop]) => {
        const instance = nextInstance++;

        host.send({
          id: id as number,
          instance,
          loop: Boolean(loop),
          op: "play",
          pan: pan as number,
          pitch: pitch as number,
          type: "audio",
          volume: volume as number,
        });

        return BigInt(instance);
      },
      [`${AUDIO}pollCompleted()[I`]: () => {
        if (state.completed.length === 0) return null;

        return intArray(vm, state.completed.splice(0));
      },
      [`${AUDIO}resume(IJ)V`]: (_t, [id, instance]) =>
        host.send({ id: id as number, instance: Number(instance), op: "resume", type: "audio" }),
      [`${AUDIO}setLooping(IJZ)V`]: (_t, [id, instance, loop]) =>
        host.send({ id: id as number, instance: Number(instance), op: "set", property: "loop", type: "audio", value: loop as number }),
      [`${AUDIO}setPan(IJF)V`]: (_t, [id, instance, pan]) =>
        host.send({ id: id as number, instance: Number(instance), op: "set", property: "pan", type: "audio", value: pan as number }),
      [`${AUDIO}setPitch(IJF)V`]: (_t, [id, instance, pitch]) =>
        host.send({ id: id as number, instance: Number(instance), op: "set", property: "pitch", type: "audio", value: pitch as number }),
      [`${AUDIO}setPosition(IF)V`]: (_t, [id, seconds]) =>
        host.send({ id: id as number, op: "seek", seconds: seconds as number, type: "audio" }),
      [`${AUDIO}setVolume(IJF)V`]: (_t, [id, instance, volume]) =>
        host.send({ id: id as number, instance: Number(instance), op: "set", property: "volume", type: "audio", value: volume as number }),
      [`${AUDIO}stop(IJ)V`]: (_t, [id, instance]) =>
        host.send({ id: id as number, instance: Number(instance), op: "stop", type: "audio" }),
      [`${AUDIO}unload(I)V`]: (_t, [id]) => {
        state.positions.delete(id as number);
        host.send({ id: id as number, op: "unload", type: "audio" });
      },
      [`${HOST}getBackBufferHeight()I`]: () => backBuffer(state.height),
      [`${HOST}getBackBufferWidth()I`]: () => backBuffer(state.width),
      [`${HOST}getClipboard()Ljava/lang/String;`]: () => state.clipboard,
      [`${HOST}getDensity()F`]: () => state.density,
      [`${HOST}getHeight()I`]: () => state.height,
      [`${HOST}getScreenHeight()I`]: () => state.screenHeight,
      [`${HOST}getScreenWidth()I`]: () => state.screenWidth,
      [`${HOST}getWidth()I`]: () => state.width,
      [`${HOST}isFullscreen()Z`]: () => (state.fullscreen ? 1 : 0),
      [`${HOST}openURI(Ljava/lang/String;)Z`]: (_t, [url]) => {
        host.send({ type: "open", url: url as string });

        return 1;
      },
      [`${HOST}pollEvents()[I`]: () => {
        if (state.events.length === 0) return null;

        return intArray(vm, state.events.splice(0));
      },
      [`${HOST}setClipboard(Ljava/lang/String;)V`]: (_t, [text]) => {
        state.clipboard = (text as null | string) ?? "";
        host.send({ text: state.clipboard, type: "clipboard" });
      },
      [`${HOST}setCustomCursor([IIIII)V`]: (_t, [pixels, width, height, x, y]) => {
        const source = pixels as Int32Array;
        const rgba = new Uint8ClampedArray(source.length * 4);

        source.forEach((color, index) => {
          rgba[index * 4] = (color >>> 24) & 0xff;
          rgba[index * 4 + 1] = (color >>> 16) & 0xff;
          rgba[index * 4 + 2] = (color >>> 8) & 0xff;
          rgba[index * 4 + 3] = color & 0xff;
        });
        host.send({
          height: height as number,
          pixels: rgba,
          type: "customCursor",
          width: width as number,
          x: x as number,
          y: y as number,
        });
      },
      [`${HOST}setFullscreen(Z)V`]: (_t, [value]) =>
        host.send({ type: "fullscreen", value: Boolean(value) }),
      [`${HOST}setSystemCursor(I)V`]: (_t, [cursor]) =>
        host.send({ cursor: CURSORS[cursor as number] ?? "default", type: "cursor" }),
      [`${HOST}setTitle(Ljava/lang/String;)V`]: (_t, [title]) =>
        host.send({ title: title as string, type: "title" }),
      [`${HOST}setWindowSize(II)V`]: (_t, [width, height]) =>
        host.send({ height: height as number, type: "size", width: width as number }),
      [`${HOST}waitForFrame()Z`]: {
        *gen() {
          yield vm.wait(host.nextFrame());

          return 1;
        },
      },
      "com/badlogic/gdx/utils/GdxNativesLoader.load()V": () => null,
      "com/badlogic/gdx/utils/SharedLibraryLoader.load(Ljava/lang/String;)V": () => null,
      "com/studiohartman/jamepad/ControllerIndex.nativeConnectController(I)J": () => 0n,
      "com/studiohartman/jamepad/ControllerIndex.nativeIsConnected(J)Z": () => 0,
      "com/studiohartman/jamepad/ControllerManager.getLastNativeError()Ljava/lang/String;": () => "",
      "com/studiohartman/jamepad/ControllerManager.nativeAddMappingsFromBuffer([BI)Z": () => 1,
      "com/studiohartman/jamepad/ControllerManager.nativeAddMappingsFromFile(Ljava/lang/String;)Z": () => 1,
      "com/studiohartman/jamepad/ControllerManager.nativeCloseSDLGamepad()V": () => null,
      "com/studiohartman/jamepad/ControllerManager.nativeControllerConnectedOrDisconnected()Z": () => 0,
      "com/studiohartman/jamepad/ControllerManager.nativeGetNumRollers()I": () => 0,
      "com/studiohartman/jamepad/ControllerManager.nativeInitSDLGamepad(Z)Z": () => 1,
      "org/lwjgl/util/tinyfd/TinyFileDialogs.<clinit>()V": () => null,
      "org/lwjgl/util/tinyfd/TinyFileDialogs.tinyfd_messageBox(Ljava/lang/CharSequence;Ljava/lang/CharSequence;Ljava/lang/CharSequence;Ljava/lang/CharSequence;Z)Z":
        (_t, [title, message]) => {
          vm.host.stderr(new TextEncoder().encode(`${String(title)}\n${String(message)}\n`));

          return 1;
        },
    };
  };
