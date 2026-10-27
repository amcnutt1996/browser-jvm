import {
  remainingBytes,
  remainingView,
  writeFloats,
  writeInts,
} from "./buffers.ts";
import { type JObject } from "../jvm/types.ts";
import { type JVM, type NativeTable } from "../jvm/vm.ts";

const GL = {
  ACTIVE_ATTRIBUTE_MAX_LENGTH: 0x8b8a,
  ACTIVE_UNIFORM_MAX_LENGTH: 0x8b87,
  ARRAY_BUFFER: 0x8892,
  COLOR_ATTACHMENT0: 0x8ce0,
  COLOR_BUFFER_BIT: 0x4000,
  DEPTH_STENCIL_ATTACHMENT: 0x821a,
  DEPTH24_STENCIL8: 0x88f0,
  DRAW_FRAMEBUFFER: 0x8ca9,
  ELEMENT_ARRAY_BUFFER: 0x8893,
  EXTENSIONS: 0x1f03,
  FLOAT: 0x1406,
  FRAMEBUFFER: 0x8d40,
  FRAMEBUFFER_BINDING: 0x8ca6,
  FRAMEBUFFER_COMPLETE: 0x8cd5,
  INFO_LOG_LENGTH: 0x8b84,
  NEAREST: 0x2600,
  READ_FRAMEBUFFER: 0x8ca8,
  RENDERBUFFER: 0x8d41,
  RGBA8: 0x8058,
  SCISSOR_TEST: 0x0c11,
  SHADER_SOURCE_LENGTH: 0x8b88,
  STREAM_DRAW: 0x88e0,
  UNSIGNED_BYTE: 0x1401,
  VERSION: 0x1f02,
} as const;

const SHORT_TYPES = new Set([0x1403, 0x1402, 0x8033, 0x8034, 0x8363, 0x8d61]);

type Handle = WebGLBuffer | WebGLFramebuffer | WebGLProgram | WebGLRenderbuffer | WebGLShader | WebGLTexture;

const pixelView = (type: number, pixels: unknown): ArrayBufferView | null => {
  if (!pixels) return null;

  if (type === GL.FLOAT) return remainingView(pixels as JObject, Float32Array, 4);

  if (SHORT_TYPES.has(type)) return remainingView(pixels as JObject, Uint16Array, 2);

  return remainingBytes(pixels as JObject);
};

const createMockGl = (): WebGL2RenderingContext => {
  const values: Record<number, unknown> = {
    0x0d33: 4096,
    0x84e8: 4096,
    0x8869: 16,
    0x8872: 16,
    0x8b8c: "WebGL GLSL ES 3.00",
    0x1f00: "Java Runner",
    0x1f01: "Mock WebGL",
    [GL.VERSION]: "WebGL 2.0",
  };

  return new Proxy({} as WebGL2RenderingContext, {
    get: (_target, property: string) => {
      if (property.startsWith("create")) return () => ({});
      if (property === "getParameter") return (name: number) => values[name] ?? 0;
      if (property === "getShaderParameter" || property === "getProgramParameter") {
        return (_object: unknown, name: number) => (name === 0x8b89 || name === 0x8b86 ? 0 : true);
      }
      if (property === "checkFramebufferStatus") return () => GL.FRAMEBUFFER_COMPLETE;
      if (property === "getSupportedExtensions") return () => [];
      if (property === "getUniformLocation") return () => ({});
      if (property === "getAttribLocation") return () => 0;
      if (property === "getShaderPrecisionFormat") return () => ({ precision: 23, rangeMax: 127, rangeMin: 127 });
      if (property.endsWith("InfoLog")) return () => "";
      if (property === "getError") return () => 0;
      if (property.startsWith("is")) return () => true;

      return () => null;
    },
  });
};

export type GlBridge = {
  natives: (vm: JVM) => NativeTable;
  present: () => void;
};

export const createGl = (canvas?: OffscreenCanvas): GlBridge => {
  const gl =
    (canvas?.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      stencil: false,
    }) as null | WebGL2RenderingContext) ?? createMockGl();
  const handles: (Handle | null)[] = [null];
  const ids = new WeakMap<Handle, number>();
  const locations: (null | WebGLUniformLocation)[] = [];
  const locationIds = new Map<WebGLProgram, Map<string, number>>();
  const attribScratch: WebGLBuffer[] = [];
  let elementScratch: null | WebGLBuffer = null;
  let arrayBinding: null | WebGLBuffer = null;
  let elementBinding: null | WebGLBuffer = null;
  let framebufferBinding: null | WebGLFramebuffer = null;
  let defaultFramebuffer: null | WebGLFramebuffer = null;
  let defaultColor: null | WebGLRenderbuffer = null;
  let defaultDepth: null | WebGLRenderbuffer = null;
  let defaultWidth = 0;
  let defaultHeight = 0;

  const register = (object: Handle | null): number => {
    if (!object) return 0;

    const existing = ids.get(object);

    if (existing) return existing;

    handles.push(object);
    ids.set(object, handles.length - 1);

    return handles.length - 1;
  };
  const lookup = (id: unknown): Handle | null => handles[id as number] ?? null;
  const release = (id: unknown): Handle | null => {
    const object = handles[id as number] ?? null;

    if ((id as number) > 0) handles[id as number] = null;

    return object;
  };
  const idOf = (value: unknown): number =>
    value && typeof value === "object" ? (ids.get(value) ?? 0) : 0;

  const ensureDefaultFramebuffer = (): null | WebGLFramebuffer => {
    if (!canvas) return null;

    if (defaultFramebuffer && defaultWidth === canvas.width && defaultHeight === canvas.height) {
      return defaultFramebuffer;
    }

    defaultWidth = canvas.width;
    defaultHeight = canvas.height;
    defaultFramebuffer ??= gl.createFramebuffer();
    defaultColor ??= gl.createRenderbuffer();
    defaultDepth ??= gl.createRenderbuffer();

    const renderbuffer = gl.getParameter(0x8ca7) as null | WebGLRenderbuffer;

    gl.bindRenderbuffer(GL.RENDERBUFFER, defaultColor);
    gl.renderbufferStorage(GL.RENDERBUFFER, GL.RGBA8, defaultWidth, defaultHeight);
    gl.bindRenderbuffer(GL.RENDERBUFFER, defaultDepth);
    gl.renderbufferStorage(GL.RENDERBUFFER, GL.DEPTH24_STENCIL8, defaultWidth, defaultHeight);
    gl.bindRenderbuffer(GL.RENDERBUFFER, renderbuffer);
    gl.bindFramebuffer(GL.FRAMEBUFFER, defaultFramebuffer);
    gl.framebufferRenderbuffer(GL.FRAMEBUFFER, GL.COLOR_ATTACHMENT0, GL.RENDERBUFFER, defaultColor);
    gl.framebufferRenderbuffer(GL.FRAMEBUFFER, GL.DEPTH_STENCIL_ATTACHMENT, GL.RENDERBUFFER, defaultDepth);
    gl.bindFramebuffer(GL.FRAMEBUFFER, framebufferBinding ?? defaultFramebuffer);

    return defaultFramebuffer;
  };

  const present = (): void => {
    if (!canvas || !defaultFramebuffer) return;

    const scissor = gl.isEnabled(GL.SCISSOR_TEST);

    if (scissor) gl.disable(GL.SCISSOR_TEST);

    gl.bindFramebuffer(GL.READ_FRAMEBUFFER, defaultFramebuffer);
    gl.bindFramebuffer(GL.DRAW_FRAMEBUFFER, null);
    gl.blitFramebuffer(0, 0, defaultWidth, defaultHeight, 0, 0, canvas.width, canvas.height, GL.COLOR_BUFFER_BIT, GL.NEAREST);

    if (scissor) gl.enable(GL.SCISSOR_TEST);

    gl.bindFramebuffer(GL.FRAMEBUFFER, framebufferBinding ?? ensureDefaultFramebuffer());
  };


  const parameter = (name: number): unknown => {
    if (name === GL.FRAMEBUFFER_BINDING) return framebufferBinding ? idOf(framebufferBinding) : 0;

    if (name === 0x8894) return idOf(arrayBinding);

    if (name === 0x8895) return idOf(elementBinding);

    return gl.getParameter(name);
  };

  const numbers = (value: unknown): number[] => {
    if (value === null || value === undefined) return [0];

    if (typeof value === "boolean") return [value ? 1 : 0];

    if (typeof value === "number") return [value];

    if (ArrayBuffer.isView(value)) return Array.from(value as unknown as ArrayLike<number>, Number);

    if (Array.isArray(value)) return value.map(Number);

    return [idOf(value)];
  };

  const shaderParameter = (shader: null | WebGLShader, name: number): number => {
    if (name === GL.INFO_LOG_LENGTH) return (gl.getShaderInfoLog(shader as WebGLShader) ?? "").length + 1;

    if (name === GL.SHADER_SOURCE_LENGTH) return (gl.getShaderSource(shader as WebGLShader) ?? "").length + 1;

    return numbers(gl.getShaderParameter(shader as WebGLShader, name))[0];
  };

  const programParameter = (program: null | WebGLProgram, name: number): number => {
    if (name === GL.INFO_LOG_LENGTH) return (gl.getProgramInfoLog(program as WebGLProgram) ?? "").length + 1;

    if (name === GL.ACTIVE_ATTRIBUTE_MAX_LENGTH || name === GL.ACTIVE_UNIFORM_MAX_LENGTH) return 256;

    return numbers(gl.getProgramParameter(program as WebGLProgram, name))[0];
  };

  const uniform = (id: unknown): null | WebGLUniformLocation => locations[id as number] ?? null;

  const genMany = (count: unknown, buffer: unknown, create: () => Handle | null): void => {
    const created: number[] = [];

    for (let i = 0; i < (count as number); i++) created.push(register(create()));

    writeInts(buffer as JObject, created);
  };

  const deleteMany = (count: unknown, buffer: unknown, remove: (object: Handle | null) => void): void => {
    const view = remainingView(buffer as JObject, Int32Array, 4);

    for (let i = 0; i < (count as number); i++) remove(release(view[i]));
  };

  const P = "com/badlogic/gdx/backends/lwjgl3/WebGL20.";
  const B = "Ljava/nio/Buffer;";
  const IB = "Ljava/nio/IntBuffer;";
  const FB = "Ljava/nio/FloatBuffer;";
  const S = "Ljava/lang/String;";

  const natives = (): NativeTable => {
    const table: NativeTable = {
      [`${P}glActiveTexture(I)V`]: (_t, [, unit]) => gl.activeTexture(unit as number),
      [`${P}glAttachShader(II)V`]: (_t, [, program, shader]) =>
        gl.attachShader(lookup(program) as WebGLProgram, lookup(shader) as WebGLShader),
      [`${P}glBindAttribLocation(II${S})V`]: (_t, [, program, index, name]) =>
        gl.bindAttribLocation(lookup(program) as WebGLProgram, index as number, name as string),
      [`${P}glBindBuffer(II)V`]: (_t, [, target, buffer]) => {
        const object = lookup(buffer);

        if (target === GL.ARRAY_BUFFER) arrayBinding = object;
        else if (target === GL.ELEMENT_ARRAY_BUFFER) elementBinding = object;

        gl.bindBuffer(target as number, object);
      },
      [`${P}glBindFramebuffer(II)V`]: (_t, [, target, framebuffer]) => {
        framebufferBinding = lookup(framebuffer);
        gl.bindFramebuffer(target as number, framebufferBinding ?? ensureDefaultFramebuffer());
      },
      [`${P}glBindRenderbuffer(II)V`]: (_t, [, target, renderbuffer]) =>
        gl.bindRenderbuffer(target as number, lookup(renderbuffer)),
      [`${P}glBindTexture(II)V`]: (_t, [, target, texture]) => gl.bindTexture(target as number, lookup(texture)),
      [`${P}glBlendColor(FFFF)V`]: (_t, [, r, g, b, a]) =>
        gl.blendColor(r as number, g as number, b as number, a as number),
      [`${P}glBlendEquation(I)V`]: (_t, [, mode]) => gl.blendEquation(mode as number),
      [`${P}glBlendEquationSeparate(II)V`]: (_t, [, rgb, alpha]) => gl.blendEquationSeparate(rgb as number, alpha as number),
      [`${P}glBlendFunc(II)V`]: (_t, [, src, dst]) => gl.blendFunc(src as number, dst as number),
      [`${P}glBlendFuncSeparate(IIII)V`]: (_t, [, srcRgb, dstRgb, srcAlpha, dstAlpha]) =>
        gl.blendFuncSeparate(srcRgb as number, dstRgb as number, srcAlpha as number, dstAlpha as number),
      [`${P}glBufferData(II${B}I)V`]: (_t, [, target, size, data, usage]) => {
        if (data) {
          gl.bufferData(target as number, remainingBytes(data as JObject).subarray(0, size as number), usage as number);
        } else {
          gl.bufferData(target as number, size as number, usage as number);
        }
      },
      [`${P}glBufferSubData(III${B})V`]: (_t, [, target, offset, size, data]) =>
        gl.bufferSubData(target as number, offset as number, remainingBytes(data as JObject).subarray(0, size as number)),
      [`${P}glCheckFramebufferStatus(I)I`]: (_t, [, target]) => gl.checkFramebufferStatus(target as number),
      [`${P}glClear(I)V`]: (_t, [, mask]) => gl.clear(mask as number),
      [`${P}glClearColor(FFFF)V`]: (_t, [, r, g, b, a]) => gl.clearColor(r as number, g as number, b as number, a as number),
      [`${P}glClearDepthf(F)V`]: (_t, [, depth]) => gl.clearDepth(depth as number),
      [`${P}glClearStencil(I)V`]: (_t, [, stencil]) => gl.clearStencil(stencil as number),
      [`${P}glColorMask(ZZZZ)V`]: (_t, [, r, g, b, a]) => gl.colorMask(Boolean(r), Boolean(g), Boolean(b), Boolean(a)),
      [`${P}glCompileShader(I)V`]: (_t, [, shader]) => gl.compileShader(lookup(shader) as WebGLShader),
      [`${P}glCompressedTexImage2D(IIIIIII${B})V`]: (_t, [, target, level, format, width, height, border, , data]) =>
        gl.compressedTexImage2D(target as number, level as number, format as number, width as number, height as number, border as number, remainingBytes(data as JObject)),
      [`${P}glCompressedTexSubImage2D(IIIIIIII${B})V`]: (_t, [, target, level, x, y, width, height, format, , data]) =>
        gl.compressedTexSubImage2D(target as number, level as number, x as number, y as number, width as number, height as number, format as number, remainingBytes(data as JObject)),
      [`${P}glCopyTexImage2D(IIIIIIII)V`]: (_t, args) =>
        gl.copyTexImage2D(...(args.slice(1) as [number, number, number, number, number, number, number, number])),
      [`${P}glCopyTexSubImage2D(IIIIIIII)V`]: (_t, args) =>
        gl.copyTexSubImage2D(...(args.slice(1) as [number, number, number, number, number, number, number, number])),
      [`${P}glCreateProgram()I`]: () => register(gl.createProgram()),
      [`${P}glCreateShader(I)I`]: (_t, [, type]) => register(gl.createShader(type as number)),
      [`${P}glCullFace(I)V`]: (_t, [, mode]) => gl.cullFace(mode as number),
      [`${P}glDeleteBuffer(I)V`]: (_t, [, buffer]) => gl.deleteBuffer(release(buffer)),
      [`${P}glDeleteBuffers(I${IB})V`]: (_t, [, count, buffer]) => deleteMany(count, buffer, (object) => gl.deleteBuffer(object)),
      [`${P}glDeleteFramebuffer(I)V`]: (_t, [, framebuffer]) => gl.deleteFramebuffer(release(framebuffer)),
      [`${P}glDeleteFramebuffers(I${IB})V`]: (_t, [, count, buffer]) =>
        deleteMany(count, buffer, (object) => gl.deleteFramebuffer(object)),
      [`${P}glDeleteProgram(I)V`]: (_t, [, program]) => {
        const object = release(program);

        if (object) locationIds.delete(object);

        gl.deleteProgram(object);
      },
      [`${P}glDeleteRenderbuffer(I)V`]: (_t, [, renderbuffer]) => gl.deleteRenderbuffer(release(renderbuffer)),
      [`${P}glDeleteRenderbuffers(I${IB})V`]: (_t, [, count, buffer]) =>
        deleteMany(count, buffer, (object) => gl.deleteRenderbuffer(object)),
      [`${P}glDeleteShader(I)V`]: (_t, [, shader]) => gl.deleteShader(release(shader)),
      [`${P}glDeleteTexture(I)V`]: (_t, [, texture]) => gl.deleteTexture(release(texture)),
      [`${P}glDeleteTextures(I${IB})V`]: (_t, [, count, buffer]) =>
        deleteMany(count, buffer, (object) => gl.deleteTexture(object)),
      [`${P}glDepthFunc(I)V`]: (_t, [, func]) => gl.depthFunc(func as number),
      [`${P}glDepthMask(Z)V`]: (_t, [, flag]) => gl.depthMask(Boolean(flag)),
      [`${P}glDepthRangef(FF)V`]: (_t, [, near, far]) => gl.depthRange(near as number, far as number),
      [`${P}glDetachShader(II)V`]: (_t, [, program, shader]) =>
        gl.detachShader(lookup(program) as WebGLProgram, lookup(shader) as WebGLShader),
      [`${P}glDisable(I)V`]: (_t, [, cap]) => gl.disable(cap as number),
      [`${P}glDisableVertexAttribArray(I)V`]: (_t, [, index]) => gl.disableVertexAttribArray(index as number),
      [`${P}glDrawArrays(III)V`]: (_t, [, mode, first, count]) => gl.drawArrays(mode as number, first as number, count as number),
      [`${P}glDrawElements(III${B})V`]: (_t, [, mode, count, type, indices]) => {
        elementScratch ??= gl.createBuffer();
        gl.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, elementScratch);
        gl.bufferData(GL.ELEMENT_ARRAY_BUFFER, remainingBytes(indices as JObject), GL.STREAM_DRAW);
        gl.drawElements(mode as number, count as number, type as number, 0);
        gl.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, elementBinding);
      },
      [`${P}glDrawElements(IIII)V`]: (_t, [, mode, count, type, offset]) =>
        gl.drawElements(mode as number, count as number, type as number, offset as number),
      [`${P}glEnable(I)V`]: (_t, [, cap]) => gl.enable(cap as number),
      [`${P}glEnableVertexAttribArray(I)V`]: (_t, [, index]) => gl.enableVertexAttribArray(index as number),
      [`${P}glFinish()V`]: () => gl.finish(),
      [`${P}glFlush()V`]: () => gl.flush(),
      [`${P}glFramebufferRenderbuffer(IIII)V`]: (_t, [, target, attachment, renderbufferTarget, renderbuffer]) =>
        gl.framebufferRenderbuffer(target as number, attachment as number, renderbufferTarget as number, lookup(renderbuffer)),
      [`${P}glFramebufferTexture2D(IIIII)V`]: (_t, [, target, attachment, textureTarget, texture, level]) =>
        gl.framebufferTexture2D(target as number, attachment as number, textureTarget as number, lookup(texture), level as number),
      [`${P}glFrontFace(I)V`]: (_t, [, mode]) => gl.frontFace(mode as number),
      [`${P}glGenBuffer()I`]: () => register(gl.createBuffer()),
      [`${P}glGenBuffers(I${IB})V`]: (_t, [, count, buffer]) => genMany(count, buffer, () => gl.createBuffer()),
      [`${P}glGenerateMipmap(I)V`]: (_t, [, target]) => gl.generateMipmap(target as number),
      [`${P}glGenFramebuffer()I`]: () => register(gl.createFramebuffer()),
      [`${P}glGenFramebuffers(I${IB})V`]: (_t, [, count, buffer]) => genMany(count, buffer, () => gl.createFramebuffer()),
      [`${P}glGenRenderbuffer()I`]: () => register(gl.createRenderbuffer()),
      [`${P}glGenRenderbuffers(I${IB})V`]: (_t, [, count, buffer]) => genMany(count, buffer, () => gl.createRenderbuffer()),
      [`${P}glGenTexture()I`]: () => register(gl.createTexture()),
      [`${P}glGenTextures(I${IB})V`]: (_t, [, count, buffer]) => genMany(count, buffer, () => gl.createTexture()),
      [`${P}glGetActiveAttrib(II${IB}${IB})${S}`]: (_t, [, program, index, size, type]) => {
        const info = gl.getActiveAttrib(lookup(program) as WebGLProgram, index as number);

        writeInts(size as JObject, [info?.size ?? 0]);
        writeInts(type as JObject, [info?.type ?? 0]);

        return info?.name ?? "";
      },
      [`${P}glGetActiveUniform(II${IB}${IB})${S}`]: (_t, [, program, index, size, type]) => {
        const info = gl.getActiveUniform(lookup(program) as WebGLProgram, index as number);

        writeInts(size as JObject, [info?.size ?? 0]);
        writeInts(type as JObject, [info?.type ?? 0]);

        return info?.name ?? "";
      },
      [`${P}glGetAttachedShaders(II${B}${IB})V`]: (_t, [, program, , count, shaders]) => {
        const attached = (gl.getAttachedShaders(lookup(program) as WebGLProgram) ?? []).map(idOf);

        if (count) writeInts(count as JObject, [attached.length]);

        writeInts(shaders as JObject, attached);
      },
      [`${P}glGetAttribLocation(I${S})I`]: (_t, [, program, name]) =>
        gl.getAttribLocation(lookup(program) as WebGLProgram, name as string),
      [`${P}glGetBooleanv(I${B})V`]: (_t, [, name, buffer]) => {
        const bytes = remainingBytes(buffer as JObject);

        numbers(parameter(name as number)).forEach((value, index) => {
          if (index < bytes.length) bytes[index] = value ? 1 : 0;
        });
      },
      [`${P}glGetBufferParameteriv(II${IB})V`]: (_t, [, target, name, buffer]) =>
        writeInts(buffer as JObject, numbers(gl.getBufferParameter(target as number, name as number))),
      [`${P}glGetError()I`]: () => gl.getError(),
      [`${P}glGetFloatv(I${FB})V`]: (_t, [, name, buffer]) => writeFloats(buffer as JObject, numbers(parameter(name as number))),
      [`${P}glGetFramebufferAttachmentParameteriv(III${IB})V`]: (_t, [, target, attachment, name, buffer]) =>
        writeInts(buffer as JObject, numbers(gl.getFramebufferAttachmentParameter(target as number, attachment as number, name as number))),
      [`${P}glGetIntegerv(I${IB})V`]: (_t, [, name, buffer]) => writeInts(buffer as JObject, numbers(parameter(name as number))),
      [`${P}glGetProgramInfoLog(I)${S}`]: (_t, [, program]) => gl.getProgramInfoLog(lookup(program) as WebGLProgram) ?? "",
      [`${P}glGetProgramiv(II${IB})V`]: (_t, [, program, name, buffer]) =>
        writeInts(buffer as JObject, [programParameter(lookup(program), name as number)]),
      [`${P}glGetRenderbufferParameteriv(II${IB})V`]: (_t, [, target, name, buffer]) =>
        writeInts(buffer as JObject, numbers(gl.getRenderbufferParameter(target as number, name as number))),
      [`${P}glGetShaderInfoLog(I)${S}`]: (_t, [, shader]) => gl.getShaderInfoLog(lookup(shader) as WebGLShader) ?? "",
      [`${P}glGetShaderiv(II${IB})V`]: (_t, [, shader, name, buffer]) =>
        writeInts(buffer as JObject, [shaderParameter(lookup(shader), name as number)]),
      [`${P}glGetShaderPrecisionFormat(II${IB}${IB})V`]: (_t, [, shaderType, precisionType, range, precision]) => {
        const format = gl.getShaderPrecisionFormat(shaderType as number, precisionType as number);

        writeInts(range as JObject, [format?.rangeMin ?? 0, format?.rangeMax ?? 0]);
        writeInts(precision as JObject, [format?.precision ?? 0]);
      },
      [`${P}glGetString(I)${S}`]: (_t, [, name]) => {
        if (name === GL.EXTENSIONS) return (gl.getSupportedExtensions() ?? []).join(" ");

        if (name === GL.VERSION) return `2.0 ${String(gl.getParameter(GL.VERSION))}`;

        const value = gl.getParameter(name as number) as boolean | null | number | string;

        return value === null ? null : String(value);
      },
      [`${P}glGetTexParameterfv(II${FB})V`]: (_t, [, target, name, buffer]) =>
        writeFloats(buffer as JObject, numbers(gl.getTexParameter(target as number, name as number))),
      [`${P}glGetTexParameteriv(II${IB})V`]: (_t, [, target, name, buffer]) =>
        writeInts(buffer as JObject, numbers(gl.getTexParameter(target as number, name as number))),
      [`${P}glGetUniformfv(II${FB})V`]: (_t, [, program, location, buffer]) =>
        writeFloats(buffer as JObject, numbers(gl.getUniform(lookup(program) as WebGLProgram, uniform(location) as WebGLUniformLocation))),
      [`${P}glGetUniformiv(II${IB})V`]: (_t, [, program, location, buffer]) =>
        writeInts(buffer as JObject, numbers(gl.getUniform(lookup(program) as WebGLProgram, uniform(location) as WebGLUniformLocation))),
      [`${P}glGetUniformLocation(I${S})I`]: (_t, [, program, name]) => {
        const object = lookup(program);

        if (!object) return -1;

        let names = locationIds.get(object);

        if (!names) {
          names = new Map();
          locationIds.set(object, names);
        }

        const existing = names.get(name as string);

        if (existing !== undefined) return existing;

        const location = gl.getUniformLocation(object, name as string);
        const id = location ? locations.push(location) - 1 : -1;

        names.set(name as string, id);

        return id;
      },
      [`${P}glGetVertexAttribfv(II${FB})V`]: (_t, [, index, name, buffer]) =>
        writeFloats(buffer as JObject, numbers(gl.getVertexAttrib(index as number, name as number))),
      [`${P}glGetVertexAttribiv(II${IB})V`]: (_t, [, index, name, buffer]) =>
        writeInts(buffer as JObject, numbers(gl.getVertexAttrib(index as number, name as number))),
      [`${P}glGetVertexAttribPointerv(II${B})V`]: () => null,
      [`${P}glHint(II)V`]: (_t, [, target, mode]) => gl.hint(target as number, mode as number),
      [`${P}glIsBuffer(I)Z`]: (_t, [, id]) => (gl.isBuffer(lookup(id)) ? 1 : 0),
      [`${P}glIsEnabled(I)Z`]: (_t, [, cap]) => (gl.isEnabled(cap as number) ? 1 : 0),
      [`${P}glIsFramebuffer(I)Z`]: (_t, [, id]) => (gl.isFramebuffer(lookup(id)) ? 1 : 0),
      [`${P}glIsProgram(I)Z`]: (_t, [, id]) => (gl.isProgram(lookup(id)) ? 1 : 0),
      [`${P}glIsRenderbuffer(I)Z`]: (_t, [, id]) => (gl.isRenderbuffer(lookup(id)) ? 1 : 0),
      [`${P}glIsShader(I)Z`]: (_t, [, id]) => (gl.isShader(lookup(id)) ? 1 : 0),
      [`${P}glIsTexture(I)Z`]: (_t, [, id]) => (gl.isTexture(lookup(id)) ? 1 : 0),
      [`${P}glLineWidth(F)V`]: (_t, [, width]) => gl.lineWidth(width as number),
      [`${P}glLinkProgram(I)V`]: (_t, [, program]) => gl.linkProgram(lookup(program) as WebGLProgram),
      [`${P}glPixelStorei(II)V`]: (_t, [, name, value]) => gl.pixelStorei(name as number, value as number),
      [`${P}glPolygonOffset(FF)V`]: (_t, [, factor, units]) => gl.polygonOffset(factor as number, units as number),
      [`${P}glReadPixels(IIIIII${B})V`]: (_t, [, x, y, width, height, format, type, pixels]) =>
        gl.readPixels(x as number, y as number, width as number, height as number, format as number, type as number, pixelView(type as number, pixels)),
      [`${P}glReleaseShaderCompiler()V`]: () => null,
      [`${P}glRenderbufferStorage(IIII)V`]: (_t, [, target, format, width, height]) =>
        gl.renderbufferStorage(target as number, format as number, width as number, height as number),
      [`${P}glSampleCoverage(FZ)V`]: (_t, [, value, invert]) => gl.sampleCoverage(value as number, Boolean(invert)),
      [`${P}glScissor(IIII)V`]: (_t, [, x, y, width, height]) => gl.scissor(x as number, y as number, width as number, height as number),
      [`${P}glShaderBinary(I${IB}I${B}I)V`]: () => null,
      [`${P}glShaderSource(I${S})V`]: (_t, [, shader, source]) => gl.shaderSource(lookup(shader) as WebGLShader, source as string),
      [`${P}glStencilFunc(III)V`]: (_t, [, func, ref, mask]) => gl.stencilFunc(func as number, ref as number, mask as number),
      [`${P}glStencilFuncSeparate(IIII)V`]: (_t, [, face, func, ref, mask]) =>
        gl.stencilFuncSeparate(face as number, func as number, ref as number, mask as number),
      [`${P}glStencilMask(I)V`]: (_t, [, mask]) => gl.stencilMask(mask as number),
      [`${P}glStencilMaskSeparate(II)V`]: (_t, [, face, mask]) => gl.stencilMaskSeparate(face as number, mask as number),
      [`${P}glStencilOp(III)V`]: (_t, [, fail, zfail, zpass]) => gl.stencilOp(fail as number, zfail as number, zpass as number),
      [`${P}glStencilOpSeparate(IIII)V`]: (_t, [, face, fail, zfail, zpass]) =>
        gl.stencilOpSeparate(face as number, fail as number, zfail as number, zpass as number),
      [`${P}glTexImage2D(IIIIIIII${B})V`]: (_t, [, target, level, internalFormat, width, height, border, format, type, pixels]) =>
        gl.texImage2D(target as number, level as number, internalFormat as number, width as number, height as number, border as number, format as number, type as number, pixelView(type as number, pixels)),
      [`${P}glTexParameterf(IIF)V`]: (_t, [, target, name, value]) => gl.texParameterf(target as number, name as number, value as number),
      [`${P}glTexParameterfv(II${FB})V`]: (_t, [, target, name, buffer]) =>
        gl.texParameterf(target as number, name as number, remainingView(buffer as JObject, Float32Array, 4)[0]),
      [`${P}glTexParameteri(III)V`]: (_t, [, target, name, value]) => gl.texParameteri(target as number, name as number, value as number),
      [`${P}glTexParameteriv(II${IB})V`]: (_t, [, target, name, buffer]) =>
        gl.texParameteri(target as number, name as number, remainingView(buffer as JObject, Int32Array, 4)[0]),
      [`${P}glTexSubImage2D(IIIIIIII${B})V`]: (_t, [, target, level, x, y, width, height, format, type, pixels]) =>
        gl.texSubImage2D(target as number, level as number, x as number, y as number, width as number, height as number, format as number, type as number, pixelView(type as number, pixels)),
      [`${P}glUniform1f(IF)V`]: (_t, [, location, x]) => gl.uniform1f(uniform(location), x as number),
      [`${P}glUniform1i(II)V`]: (_t, [, location, x]) => gl.uniform1i(uniform(location), x as number),
      [`${P}glUniform2f(IFF)V`]: (_t, [, location, x, y]) => gl.uniform2f(uniform(location), x as number, y as number),
      [`${P}glUniform2i(III)V`]: (_t, [, location, x, y]) => gl.uniform2i(uniform(location), x as number, y as number),
      [`${P}glUniform3f(IFFF)V`]: (_t, [, location, x, y, z]) => gl.uniform3f(uniform(location), x as number, y as number, z as number),
      [`${P}glUniform3i(IIII)V`]: (_t, [, location, x, y, z]) => gl.uniform3i(uniform(location), x as number, y as number, z as number),
      [`${P}glUniform4f(IFFFF)V`]: (_t, [, location, x, y, z, w]) =>
        gl.uniform4f(uniform(location), x as number, y as number, z as number, w as number),
      [`${P}glUniform4i(IIIII)V`]: (_t, [, location, x, y, z, w]) =>
        gl.uniform4i(uniform(location), x as number, y as number, z as number, w as number),
      [`${P}glUseProgram(I)V`]: (_t, [, program]) => gl.useProgram(lookup(program)),
      [`${P}glValidateProgram(I)V`]: (_t, [, program]) => gl.validateProgram(lookup(program) as WebGLProgram),
      [`${P}glVertexAttrib1f(IF)V`]: (_t, [, index, x]) => gl.vertexAttrib1f(index as number, x as number),
      [`${P}glVertexAttrib2f(IFF)V`]: (_t, [, index, x, y]) => gl.vertexAttrib2f(index as number, x as number, y as number),
      [`${P}glVertexAttrib3f(IFFF)V`]: (_t, [, index, x, y, z]) => gl.vertexAttrib3f(index as number, x as number, y as number, z as number),
      [`${P}glVertexAttrib4f(IFFFF)V`]: (_t, [, index, x, y, z, w]) =>
        gl.vertexAttrib4f(index as number, x as number, y as number, z as number, w as number),
      [`${P}glVertexAttribPointer(IIIZI${B})V`]: (_t, [, index, size, type, normalized, stride, data]) => {
        attribScratch[index as number] ??= gl.createBuffer();
        gl.bindBuffer(GL.ARRAY_BUFFER, attribScratch[index as number]);
        gl.bufferData(GL.ARRAY_BUFFER, remainingBytes(data as JObject), GL.STREAM_DRAW);
        gl.vertexAttribPointer(index as number, size as number, type as number, Boolean(normalized), stride as number, 0);
        gl.bindBuffer(GL.ARRAY_BUFFER, arrayBinding);
      },
      [`${P}glVertexAttribPointer(IIIZII)V`]: (_t, [, index, size, type, normalized, stride, offset]) =>
        gl.vertexAttribPointer(index as number, size as number, type as number, Boolean(normalized), stride as number, offset as number),
      [`${P}glViewport(IIII)V`]: (_t, [, x, y, width, height]) => gl.viewport(x as number, y as number, width as number, height as number),
    };

    for (const [count, name] of [[1, "1"], [2, "2"], [3, "3"], [4, "4"]] as const) {
      const floatSetter = `uniform${name}fv` as "uniform1fv";
      const intSetter = `uniform${name}iv` as "uniform1iv";
      const attribSetter = `vertexAttrib${name}fv` as "vertexAttrib1fv";

      table[`${P}glUniform${name}fv(II${FB})V`] = (_t, [, location, length, buffer]) =>
        gl[floatSetter](uniform(location), remainingView(buffer as JObject, Float32Array, 4), 0, (length as number) * count);
      table[`${P}glUniform${name}fv(II[FI)V`] = (_t, [, location, length, values, offset]) =>
        gl[floatSetter](uniform(location), values as Float32Array, offset as number, (length as number) * count);
      table[`${P}glUniform${name}iv(II${IB})V`] = (_t, [, location, length, buffer]) =>
        gl[intSetter](uniform(location), remainingView(buffer as JObject, Int32Array, 4), 0, (length as number) * count);
      table[`${P}glUniform${name}iv(II[II)V`] = (_t, [, location, length, values, offset]) =>
        gl[intSetter](uniform(location), values as Int32Array, offset as number, (length as number) * count);
      table[`${P}glVertexAttrib${name}fv(I${FB})V`] = (_t, [, index, buffer]) =>
        gl[attribSetter](index as number, remainingView(buffer as JObject, Float32Array, 4));
    }

    for (const size of [2, 3, 4] as const) {
      const setter = `uniformMatrix${size}fv` as "uniformMatrix4fv";
      const elements = size * size;

      table[`${P}glUniformMatrix${size}fv(IIZ${FB})V`] = (_t, [, location, length, transpose, buffer]) =>
        gl[setter](uniform(location), Boolean(transpose), remainingView(buffer as JObject, Float32Array, 4), 0, (length as number) * elements);
      table[`${P}glUniformMatrix${size}fv(IIZ[FI)V`] = (_t, [, location, length, transpose, values, offset]) =>
        gl[setter](uniform(location), Boolean(transpose), values as Float32Array, offset as number, (length as number) * elements);
    }

    return table;
  };

  ensureDefaultFramebuffer();
  framebufferBinding = null;

  return {
    natives,
    present,
  };
};

