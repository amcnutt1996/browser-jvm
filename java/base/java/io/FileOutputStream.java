package java.io;

import java.nio.channels.FileChannel;

public class FileOutputStream extends OutputStream {
    private final FileDescriptor fd;
    private final String path;
    private volatile boolean closed;

    public FileOutputStream(String name) throws FileNotFoundException {
        this(name != null ? new File(name) : null, false);
    }

    public FileOutputStream(String name, boolean append) throws FileNotFoundException {
        this(name != null ? new File(name) : null, append);
    }

    public FileOutputStream(File file) throws FileNotFoundException {
        this(file, false);
    }

    public FileOutputStream(File file, boolean append) throws FileNotFoundException {
        String name = (file != null ? file.getPath() : null);
        if (name == null) {
            throw new NullPointerException();
        }
        if (file.isInvalid()) {
            throw new FileNotFoundException("Invalid file path");
        }
        this.fd = new FileDescriptor();
        this.path = name;
        open0(fd, file.getAbsolutePath(), append);
    }

    public FileOutputStream(FileDescriptor fdObj) {
        if (fdObj == null) {
            throw new NullPointerException();
        }
        this.fd = fdObj;
        this.path = null;
    }

    private static native void open0(FileDescriptor fd, String path, boolean append) throws FileNotFoundException;

    private static native void writeBytes(FileDescriptor fd, byte[] b, int off, int len) throws IOException;

    public void write(int b) throws IOException {
        writeBytes(fd, new byte[] {(byte) b}, 0, 1);
    }

    public void write(byte[] b) throws IOException {
        writeBytes(fd, b, 0, b.length);
    }

    public void write(byte[] b, int off, int len) throws IOException {
        java.util.Objects.checkFromIndexSize(off, len, b.length);
        writeBytes(fd, b, off, len);
    }

    public void flush() throws IOException {
        flush0(fd);
    }

    private static native void flush0(FileDescriptor fd) throws IOException;

    public void close() throws IOException {
        if (closed) {
            return;
        }
        closed = true;
        close0(fd);
    }

    private static native void close0(FileDescriptor fd) throws IOException;

    public final FileDescriptor getFD() throws IOException {
        return fd;
    }

    public FileChannel getChannel() {
        throw new UnsupportedOperationException("FileChannel");
    }
}
