package java.io;

import java.nio.ByteBuffer;
import java.nio.MappedByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.channels.NonWritableChannelException;

public class RandomAccessFile implements DataOutput, DataInput, Closeable {
    private final String path;
    private final boolean writable;
    private final FileDescriptor fd = new FileDescriptor();
    private byte[] data;
    private int length;
    private long pointer;
    private boolean dirty;
    private boolean closed;
    private FileChannel channel;

    public RandomAccessFile(String name, String mode) throws FileNotFoundException {
        this(name != null ? new File(name) : null, mode);
    }

    public RandomAccessFile(File file, String mode) throws FileNotFoundException {
        if (file == null) {
            throw new NullPointerException();
        }
        if (!mode.equals("r") && !mode.equals("rw") && !mode.equals("rws") && !mode.equals("rwd")) {
            throw new IllegalArgumentException("Illegal mode \"" + mode + "\" must be one of \"r\", \"rw\", \"rws\", or \"rwd\"");
        }
        this.path = file.getPath();
        this.writable = !mode.equals("r");
        try {
            if (writable && !file.exists()) {
                new FileOutputStream(file).close();
            }
        } catch (FileNotFoundException e) {
            throw e;
        } catch (IOException e) {
            throw new FileNotFoundException(path + " (" + e.getMessage() + ")");
        }
        try (FileInputStream in = new FileInputStream(file)) {
            data = in.readAllBytes();
        } catch (FileNotFoundException e) {
            throw e;
        } catch (IOException e) {
            throw new FileNotFoundException(path + " (" + e.getMessage() + ")");
        }
        length = data.length;
    }

    public final FileDescriptor getFD() throws IOException {
        return fd;
    }

    public final FileChannel getChannel() {
        synchronized (this) {
            if (channel == null) {
                channel = new Channel();
            }
            return channel;
        }
    }

    private void ensureOpen() throws IOException {
        if (closed) {
            throw new IOException("Stream Closed");
        }
    }

    private void ensureCapacity(long size) {
        if (size > data.length) {
            byte[] grown = new byte[(int) Math.max(size, data.length * 2L + 16)];
            System.arraycopy(data, 0, grown, 0, length);
            data = grown;
        }
    }

    public int read() throws IOException {
        ensureOpen();
        if (pointer >= length) {
            return -1;
        }
        return data[(int) pointer++] & 0xff;
    }

    public int read(byte[] b, int off, int len) throws IOException {
        ensureOpen();
        if (len == 0) {
            return 0;
        }
        if (pointer >= length) {
            return -1;
        }
        int count = (int) Math.min(len, length - pointer);
        System.arraycopy(data, (int) pointer, b, off, count);
        pointer += count;
        return count;
    }

    public int read(byte[] b) throws IOException {
        return read(b, 0, b.length);
    }

    public final void readFully(byte[] b) throws IOException {
        readFully(b, 0, b.length);
    }

    public final void readFully(byte[] b, int off, int len) throws IOException {
        int n = 0;
        while (n < len) {
            int count = read(b, off + n, len - n);
            if (count < 0) {
                throw new EOFException();
            }
            n += count;
        }
    }

    public int skipBytes(int n) throws IOException {
        if (n <= 0) {
            return 0;
        }
        long newPointer = Math.min(length, pointer + n);
        int skipped = (int) (newPointer - pointer);
        pointer = newPointer;
        return skipped;
    }

    public void write(int b) throws IOException {
        ensureOpen();
        checkWritable();
        ensureCapacity(pointer + 1);
        data[(int) pointer++] = (byte) b;
        length = (int) Math.max(length, pointer);
        dirty = true;
    }

    public void write(byte[] b) throws IOException {
        write(b, 0, b.length);
    }

    public void write(byte[] b, int off, int len) throws IOException {
        ensureOpen();
        checkWritable();
        ensureCapacity(pointer + len);
        System.arraycopy(b, off, data, (int) pointer, len);
        pointer += len;
        length = (int) Math.max(length, pointer);
        dirty = true;
    }

    private void checkWritable() throws IOException {
        if (!writable) {
            throw new IOException("Bad file descriptor");
        }
    }

    public long getFilePointer() throws IOException {
        ensureOpen();
        return pointer;
    }

    public void seek(long pos) throws IOException {
        ensureOpen();
        if (pos < 0) {
            throw new IOException("Negative seek offset");
        }
        pointer = pos;
    }

    public long length() throws IOException {
        ensureOpen();
        return length;
    }

    public void setLength(long newLength) throws IOException {
        ensureOpen();
        checkWritable();
        ensureCapacity(newLength);
        if (newLength < length) {
            java.util.Arrays.fill(data, (int) newLength, length, (byte) 0);
        }
        length = (int) newLength;
        if (pointer > newLength) {
            pointer = newLength;
        }
        dirty = true;
    }

    private void flush() throws IOException {
        if (dirty) {
            try (FileOutputStream out = new FileOutputStream(path)) {
                out.write(data, 0, length);
            }
            dirty = false;
        }
    }

    public void close() throws IOException {
        if (closed) {
            return;
        }
        flush();
        closed = true;
        if (channel != null) {
            channel.close();
        }
    }

    public final boolean readBoolean() throws IOException {
        return readUnsignedByte() != 0;
    }

    public final byte readByte() throws IOException {
        return (byte) readUnsignedByte();
    }

    public final int readUnsignedByte() throws IOException {
        int ch = read();
        if (ch < 0) {
            throw new EOFException();
        }
        return ch;
    }

    public final short readShort() throws IOException {
        return (short) readUnsignedShort();
    }

    public final int readUnsignedShort() throws IOException {
        int ch1 = readUnsignedByte();
        int ch2 = readUnsignedByte();
        return (ch1 << 8) + ch2;
    }

    public final char readChar() throws IOException {
        return (char) readUnsignedShort();
    }

    public final int readInt() throws IOException {
        return (readUnsignedShort() << 16) | readUnsignedShort();
    }

    public final long readLong() throws IOException {
        return ((long) readInt() << 32) + (readInt() & 0xFFFFFFFFL);
    }

    public final float readFloat() throws IOException {
        return Float.intBitsToFloat(readInt());
    }

    public final double readDouble() throws IOException {
        return Double.longBitsToDouble(readLong());
    }

    public final String readLine() throws IOException {
        StringBuilder input = new StringBuilder();
        int c = -1;
        boolean eol = false;
        while (!eol) {
            switch (c = read()) {
                case -1:
                case '\n':
                    eol = true;
                    break;
                case '\r':
                    eol = true;
                    long cur = getFilePointer();
                    if (read() != '\n') {
                        seek(cur);
                    }
                    break;
                default:
                    input.append((char) c);
                    break;
            }
        }
        if (c == -1 && input.length() == 0) {
            return null;
        }
        return input.toString();
    }

    public final String readUTF() throws IOException {
        return DataInputStream.readUTF(this);
    }

    public final void writeBoolean(boolean v) throws IOException {
        write(v ? 1 : 0);
    }

    public final void writeByte(int v) throws IOException {
        write(v);
    }

    public final void writeShort(int v) throws IOException {
        write((v >>> 8) & 0xFF);
        write(v & 0xFF);
    }

    public final void writeChar(int v) throws IOException {
        writeShort(v);
    }

    public final void writeInt(int v) throws IOException {
        writeShort(v >>> 16);
        writeShort(v);
    }

    public final void writeLong(long v) throws IOException {
        writeInt((int) (v >>> 32));
        writeInt((int) v);
    }

    public final void writeFloat(float v) throws IOException {
        writeInt(Float.floatToIntBits(v));
    }

    public final void writeDouble(double v) throws IOException {
        writeLong(Double.doubleToLongBits(v));
    }

    public final void writeBytes(String s) throws IOException {
        for (int i = 0; i < s.length(); i++) {
            write((byte) s.charAt(i));
        }
    }

    public final void writeChars(String s) throws IOException {
        for (int i = 0; i < s.length(); i++) {
            writeChar(s.charAt(i));
        }
    }

    public final void writeUTF(String str) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        new DataOutputStream(bytes).writeUTF(str);
        write(bytes.toByteArray());
    }

    private static final class Mapped extends MappedByteBuffer {
        Mapped(byte[] data, int offset, int size, boolean readOnly) {
            super(data, -1, 0, size, size, offset, readOnly, true);
        }
    }

    private final class Channel extends FileChannel {
        public int read(ByteBuffer dst) throws IOException {
            int count = read(dst, pointer);
            if (count > 0) {
                pointer += count;
            }
            return count;
        }

        public int write(ByteBuffer src) throws IOException {
            int count = write(src, pointer);
            pointer += count;
            return count;
        }

        public long position() throws IOException {
            return getFilePointer();
        }

        public FileChannel position(long newPosition) throws IOException {
            seek(newPosition);
            return this;
        }

        public long size() throws IOException {
            return length();
        }

        public FileChannel truncate(long size) throws IOException {
            if (size < length) {
                setLength(size);
            }
            return this;
        }

        public void force(boolean metaData) throws IOException {
            flush();
        }

        public int read(ByteBuffer dst, long position) throws IOException {
            ensureOpen();
            if (position >= length) {
                return -1;
            }
            int count = (int) Math.min(dst.remaining(), length - position);
            dst.put(data, (int) position, count);
            return count;
        }

        public int write(ByteBuffer src, long position) throws IOException {
            ensureOpen();
            if (!writable) {
                throw new NonWritableChannelException();
            }
            int count = src.remaining();
            ensureCapacity(position + count);
            src.get(data, (int) position, count);
            length = (int) Math.max(length, position + count);
            dirty = true;
            return count;
        }

        public MappedByteBuffer map(MapMode mode, long position, long size) throws IOException {
            ensureOpen();
            if (mode != MapMode.READ_ONLY && !writable) {
                throw new NonWritableChannelException();
            }
            if (position + size > length) {
                if (mode == MapMode.READ_ONLY) {
                    throw new IOException("Channel not open for writing - cannot extend file to required size");
                }
                setLength(position + size);
            }
            if (mode == MapMode.READ_ONLY || mode == MapMode.PRIVATE) {
                byte[] copy = new byte[(int) size];
                System.arraycopy(data, (int) position, copy, 0, (int) size);
                return new Mapped(copy, 0, (int) size, mode == MapMode.READ_ONLY);
            }
            dirty = true;
            return new Mapped(data, (int) position, (int) size, false);
        }

        protected void implCloseChannel() throws IOException {
            RandomAccessFile.this.close();
        }
    }
}
