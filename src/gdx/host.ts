export type GdxCommand =
  | { cursor: string; type: "cursor" }
  | {
      height: number;
      pixels: Uint8ClampedArray;
      type: "customCursor";
      width: number;
      x: number;
      y: number;
    }
  | { height: number; type: "size"; width: number }
  | { text: string; type: "clipboard" }
  | { title: string; type: "title" }
  | ({ type: "audio" } & AudioCommand)
  | { type: "fullscreen"; value: boolean }
  | { type: "open"; url: string };

export type AudioCommand =
  | { data: Uint8Array; id: number; name: string; op: "load"; stream: boolean }
  | {
      id: number;
      instance: number;
      loop: boolean;
      op: "play";
      pan: number;
      pitch: number;
      volume: number;
    }
  | { id: number; instance: number; op: "pause" | "resume" | "stop" }
  | { id: number; instance: number; op: "set"; property: "loop" | "pan" | "pitch" | "volume"; value: number }
  | { id: number; op: "seek"; seconds: number }
  | { id: number; op: "unload" };

export type GdxEventState = {
  clipboard: string;
  completed: number[];
  density: number;
  events: number[];
  fullscreen: boolean;
  height: number;
  positions: Map<number, number>;
  screenHeight: number;
  screenWidth: number;
  width: number;
};

export type DecodedImage = {
  data: Uint8Array;
  height: number;
  width: number;
};

export type GdxHost = {
  canvas?: OffscreenCanvas;
  decodeImage?: (data: Uint8Array) => Promise<DecodedImage | undefined>;
  nextFrame: () => Promise<void>;
  send: (command: GdxCommand) => void;
  state: GdxEventState;
};

export const GDX_EVENT = {
  CLOSE: 8,
  FOCUS: 7,
  KEY_DOWN: 0,
  KEY_TYPED: 2,
  KEY_UP: 1,
  MOUSE_MOVED: 5,
  SCROLLED: 6,
  TOUCH_DOWN: 3,
  TOUCH_UP: 4,
} as const;

export const createEventState = (
  width: number,
  height: number,
  density = 1
): GdxEventState => ({
  clipboard: "",
  completed: [],
  density,
  events: [],
  fullscreen: false,
  height,
  positions: new Map(),
  screenHeight: height,
  screenWidth: width,
  width,
});

export const BACKEND_CLASS = "com/badlogic/gdx/backends/lwjgl3/Lwjgl3Application.class";
