package java.nio.channels;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.MappedByteBuffer;

public abstract class FileChannel implements SeekableByteChannel {
    private boolean open = true;

    protected FileChannel() {
    }

    public abstract int read(ByteBuffer dst) throws IOException;

    public long read(ByteBuffer[] dsts, int offset, int length) throws IOException {
        long total = 0;
        for (int i = offset; i < offset + length; i++) {
            int count = read(dsts[i]);
            if (count < 0) {
                return total == 0 ? -1 : total;
            }
            total += count;
        }
        return total;
    }

    public final long read(ByteBuffer[] dsts) throws IOException {
        return read(dsts, 0, dsts.length);
    }

    public abstract int write(ByteBuffer src) throws IOException;

    public long write(ByteBuffer[] srcs, int offset, int length) throws IOException {
        long total = 0;
        for (int i = offset; i < offset + length; i++) {
            total += write(srcs[i]);
        }
        return total;
    }

    public final long write(ByteBuffer[] srcs) throws IOException {
        return write(srcs, 0, srcs.length);
    }

    public abstract long position() throws IOException;

    public abstract FileChannel position(long newPosition) throws IOException;

    public abstract long size() throws IOException;

    public abstract FileChannel truncate(long size) throws IOException;

    public abstract void force(boolean metaData) throws IOException;

    public long transferTo(long position, long count, WritableByteChannel target) throws IOException {
        ByteBuffer buffer = ByteBuffer.allocate((int) Math.min(count, Math.max(0, size() - position)));
        read(buffer, position);
        buffer.flip();
        return target.write(buffer);
    }

    public long transferFrom(ReadableByteChannel src, long position, long count) throws IOException {
        ByteBuffer buffer = ByteBuffer.allocate((int) count);
        int read = src.read(buffer);
        if (read <= 0) {
            return 0;
        }
        buffer.flip();
        return write(buffer, position);
    }

    public abstract int read(ByteBuffer dst, long position) throws IOException;

    public abstract int write(ByteBuffer src, long position) throws IOException;

    public abstract MappedByteBuffer map(MapMode mode, long position, long size) throws IOException;

    public final boolean isOpen() {
        return open;
    }

    public final void close() throws IOException {
        if (open) {
            open = false;
            implCloseChannel();
        }
    }

    protected abstract void implCloseChannel() throws IOException;

    public static class MapMode {
        public static final MapMode READ_ONLY = new MapMode("READ_ONLY");
        public static final MapMode READ_WRITE = new MapMode("READ_WRITE");
        public static final MapMode PRIVATE = new MapMode("PRIVATE");

        private final String name;

        private MapMode(String name) {
            this.name = name;
        }

        public String toString() {
            return name;
        }
    }
}
