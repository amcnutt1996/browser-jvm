package java.io;

import java.nio.channels.FileChannel;

public class FileInputStream extends InputStream {
    private final FileDescriptor fd;
    private final String path;
    private volatile boolean closed;

    public FileInputStream(String name) throws FileNotFoundException {
        this(name != null ? new File(name) : null);
    }

    public FileInputStream(File file) throws FileNotFoundException {
        String name = (file != null ? file.getPath() : null);
        if (name == null) {
            throw new NullPointerException();
        }
        if (file.isInvalid()) {
            throw new FileNotFoundException("Invalid file path");
        }
        fd = new FileDescriptor();
        path = name;
        open0(fd, file.getAbsolutePath());
    }

    public FileInputStream(FileDescriptor fdObj) {
        if (fdObj == null) {
            throw new NullPointerException();
        }
        fd = fdObj;
        path = null;
    }

    private static native void open0(FileDescriptor fd, String path) throws FileNotFoundException;

    public int read() throws IOException {
        return read0(fd);
    }

    private static native int read0(FileDescriptor fd) throws IOException;

    private static native int readBytes(FileDescriptor fd, byte[] b, int off, int len) throws IOException;

    public int read(byte[] b) throws IOException {
        return read(b, 0, b.length);
    }

    public int read(byte[] b, int off, int len) throws IOException {
        java.util.Objects.checkFromIndexSize(off, len, b.length);
        if (len == 0) {
            return 0;
        }
        return readBytes(fd, b, off, len);
    }

    public byte[] readAllBytes() throws IOException {
        return super.readAllBytes();
    }

    public long skip(long n) throws IOException {
        return skip0(fd, n);
    }

    private static native long skip0(FileDescriptor fd, long n) throws IOException;

    public int available() throws IOException {
        return available0(fd);
    }

    private static native int available0(FileDescriptor fd) throws IOException;

    public void close() throws IOException {
        closed = true;
    }

    public final FileDescriptor getFD() throws IOException {
        return fd;
    }

    public FileChannel getChannel() {
        throw new UnsupportedOperationException("FileChannel");
    }
}
