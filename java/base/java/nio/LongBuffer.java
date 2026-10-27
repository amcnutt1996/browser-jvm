package java.nio;

public class LongBuffer extends Buffer implements Comparable<LongBuffer> {
    final long[] hb;
    final int offset;
    final boolean isReadOnly;
    final ByteBuffer bb;
    final int byteOffset;
    final boolean bigEndian;
    final boolean direct;

    LongBuffer(long[] hb, int mark, int pos, int lim, int cap, int offset, boolean readOnly, ByteBuffer bb, int byteOffset, boolean bigEndian, boolean direct) {
        super(mark, pos, lim, cap);
        this.hb = hb;
        this.offset = offset;
        this.isReadOnly = readOnly;
        this.bb = bb;
        this.byteOffset = byteOffset;
        this.bigEndian = bigEndian;
        this.direct = direct;
    }

    public static LongBuffer allocate(int capacity) {
        if (capacity < 0) {
            throw new IllegalArgumentException("capacity < 0: (" + capacity + " < 0)");
        }
        return new LongBuffer(new long[capacity], -1, 0, capacity, capacity, 0, false, null, 0, false, false);
    }

    public static LongBuffer wrap(long[] array, int offset, int length) {
        checkFromIndexSize(offset, length, array.length);
        return new LongBuffer(array, -1, offset, offset + length, array.length, 0, false, null, 0, false, false);
    }

    public static LongBuffer wrap(long[] array) {
        return wrap(array, 0, array.length);
    }

    private void checkWritable() {
        if (isReadOnly) {
            throw new ReadOnlyBufferException();
        }
    }

    private long load(int i) {
        if (hb != null) {
            return hb[offset + i];
        }
        return ByteBuffer.getLong0(bb.hb, byteOffset + i * 8, bigEndian);
    }

    private void store(int i, long x) {
        if (hb != null) {
            hb[offset + i] = x;
        } else {
            ByteBuffer.putLong0(bb.hb, byteOffset + i * 8, x, bigEndian);
        }
    }

    private LongBuffer derive(int mark, int pos, int lim, int cap, int start, boolean readOnly) {
        if (hb != null) {
            return new LongBuffer(hb, mark, pos, lim, cap, offset + start, readOnly, bb, byteOffset, bigEndian, direct);
        }
        return new LongBuffer(null, mark, pos, lim, cap, 0, readOnly, bb, byteOffset + start * 8, bigEndian, direct);
    }

    public LongBuffer slice() {
        int pos = this.position();
        int lim = this.limit();
        int rem = (pos <= lim ? lim - pos : 0);
        return derive(-1, 0, rem, rem, pos, isReadOnly);
    }

    public LongBuffer slice(int index, int length) {
        checkFromIndexSize(index, length, limit());
        return derive(-1, 0, length, length, index, isReadOnly);
    }

    public LongBuffer duplicate() {
        return derive(markValue(), position(), limit(), capacity(), 0, isReadOnly);
    }

    public LongBuffer asReadOnlyBuffer() {
        return derive(markValue(), position(), limit(), capacity(), 0, true);
    }

    public long get() {
        return load(nextGetIndex());
    }

    public long get(int index) {
        return load(checkIndex(index));
    }

    public LongBuffer get(long[] dst, int off, int length) {
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

    public LongBuffer get(long[] dst) {
        return get(dst, 0, dst.length);
    }

    public LongBuffer get(int index, long[] dst, int off, int length) {
        checkFromIndexSize(index, length, limit());
        checkFromIndexSize(off, length, dst.length);
        for (int i = 0; i < length; i++) {
            dst[off + i] = load(index + i);
        }
        return this;
    }

    public LongBuffer get(int index, long[] dst) {
        return get(index, dst, 0, dst.length);
    }

    public LongBuffer put(long x) {
        checkWritable();
        store(nextPutIndex(), x);
        return this;
    }

    public LongBuffer put(int index, long x) {
        checkWritable();
        store(checkIndex(index), x);
        return this;
    }

    public LongBuffer put(LongBuffer src) {
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

    public LongBuffer put(int index, LongBuffer src, int off, int length) {
        checkWritable();
        checkFromIndexSize(index, length, limit());
        checkFromIndexSize(off, length, src.limit());
        for (int i = 0; i < length; i++) {
            store(index + i, src.load(off + i));
        }
        return this;
    }

    public LongBuffer put(long[] src, int off, int length) {
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

    public final LongBuffer put(long[] src) {
        return put(src, 0, src.length);
    }

    public LongBuffer put(int index, long[] src, int off, int length) {
        checkWritable();
        checkFromIndexSize(index, length, limit());
        checkFromIndexSize(off, length, src.length);
        for (int i = 0; i < length; i++) {
            store(index + i, src[off + i]);
        }
        return this;
    }

    public LongBuffer put(int index, long[] src) {
        return put(index, src, 0, src.length);
    }

    public final boolean hasArray() {
        return hb != null && bb == null && !isReadOnly;
    }

    public final long[] array() {
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

    public LongBuffer position(int newPosition) {
        super.position(newPosition);
        return this;
    }

    public LongBuffer limit(int newLimit) {
        super.limit(newLimit);
        return this;
    }

    public LongBuffer mark() {
        super.mark();
        return this;
    }

    public LongBuffer reset() {
        super.reset();
        return this;
    }

    public LongBuffer clear() {
        super.clear();
        return this;
    }

    public LongBuffer flip() {
        super.flip();
        return this;
    }

    public LongBuffer rewind() {
        super.rewind();
        return this;
    }

    public LongBuffer compact() {
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
        if (!(ob instanceof LongBuffer)) {
            return false;
        }
        LongBuffer that = (LongBuffer) ob;
        int thisRem = this.limit() - this.position();
        int thatRem = that.limit() - that.position();
        if (thisRem < 0 || thisRem != thatRem) {
            return false;
        }
        return mismatch(that) < 0;
    }

    public int compareTo(LongBuffer that) {
        int thisPos = this.position();
        int thisRem = this.limit() - thisPos;
        int thatPos = that.position();
        int thatRem = that.limit() - thatPos;
        int length = Math.min(thisRem, thatRem);
        for (int i = 0; i < length; i++) {
            int cmp = Long.compare(this.get(thisPos + i), that.get(thatPos + i));
            if (cmp != 0) {
                return cmp;
            }
        }
        return thisRem - thatRem;
    }

    public int mismatch(LongBuffer that) {
        int thisPos = this.position();
        int thisRem = this.limit() - thisPos;
        int thatPos = that.position();
        int thatRem = that.limit() - thatPos;
        int length = Math.min(thisRem, thatRem);
        for (int i = 0; i < length; i++) {
            if (Long.compare(this.get(thisPos + i), that.get(thatPos + i)) != 0) {
                return i;
            }
        }
        return thisRem == thatRem ? -1 : length;
    }

    public String toString() {
        return getClass().getName() + "[pos=" + position() + " lim=" + limit() + " cap=" + capacity() + "]";
    }
}
