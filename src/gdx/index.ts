import { backendNatives } from "./backend.ts";
import { bufferNatives } from "./buffers.ts";
import { freeTypeNatives } from "./freetype.ts";
import { createGl } from "./gl.ts";
import { BACKEND_CLASS, type GdxHost } from "./host.ts";
import { pixmapNatives } from "./pixmap.ts";
import { type JVM, type NativeTable } from "../jvm/vm.ts";
import { ZipArchive } from "../jvm/zip.ts";

export const usesGdx = (jar: Uint8Array): boolean => {
  try {
    return new ZipArchive(jar).entries.has(BACKEND_CLASS);
  } catch {
    return false;
  }
};

export const gdxNatives = (host: GdxHost): ((vm: JVM) => NativeTable)[] => {
  const gl = createGl(host.canvas);
  const presenting: GdxHost = {
    ...host,
    nextFrame: () => {
      gl.present();

      return host.nextFrame();
    },
  };

  return [backendNatives(presenting), gl.natives, bufferNatives, pixmapNatives(host), freeTypeNatives];
};
