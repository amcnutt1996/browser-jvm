package java.nio;

public class FloatBuffer extends Buffer implements Comparable<FloatBuffer> {
    final float[] hb;
    final int offset;
    final boolean isReadOnly;
    final ByteBuffer bb;
    final int byteOffset;
    final boolean bigEndian;
    final boolean direct;

    FloatBuffer(float[] hb, int mark, int pos, int lim, int cap, int offset, boolean readOnly, ByteBuffer bb, int byteOffset, boolean bigEndian, boolean direct) {
        super(mark, pos, lim, cap);
        this.hb = hb;
        this.offset = offset;
        this.isReadOnly = readOnly;
        this.bb = bb;
        this.byteOffset = byteOffset;
        this.bigEndian = bigEndian;
        this.direct = direct;
    }

    public static FloatBuffer allocate(int capacity) {
        if (capacity < 0) {
            throw new IllegalArgumentException("capacity < 0: (" + capacity + " < 0)");
        }
        return new FloatBuffer(new float[capacity], -1, 0, capacity, capacity, 0, false, null, 0, false, false);
    }

    public static FloatBuffer wrap(float[] array, int offset, int length) {
        checkFromIndexSize(offset, length, array.length);
        return new FloatBuffer(array, -1, offset, offset + length, array.length, 0, false, null, 0, false, false);
    }

    public static FloatBuffer wrap(float[] array) {
        return wrap(array, 0, array.length);
    }

    private void checkWritable() {
        if (isReadOnly) {
            throw new ReadOnlyBufferException();
        }
    }

    private float load(int i) {
        if (hb != null) {
            return hb[offset + i];
        }
        return ByteBuffer.getFloat0(bb.hb, byteOffset + i * 4, bigEndian);
    }

    private void store(int i, float x) {
        if (hb != null) {
            hb[offset + i] = x;
        } else {
            ByteBuffer.putFloat0(bb.hb, byteOffset + i * 4, x, bigEndian);
        }
    }

    private FloatBuffer derive(int mark, int pos, int lim, int cap, int start, boolean readOnly) {
        if (hb != null) {
            return new FloatBuffer(hb, mark, pos, lim, cap, offset + start, readOnly, bb, byteOffset, bigEndian, direct);
        }
        return new FloatBuffer(null, mark, pos, lim, cap, 0, readOnly, bb, byteOffset + start * 4, bigEndian, direct);
    }

    public FloatBuffer slice() {
        int pos = this.position();
        int lim = this.limit();
        int rem = (pos <= lim ? lim - pos : 0);
        return derive(-1, 0, rem, rem, pos, isReadOnly);
    }

    public FloatBuffer slice(int index, int length) {
        checkFromIndexSize(index, length, limit());
        return derive(-1, 0, length, length, index, isReadOnly);
    }

    public FloatBuffer duplicate() {
        return derive(markValue(), position(), limit(), capacity(), 0, isReadOnly);
    }

    public FloatBuffer asReadOnlyBuffer() {
        return derive(markValue(), position(), limit(), capacity(), 0, true);
    }

    public float get() {
        return load(nextGetIndex());
    }

    public float get(int index) {
        return load(checkIndex(index));
    }

    public FloatBuffer get(float[] dst, int off, int length) {
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

    public FloatBuffer get(float[] dst) {
        return get(dst, 0, dst.length);
    }

    public FloatBuffer get(int index, float[] dst, int off, int length) {
        checkFromIndexSize(index, length, limit());
        checkFromIndexSize(off, length, dst.length);
        for (int i = 0; i < length; i++) {
            dst[off + i] = load(index + i);
        }
        return this;
    }

    public FloatBuffer get(int index, float[] dst) {
        return get(index, dst, 0, dst.length);
    }

    public FloatBuffer put(float x) {
        checkWritable();
        store(nextPutIndex(), x);
        return this;
    }

    public FloatBuffer put(int index, float x) {
        checkWritable();
        store(checkIndex(index), x);
        return this;
    }

    public FloatBuffer put(FloatBuffer src) {
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

    public FloatBuffer put(int index, FloatBuffer src, int off, int length) {
        checkWritable();
        checkFromIndexSize(index, length, limit());
        checkFromIndexSize(off, length, src.limit());
        for (int i = 0; i < length; i++) {
            store(index + i, src.load(off + i));
        }
        return this;
    }

    public FloatBuffer put(float[] src, int off, int length) {
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

    public final FloatBuffer put(float[] src) {
        return put(src, 0, src.length);
    }

    public FloatBuffer put(int index, float[] src, int off, int length) {
        checkWritable();
        checkFromIndexSize(index, length, limit());
        checkFromIndexSize(off, length, src.length);
        for (int i = 0; i < length; i++) {
            store(index + i, src[off + i]);
        }
        return this;
    }

    public FloatBuffer put(int index, float[] src) {
        return put(index, src, 0, src.length);
    }

    public final boolean hasArray() {
        return hb != null && bb == null && !isReadOnly;
    }

    public final float[] array() {
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

    public FloatBuffer position(int newPosition) {
        super.position(newPosition);
        return this;
    }

    public FloatBuffer limit(int newLimit) {
        super.limit(newLimit);
        return this;
    }

    public FloatBuffer mark() {
        super.mark();
        return this;
    }

    public FloatBuffer reset() {
        super.reset();
        return this;
    }

    public FloatBuffer clear() {
        super.clear();
        return this;
    }

    public FloatBuffer flip() {
        super.flip();
        return this;
    }

    public FloatBuffer rewind() {
        super.rewind();
        return this;
    }

    public FloatBuffer compact() {
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
        if (!(ob instanceof FloatBuffer)) {
            return false;
        }
        FloatBuffer that = (FloatBuffer) ob;
        int thisRem = this.limit() - this.position();
        int thatRem = that.limit() - that.position();
        if (thisRem < 0 || thisRem != thatRem) {
            return false;
        }
        return mismatch(that) < 0;
    }

    public int compareTo(FloatBuffer that) {
        int thisPos = this.position();
        int thisRem = this.limit() - thisPos;
        int thatPos = that.position();
        int thatRem = that.limit() - thatPos;
        int length = Math.min(thisRem, thatRem);
        for (int i = 0; i < length; i++) {
            int cmp = Float.compare(this.get(thisPos + i), that.get(thatPos + i));
            if (cmp != 0) {
                return cmp;
            }
        }
        return thisRem - thatRem;
    }

    public int mismatch(FloatBuffer that) {
        int thisPos = this.position();
        int thisRem = this.limit() - thisPos;
        int thatPos = that.position();
        int thatRem = that.limit() - thatPos;
        int length = Math.min(thisRem, thatRem);
        for (int i = 0; i < length; i++) {
            if (Float.compare(this.get(thisPos + i), that.get(thatPos + i)) != 0) {
                return i;
            }
        }
        return thisRem == thatRem ? -1 : length;
    }

    public String toString() {
        return getClass().getName() + "[pos=" + position() + " lim=" + limit() + " cap=" + capacity() + "]";
    }
}
