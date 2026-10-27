package java.nio;

public class IntBuffer extends Buffer implements Comparable<IntBuffer> {
    final int[] hb;
    final int offset;
    final boolean isReadOnly;
    final ByteBuffer bb;
    final int byteOffset;
    final boolean bigEndian;
    final boolean direct;

    IntBuffer(int[] hb, int mark, int pos, int lim, int cap, int offset, boolean readOnly, ByteBuffer bb, int byteOffset, boolean bigEndian, boolean direct) {
        super(mark, pos, lim, cap);
        this.hb = hb;
        this.offset = offset;
        this.isReadOnly = readOnly;
        this.bb = bb;
        this.byteOffset = byteOffset;
        this.bigEndian = bigEndian;
        this.direct = direct;
    }

    public static IntBuffer allocate(int capacity) {
        if (capacity < 0) {
            throw new IllegalArgumentException("capacity < 0: (" + capacity + " < 0)");
        }
        return new IntBuffer(new int[capacity], -1, 0, capacity, capacity, 0, false, null, 0, false, false);
    }

    public static IntBuffer wrap(int[] array, int offset, int length) {
        checkFromIndexSize(offset, length, array.length);
        return new IntBuffer(array, -1, offset, offset + length, array.length, 0, false, null, 0, false, false);
    }

    public static IntBuffer wrap(int[] array) {
        return wrap(array, 0, array.length);
    }

    private void checkWritable() {
        if (isReadOnly) {
            throw new ReadOnlyBufferException();
        }
    }

    private int load(int i) {
        if (hb != null) {
            return hb[offset + i];
        }
        return ByteBuffer.getInt0(bb.hb, byteOffset + i * 4, bigEndian);
    }

    private void store(int i, int x) {
        if (hb != null) {
            hb[offset + i] = x;
        } else {
            ByteBuffer.putInt0(bb.hb, byteOffset + i * 4, x, bigEndian);
        }
    }

    private IntBuffer derive(int mark, int pos, int lim, int cap, int start, boolean readOnly) {
        if (hb != null) {
            return new IntBuffer(hb, mark, pos, lim, cap, offset + start, readOnly, bb, byteOffset, bigEndian, direct);
        }
        return new IntBuffer(null, mark, pos, lim, cap, 0, readOnly, bb, byteOffset + start * 4, bigEndian, direct);
    }

    public IntBuffer slice() {
        int pos = this.position();
        int lim = this.limit();
        int rem = (pos <= lim ? lim - pos : 0);
        return derive(-1, 0, rem, rem, pos, isReadOnly);
    }

    public IntBuffer slice(int index, int length) {
        checkFromIndexSize(index, length, limit());
        return derive(-1, 0, length, length, index, isReadOnly);
    }

    public IntBuffer duplicate() {
        return derive(markValue(), position(), limit(), capacity(), 0, isReadOnly);
    }

    public IntBuffer asReadOnlyBuffer() {
        return derive(markValue(), position(), limit(), capacity(), 0, true);
    }

    public int get() {
        return load(nextGetIndex());
    }

    public int get(int index) {
        return load(checkIndex(index));
    }

    public IntBuffer get(int[] dst, int off, int length) {
        checkFromIndexSize(off, length, dst.length);
        int pos = position();
        if (length > limit() - pos) {
            throw new BufferUnderflowException();
        }
        if (hb != null) {
            System.arraycopy(hb, offset + pos, dst, off, length);
        } else {
            for (int i = 0; i < length; i++) {
                dst[off + i] = load(pos + i);
            }
        }
        position(pos + length);
        return this;
    }

    public IntBuffer get(int[] dst) {
        return get(dst, 0, dst.length);
    }

    public IntBuffer get(int index, int[] dst, int off, int length) {
        checkFromIndexSize(index, length, limit());
        checkFromIndexSize(off, length, dst.length);
        for (int i = 0; i < length; i++) {
            dst[off + i] = load(index + i);
        }
        return this;
    }

    public IntBuffer get(int index, int[] dst) {
        return get(index, dst, 0, dst.length);
    }

    public IntBuffer put(int x) {
        checkWritable();
        store(nextPutIndex(), x);
        return this;
    }

    public IntBuffer put(int index, int x) {
        checkWritable();
        store(checkIndex(index), x);
        return this;
    }

    public IntBuffer put(IntBuffer src) {
        if (src == this) {
            throw new IllegalArgumentException("The source buffer is this buffer");
        }
        checkWritable();
        int n = src.remaining();
        int pos = position();
        if (n > limit() - pos) {
            throw new BufferOverflowException();
        }
        int srcPos = src.position();
        if (hb != null && src.hb != null) {
            System.arraycopy(src.hb, src.offset + srcPos, hb, offset + pos, n);
        } else {
            for (int i = 0; i < n; i++) {
                store(pos + i, src.load(srcPos + i));
            }
        }
        src.position(srcPos + n);
        position(pos + n);
        return this;
    }

    public IntBuffer put(int index, IntBuffer src, int off, int length) {
        checkWritable();
        checkFromIndexSize(index, length, limit());
        checkFromIndexSize(off, length, src.limit());
        for (int i = 0; i < length; i++) {
            store(index + i, src.load(off + i));
        }
        return this;
    }

    public IntBuffer put(int[] src, int off, int length) {
        checkWritable();
        checkFromIndexSize(off, length, src.length);
        int pos = position();
        if (length > limit() - pos) {
            throw new BufferOverflowException();
        }
        if (hb != null) {
            System.arraycopy(src, off, hb, offset + pos, length);
        } else {
            for (int i = 0; i < length; i++) {
                store(pos + i, src[off + i]);
            }
        }
        position(pos + length);
        return this;
    }

    public final IntBuffer put(int[] src) {
        return put(src, 0, src.length);
    }

    public IntBuffer put(int index, int[] src, int off, int length) {
        checkWritable();
        checkFromIndexSize(index, length, limit());
        checkFromIndexSize(off, length, src.length);
        for (int i = 0; i < length; i++) {
            store(index + i, src[off + i]);
        }
        return this;
    }

    public IntBuffer put(int index, int[] src) {
        return put(index, src, 0, src.length);
    }

    public final boolean hasArray() {
        return hb != null && bb == null && !isReadOnly;
    }

    public final int[] array() {
        if (hb == null || bb != null) {
            throw new UnsupportedOperationException();
        }
        if (isReadOnly) {
            throw new ReadOnlyBufferException();
        }
        return hb;
    }

    public final int arrayOffset() {
        if (hb == null || bb != null) {
            throw new UnsupportedOperationException();
        }
        if (isReadOnly) {
            throw new ReadOnlyBufferException();
        }
        return offset;
    }

    public IntBuffer position(int newPosition) {
        super.position(newPosition);
        return this;
    }

    public IntBuffer limit(int newLimit) {
        super.limit(newLimit);
        return this;
    }

    public IntBuffer mark() {
        super.mark();
        return this;
    }

    public IntBuffer reset() {
        super.reset();
        return this;
    }

    public IntBuffer clear() {
        super.clear();
        return this;
    }

    public IntBuffer flip() {
        super.flip();
        return this;
    }

    public IntBuffer rewind() {
        super.rewind();
        return this;
    }

    public IntBuffer compact() {
        checkWritable();
        int pos = position();
        int lim = limit();
        int rem = (pos <= lim ? lim - pos : 0);
        for (int i = 0; i < rem; i++) {
            store(i, load(pos + i));
        }
        position(rem);
        limit(capacity());
        discardMark();
        return this;
    }

    public boolean isDirect() {
        return direct;
    }

    public boolean isReadOnly() {
        return isReadOnly;
    }

    public final ByteOrder order() {
        if (bb != null) {
            return bigEndian ? ByteOrder.BIG_ENDIAN : ByteOrder.LITTLE_ENDIAN;
        }
        return ByteOrder.nativeOrder();
    }

    public int hashCode() {
        int h = 1;
        int p = position();
        for (int i = limit() - 1; i >= p; i--) {
            h = 31 * h + (int) get(i);
        }
        return h;
    }

    public boolean equals(Object ob) {
        if (this == ob) {
            return true;
        }
        if (!(ob instanceof IntBuffer)) {
            return false;
        }
        IntBuffer that = (IntBuffer) ob;
        int thisRem = this.limit() - this.position();
        int thatRem = that.limit() - that.position();
        if (thisRem < 0 || thisRem != thatRem) {
            return false;
        }
        return mismatch(that) < 0;
    }

    public int compareTo(IntBuffer that) {
        int thisPos = this.position();
        int thisRem = this.limit() - thisPos;
        int thatPos = that.position();
        int thatRem = that.limit() - thatPos;
        int length = Math.min(thisRem, thatRem);
        for (int i = 0; i < length; i++) {
            int cmp = Integer.compare(this.get(thisPos + i), that.get(thatPos + i));
            if (cmp != 0) {
                return cmp;
            }
        }
        return thisRem - thatRem;
    }

    public int mismatch(IntBuffer that) {
        int thisPos = this.position();
        int thisRem = this.limit() - thisPos;
        int thatPos = that.position();
        int thatRem = that.limit() - thatPos;
        int length = Math.min(thisRem, thatRem);
        for (int i = 0; i < length; i++) {
            if (Integer.compare(this.get(thisPos + i), that.get(thatPos + i)) != 0) {
                return i;
            }
        }
        return thisRem == thatRem ? -1 : length;
    }

    public String toString() {
        return getClass().getName() + "[pos=" + position() + " lim=" + limit() + " cap=" + capacity() + "]";
    }
}
