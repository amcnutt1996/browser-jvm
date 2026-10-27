import { inflateSync } from "fflate";

type ZipEntry = {
  compressedSize: number;
  method: number;
  name: string;
  offset: number;
  size: number;
};

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const STORED = 0;
const DEFLATED = 8;

const decoder = new TextDecoder();

export class ZipArchive {
  public readonly entries = new Map<string, ZipEntry>();

  private readonly data: Uint8Array;

  private readonly view: DataView;

  public constructor(data: Uint8Array) {
    this.data = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);

    let eocd = data.length - 22;

    while (eocd >= 0 && this.view.getUint32(eocd, true) !== EOCD_SIGNATURE) {
      eocd--;
    }

    if (eocd < 0) throw new Error("Not a zip file");

    const count = this.view.getUint16(eocd + 10, true);
    let offset = this.view.getUint32(eocd + 16, true);

    for (let i = 0; i < count; i++) {
      if (this.view.getUint32(offset, true) !== CENTRAL_SIGNATURE) {
        throw new Error("Bad zip central directory");
      }

      const nameLength = this.view.getUint16(offset + 28, true);
      const extraLength = this.view.getUint16(offset + 30, true);
      const commentLength = this.view.getUint16(offset + 32, true);
      const name = decoder.decode(
        data.subarray(offset + 46, offset + 46 + nameLength)
      );

      this.entries.set(name, {
        compressedSize: this.view.getUint32(offset + 20, true),
        method: this.view.getUint16(offset + 10, true),
        name,
        offset: this.view.getUint32(offset + 42, true),
        size: this.view.getUint32(offset + 24, true),
      });
      offset += 46 + nameLength + extraLength + commentLength;
    }
  }

  public has(name: string): boolean {
    return this.entries.has(name);
  }

  public read(name: string): Uint8Array | undefined {
    const entry = this.entries.get(name);

    if (!entry) return undefined;

    const { offset } = entry;

    if (this.view.getUint32(offset, true) !== LOCAL_SIGNATURE) {
      throw new Error(`Bad zip local header for ${name}`);
    }

    const start =
      offset +
      30 +
      this.view.getUint16(offset + 26, true) +
      this.view.getUint16(offset + 28, true);
    const compressed = this.data.subarray(start, start + entry.compressedSize);

    if (entry.method === STORED) return new Uint8Array(compressed);
    if (entry.method === DEFLATED) {
      return inflateSync(compressed, { out: new Uint8Array(entry.size) });
    }

    throw new Error(`Unsupported zip compression method ${entry.method}`);
  }
}
