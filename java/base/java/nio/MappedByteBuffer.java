package java.nio;

public abstract class MappedByteBuffer extends ByteBuffer {
    protected MappedByteBuffer(byte[] hb, int mark, int pos, int lim, int cap, int offset, boolean readOnly, boolean direct) {
        super(hb, mark, pos, lim, cap, offset, readOnly, direct);
    }

    public final boolean isLoaded() {
        return true;
    }

    public final MappedByteBuffer load() {
        return this;
    }

    public final MappedByteBuffer force() {
        return this;
    }

    public final MappedByteBuffer force(int index, int length) {
        return this;
    }
}
