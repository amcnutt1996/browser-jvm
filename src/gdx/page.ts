import { type AudioCommand, GDX_EVENT, type GdxCommand } from "./host.ts";

export type PageEvent =
  | { data: number[]; kind: "input" }
  | { density: number; height: number; kind: "resize"; width: number }
  | { id: number; kind: "audioEnded" }
  | { id: number; kind: "audioPosition"; seconds: number }
  | { kind: "clipboard"; text: string }
  | { kind: "fullscreen"; value: boolean };

export type PageCallbacks = {
  onFullscreen: (fullscreen: boolean) => void;
  onSize: (width: number, height: number) => void;
  onTitle: (title: string) => void;
  send: (event: PageEvent) => void;
};

const KEYS: Record<string, number> = {
  AltLeft: 57,
  AltRight: 58,
  ArrowDown: 20,
  ArrowLeft: 21,
  ArrowRight: 22,
  ArrowUp: 19,
  Backquote: 68,
  Backslash: 73,
  Backspace: 67,
  BracketLeft: 71,
  BracketRight: 72,
  CapsLock: 115,
  Comma: 55,
  ControlLeft: 129,
  ControlRight: 130,
  Delete: 112,
  End: 123,
  Enter: 66,
  Equal: 70,
  Escape: 111,
  Home: 3,
  Insert: 124,
  MetaLeft: 63,
  MetaRight: 63,
  Minus: 69,
  NumLock: 143,
  NumpadAdd: 157,
  NumpadComma: 159,
  NumpadDecimal: 158,
  NumpadDivide: 154,
  NumpadEnter: 160,
  NumpadEqual: 161,
  NumpadMultiply: 155,
  NumpadSubtract: 156,
  PageDown: 93,
  PageUp: 92,
  Pause: 121,
  Period: 56,
  PrintScreen: 120,
  Quote: 75,
  ScrollLock: 116,
  Semicolon: 74,
  ShiftLeft: 59,
  ShiftRight: 60,
  Slash: 76,
  Space: 62,
  Tab: 61,
};

const TYPED: Record<number, number> = { 112: 127, 160: 10, 61: 9, 66: 10, 67: 8 };

export const gdxKeyCode = (code: string): number => {
  if (code in KEYS) return KEYS[code];

  const letter = /^Key([A-Z])$/.exec(code);

  if (letter) return 29 + letter[1].charCodeAt(0) - 65;

  const digit = /^Digit(\d)$/.exec(code);

  if (digit) return 7 + Number(digit[1]);

  const numpad = /^Numpad(\d)$/.exec(code);

  if (numpad) return 144 + Number(numpad[1]);

  const functionKey = /^F(\d+)$/.exec(code);

  if (functionKey) {
    const index = Number(functionKey[1]);

    return index <= 12 ? 130 + index : 170 + index;
  }

  return 0;
};

const BUTTONS = [0, 2, 1, 3, 4];

type Instance = {
  gain: GainNode;
  panner: StereoPannerNode;
  source: AudioBufferSourceNode;
};

type Sound = {
  buffer?: Promise<AudioBuffer | null>;
  element?: HTMLAudioElement;
  instances: Map<number, Instance>;
  url?: string;
  wantsPlay?: boolean;
};

const createAudio = (send: PageCallbacks["send"]): { dispose: () => void; handle: (command: AudioCommand) => void; unlock: () => void } => {
  const sounds = new Map<number, Sound>();
  let context: AudioContext | undefined;

  const audioContext = (): AudioContext => {
    context ??= new AudioContext();

    return context;
  };
  const playMusic = (sound: Sound): void => {
    sound.wantsPlay = true;
    sound.element?.play().then(
      () => {
        sound.wantsPlay = false;
      },
      () => null
    );
  };
  const instancesOf = (sound: Sound, instance: number): Instance[] =>
    instance < 0 ? [...sound.instances.values()] : [sound.instances.get(instance)].filter((value): value is Instance => Boolean(value));

  const handle = (command: AudioCommand): void => {
    if (command.op === "load") {
      const type = command.name.toLowerCase().endsWith(".mp3") ? "audio/mpeg" : command.name.toLowerCase().endsWith(".wav") ? "audio/wav" : "audio/ogg";

      if (command.stream) {
        const url = URL.createObjectURL(new Blob([command.data as BlobPart], { type }));
        const element = new Audio(url);

        element.addEventListener("ended", () => send({ id: command.id, kind: "audioEnded" }));
        element.addEventListener("timeupdate", () =>
          send({ id: command.id, kind: "audioPosition", seconds: element.currentTime })
        );
        sounds.set(command.id, { element, instances: new Map(), url });
      } else {
        const data = command.data.buffer.slice(command.data.byteOffset, command.data.byteOffset + command.data.byteLength) as ArrayBuffer;

        sounds.set(command.id, {
          buffer: audioContext()
            .decodeAudioData(data)
            .catch(() => null),
          instances: new Map(),
        });
      }

      return;
    }

    const sound = sounds.get(command.id);

    if (!sound) return;

    switch (command.op) {
      case "play":
        if (sound.element) {
          sound.element.loop = command.loop;
          sound.element.volume = Math.max(0, Math.min(1, command.volume));
          sound.element.currentTime = 0;
          playMusic(sound);
        } else if (context?.state === "running") {
          const audio = context;

          sound.buffer?.then((buffer) => {
            if (!buffer) return;

            const source = audio.createBufferSource();
            const gain = audio.createGain();
            const panner = audio.createStereoPanner();

            source.buffer = buffer;
            source.loop = command.loop;
            source.playbackRate.value = command.pitch;
            gain.gain.value = command.volume;
            panner.pan.value = command.pan;
            source.connect(gain).connect(panner).connect(audio.destination);
            source.addEventListener("ended", () => sound.instances.delete(command.instance));
            sound.instances.set(command.instance, { gain, panner, source });
            source.start();
          });
        }
        break;
      case "stop":
        if (sound.element) {
          sound.element.pause();
          sound.element.currentTime = 0;
          sound.wantsPlay = false;
        }

        for (const instance of instancesOf(sound, command.instance)) instance.source.stop();
        break;
      case "pause":
        if (sound.element) {
          sound.element.pause();
          sound.wantsPlay = false;
        }
        break;
      case "resume":
        if (sound.element) playMusic(sound);
        break;
      case "set":
        if (sound.element) {
          if (command.property === "volume") sound.element.volume = Math.max(0, Math.min(1, command.value));
          else if (command.property === "loop") sound.element.loop = Boolean(command.value);
        }

        for (const instance of instancesOf(sound, command.instance)) {
          if (command.property === "volume") instance.gain.gain.value = command.value;
          else if (command.property === "pan") instance.panner.pan.value = command.value;
          else if (command.property === "pitch") instance.source.playbackRate.value = command.value;
          else instance.source.loop = Boolean(command.value);
        }
        break;
      case "seek":
        if (sound.element) sound.element.currentTime = command.seconds;
        break;
      case "unload":
        if (sound.element) {
          sound.element.pause();
          sound.element.removeAttribute("src");
          sound.element.load();
        }

        if (sound.url) URL.revokeObjectURL(sound.url);

        for (const instance of sound.instances.values()) instance.source.stop();

        sounds.delete(command.id);
        break;
      default:
        break;
    }
  };

  return {
    dispose: () => {
      for (const sound of sounds.values()) {
        sound.element?.pause();

        if (sound.url) URL.revokeObjectURL(sound.url);
      }

      sounds.clear();
      context?.close().catch(() => null);
    },
    handle,
    unlock: () => {
      audioContext()
        .resume()
        .catch(() => null);

      for (const sound of sounds.values()) {
        if (sound.wantsPlay) playMusic(sound);
      }
    },
  };
};

export const attachGdxCanvas = (
  canvas: HTMLCanvasElement,
  { onFullscreen, onSize, onTitle, send }: PageCallbacks
): { dispose: () => void; handle: (command: GdxCommand) => void } => {
  const audio = createAudio(send);
  const pending: number[] = [];
  let flushQueued = false;
  let buttons = 0;
  const flush = (): void => {
    flushQueued = false;

    if (pending.length > 0) send({ data: pending.splice(0), kind: "input" });
  };
  const queue = (...event: number[]): void => {
    pending.push(...event, ...Array.from({ length: 5 - event.length }, () => 0));

    if (!flushQueued) {
      flushQueued = true;
      queueMicrotask(flush);
    }
  };
  const position = (event: MouseEvent): [number, number] => {
    const rect = canvas.getBoundingClientRect();

    return [Math.round(event.clientX - rect.left), Math.round(event.clientY - rect.top)];
  };
  const controller = new AbortController();
  const options = { signal: controller.signal };

  canvas.addEventListener("keydown", (event) => {
    audio.unlock();

    const key = gdxKeyCode(event.code);

    if (key !== 0 && !event.repeat) queue(GDX_EVENT.KEY_DOWN, key);

    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
      queue(GDX_EVENT.KEY_TYPED, event.key.charCodeAt(0));
    } else if (TYPED[key]) {
      queue(GDX_EVENT.KEY_TYPED, TYPED[key]);
    }

    if (!event.metaKey) event.preventDefault();
  }, options);
  canvas.addEventListener("keyup", (event) => {
    const key = gdxKeyCode(event.code);

    if (key !== 0) queue(GDX_EVENT.KEY_UP, key);

    event.preventDefault();
  }, options);
  canvas.addEventListener("pointerdown", (event) => {
    audio.unlock();
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(event.pointerId);

    const button = BUTTONS[event.button] ?? 0;

    buttons |= 1 << button;
    queue(GDX_EVENT.TOUCH_DOWN, ...position(event), button);
    event.preventDefault();
  }, options);
  canvas.addEventListener("pointerup", (event) => {
    const button = BUTTONS[event.button] ?? 0;

    if (!(buttons & (1 << button))) return;

    buttons &= ~(1 << button);
    queue(GDX_EVENT.TOUCH_UP, ...position(event), button);
  }, options);
  canvas.addEventListener("pointermove", (event) => queue(GDX_EVENT.MOUSE_MOVED, ...position(event)), options);
  canvas.addEventListener("wheel", (event) => {
    const scale = event.deltaMode === 0 ? 1 / 100 : 1;
    const floats = new Float32Array([event.deltaX * scale, event.deltaY * scale]);
    const [x, y] = new Int32Array(floats.buffer);

    queue(GDX_EVENT.SCROLLED, x, y);
    event.preventDefault();
  }, options);
  canvas.addEventListener("contextmenu", (event) => event.preventDefault(), options);
  canvas.addEventListener("focus", () => queue(GDX_EVENT.FOCUS, 1), options);
  canvas.addEventListener("blur", () => {
    for (let button = 0; button < 5; button++) {
      if (buttons & (1 << button)) queue(GDX_EVENT.TOUCH_UP, 0, 0, button);
    }

    buttons = 0;
    queue(GDX_EVENT.FOCUS, 0);
  }, options);
  const observer = new ResizeObserver(() => {
    const { height, width } = canvas.getBoundingClientRect();

    if (width > 0 && height > 0) {
      send({ density: window.devicePixelRatio || 1, height: Math.round(height), kind: "resize", width: Math.round(width) });
    }
  });

  observer.observe(canvas);

  const handle = (command: GdxCommand): void => {
    switch (command.type) {
      case "audio":
        audio.handle(command);
        break;
      case "clipboard":
        navigator.clipboard?.writeText(command.text).catch(() => null);
        break;
      case "cursor":
        canvas.style.cursor = command.cursor;
        break;
      case "customCursor": {
        const image = document.createElement("canvas");

        image.width = command.width;
        image.height = command.height;
        image
          .getContext("2d")
          ?.putImageData(new ImageData(command.pixels as Uint8ClampedArray<ArrayBuffer>, command.width, command.height), 0, 0);
        canvas.style.cursor = `url(${image.toDataURL()}) ${command.x} ${command.y}, auto`;
        break;
      }
      case "fullscreen":
        onFullscreen(command.value);
        send({ kind: "fullscreen", value: command.value });
        break;
      case "open":
        window.open(command.url, "_blank", "noopener,noreferrer");
        break;
      case "size":
        onSize(command.width, command.height);
        break;
      case "title":
        onTitle(command.title);
        break;
      default:
        break;
    }
  };

  return {
    dispose: () => {
      observer.disconnect();

      controller.abort();

      audio.dispose();
    },
    handle,
  };
};
