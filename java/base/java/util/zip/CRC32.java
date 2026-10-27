package java.util.zip;

import java.nio.ByteBuffer;

public class CRC32 implements Checksum {
    private int value = 0;

    public CRC32() {
    }

    public void update(int b) {
        value = update0(value, new byte[] {(byte) b}, 0, 1);
    }

    public void update(byte[] b, int off, int len) {
        if (b == null) {
            throw new NullPointerException();
        }
        if (off < 0 || len < 0 || off > b.length - len) {
            throw new ArrayIndexOutOfBoundsException();
        }
        value = update0(value, b, off, len);
    }

    public void update(byte[] b) {
        update(b, 0, b.length);
    }

    public void update(ByteBuffer buffer) {
        byte[] copy = new byte[buffer.remaining()];
        buffer.get(copy);
        update(copy);
    }

    public void reset() {
        value = 0;
    }

    public long getValue() {
        return value & 0xffffffffL;
    }

    private static native int update0(int value, byte[] b, int off, int len);
}
