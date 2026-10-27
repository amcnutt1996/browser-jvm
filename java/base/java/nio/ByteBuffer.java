package java.nio;

public class ByteBuffer extends Buffer implements Comparable<ByteBuffer> {
    final byte[] hb;
    final int offset;
    boolean isReadOnly;
    boolean bigEndian = true;
    final boolean direct;

    ByteBuffer(byte[] hb, int mark, int pos, int lim, int cap, int offset, boolean readOnly, boolean direct) {
        super(mark, pos, lim, cap);
        this.hb = hb;
        this.offset = offset;
        this.isReadOnly = readOnly;
        this.direct = direct;
    }

    public static ByteBuffer allocateDirect(int capacity) {
        if (capacity < 0) {
            throw new IllegalArgumentException("capacity < 0: (" + capacity + " < 0)");
        }
        return new ByteBuffer(new byte[capacity], -1, 0, capacity, capacity, 0, false, true);
    }

    public static ByteBuffer allocate(int capacity) {
        if (capacity < 0) {
            throw new IllegalArgumentException("capacity < 0: (" + capacity + " < 0)");
        }
        return new ByteBuffer(new byte[capacity], -1, 0, capacity, capacity, 0, false, false);
    }

    public static ByteBuffer wrap(byte[] array, int offset, int length) {
        checkFromIndexSize(offset, length, array.length);
        return new ByteBuffer(array, -1, offset, offset + length, array.length, 0, false, false);
    }

    public static ByteBuffer wrap(byte[] array) {
        return wrap(array, 0, array.length);
    }

    private void checkWritable() {
        if (isReadOnly) {
            throw new ReadOnlyBufferException();
        }
    }

    private ByteBuffer copyOrder(ByteBuffer b) {
        b.bigEndian = bigEndian;
        return b;
    }

    public ByteBuffer slice() {
        int pos = this.position();
        int lim = this.limit();
        int rem = (pos <= lim ? lim - pos : 0);
        return new ByteBuffer(hb, -1, 0, rem, rem, pos + offset, isReadOnly, direct);
    }

    public ByteBuffer slice(int index, int length) {
        checkFromIndexSize(index, length, limit());
        return new ByteBuffer(hb, -1, 0, length, length, index + offset, isReadOnly, direct);
    }

    public ByteBuffer duplicate() {
        return copyOrder(new ByteBuffer(hb, markValue(), position(), limit(), capacity(), offset, isReadOnly, direct));
    }

    public ByteBuffer asReadOnlyBuffer() {
        return copyOrder(new ByteBuffer(hb, markValue(), position(), limit(), capacity(), offset, true, direct));
    }

    public byte get() {
        return hb[offset + nextGetIndex()];
    }

    public byte get(int index) {
        return hb[offset + checkIndex(index)];
    }

    public ByteBuffer get(int index, byte[] dst, int off, int length) {
        checkFromIndexSize(index, length, limit());
        checkFromIndexSize(off, length, dst.length);
        System.arraycopy(hb, offset + index, dst, off, length);
        return this;
    }

    public ByteBuffer get(int index, byte[] dst) {
        return get(index, dst, 0, dst.length);
    }

    public ByteBuffer get(byte[] dst, int off, int length) {
        checkFromIndexSize(off, length, dst.length);
        int pos = position();
        if (length > limit() - pos) {
            throw new BufferUnderflowException();
        }
        System.arraycopy(hb, offset + pos, dst, off, length);
        position(pos + length);
        return this;
    }

    public ByteBuffer get(byte[] dst) {
        return get(dst, 0, dst.length);
    }

    public ByteBuffer put(byte x) {
        checkWritable();
        hb[offset + nextPutIndex()] = x;
        return this;
    }

    public ByteBuffer put(int index, byte x) {
        checkWritable();
        hb[offset + checkIndex(index)] = x;
        return this;
    }

    public ByteBuffer put(ByteBuffer src) {
        if (src == this) {
            throw new IllegalArgumentException("The source buffer is this buffer");
        }
        checkWritable();
        int n = src.remaining();
        int pos = position();
        if (n > limit() - pos) {
            throw new BufferOverflowException();
        }
        System.arraycopy(src.hb, src.offset + src.position(), hb, offset + pos, n);
        src.position(src.position() + n);
        position(pos + n);
        return this;
    }

    public ByteBuffer put(int index, ByteBuffer src, int off, int length) {
        checkWritable();
        checkFromIndexSize(index, length, limit());
        checkFromIndexSize(off, length, src.limit());
        System.arraycopy(src.hb, src.offset + off, hb, offset + index, length);
        return this;
    }

    public ByteBuffer put(byte[] src, int off, int length) {
        checkWritable();
        checkFromIndexSize(off, length, src.length);
        int pos = position();
        if (length > limit() - pos) {
            throw new BufferOverflowException();
        }
        System.arraycopy(src, off, hb, offset + pos, length);
        position(pos + length);
        return this;
    }

    public final ByteBuffer put(byte[] src) {
        return put(src, 0, src.length);
    }

    public ByteBuffer put(int index, byte[] src, int off, int length) {
        checkWritable();
        checkFromIndexSize(index, length, limit());
        checkFromIndexSize(off, length, src.length);
        System.arraycopy(src, off, hb, offset + index, length);
        return this;
    }

    public ByteBuffer put(int index, byte[] src) {
        return put(index, src, 0, src.length);
    }

    public final boolean hasArray() {
        return !isReadOnly;
    }

    public final byte[] array() {
        if (isReadOnly) {
            throw new ReadOnlyBufferException();
        }
        return hb;
    }

    public final int arrayOffset() {
        if (isReadOnly) {
            throw new ReadOnlyBufferException();
        }
        return offset;
    }

    public ByteBuffer position(int newPosition) {
        super.position(newPosition);
        return this;
    }

    public ByteBuffer limit(int newLimit) {
        super.limit(newLimit);
        return this;
    }

    public ByteBuffer mark() {
        super.mark();
        return this;
    }

    public ByteBuffer reset() {
        super.reset();
        return this;
    }

    public ByteBuffer clear() {
        super.clear();
        return this;
    }

    public ByteBuffer flip() {
        super.flip();
        return this;
    }

    public ByteBuffer rewind() {
        super.rewind();
        return this;
    }

    public ByteBuffer compact() {
        checkWritable();
        int pos = position();
        int lim = limit();
        int rem = (pos <= lim ? lim - pos : 0);
        System.arraycopy(hb, offset + pos, hb, offset, rem);
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

    public String toString() {
        return getClass().getName() + "[pos=" + position() + " lim=" + limit() + " cap=" + capacity() + "]";
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
        if (!(ob instanceof ByteBuffer)) {
            return false;
        }
        ByteBuffer that = (ByteBuffer) ob;
        int thisRem = this.limit() - this.position();
        int thatRem = that.limit() - that.position();
        if (thisRem < 0 || thisRem != thatRem) {
            return false;
        }
        return mismatch(that) < 0;
    }

    public int compareTo(ByteBuffer that) {
        int thisPos = this.position();
        int thisRem = this.limit() - thisPos;
        int thatPos = that.position();
        int thatRem = that.limit() - thatPos;
        int length = Math.min(thisRem, thatRem);
        for (int i = 0; i < length; i++) {
            int cmp = Byte.compare(this.get(thisPos + i), that.get(thatPos + i));
            if (cmp != 0) {
                return cmp;
            }
        }
        return thisRem - thatRem;
    }

    public int mismatch(ByteBuffer that) {
        int thisPos = this.position();
        int thisRem = this.limit() - thisPos;
        int thatPos = that.position();
        int thatRem = that.limit() - thatPos;
        int length = Math.min(thisRem, thatRem);
        for (int i = 0; i < length; i++) {
            if (this.get(thisPos + i) != that.get(thatPos + i)) {
                return i;
            }
        }
        return thisRem == thatRem ? -1 : length;
    }

    public final ByteOrder order() {
        return bigEndian ? ByteOrder.BIG_ENDIAN : ByteOrder.LITTLE_ENDIAN;
    }

    public final ByteBuffer order(ByteOrder bo) {
        bigEndian = (bo == ByteOrder.BIG_ENDIAN);
        return this;
    }

    public final int alignmentOffset(int index, int unitSize) {
        if (index < 0) {
            throw new IllegalArgumentException("Index less than zero: " + index);
        }
        if (unitSize < 1 || (unitSize & (unitSize - 1)) != 0) {
            throw new IllegalArgumentException("Unit size not a power of two: " + unitSize);
        }
        return (offset + index) & (unitSize - 1);
    }

    public final ByteBuffer alignedSlice(int unitSize) {
        int pos = position();
        int lim = limit();
        int pos_mod = alignmentOffset(pos, unitSize);
        int lim_mod = alignmentOffset(lim, unitSize);
        int aligned_pos = (pos_mod > 0) ? pos + (unitSize - pos_mod) : pos;
        int aligned_lim = lim - lim_mod;
        if (aligned_pos > lim || aligned_lim < pos) {
            aligned_pos = aligned_lim = pos;
        }
        return slice(aligned_pos, aligned_lim - aligned_pos);
    }

    public char getChar() {
        return getChar0(hb, offset + nextGetIndex(2), bigEndian);
    }

    public char getChar(int index) {
        return getChar0(hb, offset + checkIndex(index, 2), bigEndian);
    }

    public ByteBuffer putChar(char value) {
        checkWritable();
        putChar0(hb, offset + nextPutIndex(2), value, bigEndian);
        return this;
    }

    public ByteBuffer putChar(int index, char value) {
        checkWritable();
        putChar0(hb, offset + checkIndex(index, 2), value, bigEndian);
        return this;
    }

    static native char getChar0(byte[] hb, int index, boolean bigEndian);

    static native void putChar0(byte[] hb, int index, char value, boolean bigEndian);

    public CharBuffer asCharBuffer() {
        int pos = position();
        int count = remaining() / 2;
        int byteOffset = offset + pos;
        char[] view = bigEndian ? null : charView(hb, byteOffset, count);
        if (view != null) {
            return new CharBuffer(view, -1, 0, count, count, 0, isReadOnly, this, byteOffset, false, direct);
        }
        return new CharBuffer(null, -1, 0, count, count, 0, isReadOnly, this, byteOffset, bigEndian, direct);
    }

    static native char[] charView(byte[] hb, int byteOffset, int count);


    public short getShort() {
        return getShort0(hb, offset + nextGetIndex(2), bigEndian);
    }

    public short getShort(int index) {
        return getShort0(hb, offset + checkIndex(index, 2), bigEndian);
    }

    public ByteBuffer putShort(short value) {
        checkWritable();
        putShort0(hb, offset + nextPutIndex(2), value, bigEndian);
        return this;
    }

    public ByteBuffer putShort(int index, short value) {
        checkWritable();
        putShort0(hb, offset + checkIndex(index, 2), value, bigEndian);
        return this;
    }

    static native short getShort0(byte[] hb, int index, boolean bigEndian);

    static native void putShort0(byte[] hb, int index, short value, boolean bigEndian);

    public ShortBuffer asShortBuffer() {
        int pos = position();
        int count = remaining() / 2;
        int byteOffset = offset + pos;
        short[] view = bigEndian ? null : shortView(hb, byteOffset, count);
        if (view != null) {
            return new ShortBuffer(view, -1, 0, count, count, 0, isReadOnly, this, byteOffset, false, direct);
        }
        return new ShortBuffer(null, -1, 0, count, count, 0, isReadOnly, this, byteOffset, bigEndian, direct);
    }

    static native short[] shortView(byte[] hb, int byteOffset, int count);


    public int getInt() {
        return getInt0(hb, offset + nextGetIndex(4), bigEndian);
    }

    public int getInt(int index) {
        return getInt0(hb, offset + checkIndex(index, 4), bigEndian);
    }

    public ByteBuffer putInt(int value) {
        checkWritable();
        putInt0(hb, offset + nextPutIndex(4), value, bigEndian);
        return this;
    }

    public ByteBuffer putInt(int index, int value) {
        checkWritable();
        putInt0(hb, offset + checkIndex(index, 4), value, bigEndian);
        return this;
    }

    static native int getInt0(byte[] hb, int index, boolean bigEndian);

    static native void putInt0(byte[] hb, int index, int value, boolean bigEndian);

    public IntBuffer asIntBuffer() {
        int pos = position();
        int count = remaining() / 4;
        int byteOffset = offset + pos;
        int[] view = bigEndian ? null : intView(hb, byteOffset, count);
        if (view != null) {
            return new IntBuffer(view, -1, 0, count, count, 0, isReadOnly, this, byteOffset, false, direct);
        }
        return new IntBuffer(null, -1, 0, count, count, 0, isReadOnly, this, byteOffset, bigEndian, direct);
    }

    static native int[] intView(byte[] hb, int byteOffset, int count);


    public long getLong() {
        return getLong0(hb, offset + nextGetIndex(8), bigEndian);
    }

    public long getLong(int index) {
        return getLong0(hb, offset + checkIndex(index, 8), bigEndian);
    }

    public ByteBuffer putLong(long value) {
        checkWritable();
        putLong0(hb, offset + nextPutIndex(8), value, bigEndian);
        return this;
    }

    public ByteBuffer putLong(int index, long value) {
        checkWritable();
        putLong0(hb, offset + checkIndex(index, 8), value, bigEndian);
        return this;
    }

    static native long getLong0(byte[] hb, int index, boolean bigEndian);

    static native void putLong0(byte[] hb, int index, long value, boolean bigEndian);

    public LongBuffer asLongBuffer() {
        int pos = position();
        int count = remaining() / 8;
        int byteOffset = offset + pos;
        long[] view = bigEndian ? null : longView(hb, byteOffset, count);
        if (view != null) {
            return new LongBuffer(view, -1, 0, count, count, 0, isReadOnly, this, byteOffset, false, direct);
        }
        return new LongBuffer(null, -1, 0, count, count, 0, isReadOnly, this, byteOffset, bigEndian, direct);
    }

    static native long[] longView(byte[] hb, int byteOffset, int count);


    public float getFloat() {
        return getFloat0(hb, offset + nextGetIndex(4), bigEndian);
    }

    public float getFloat(int index) {
        return getFloat0(hb, offset + checkIndex(index, 4), bigEndian);
    }

    public ByteBuffer putFloat(float value) {
        checkWritable();
        putFloat0(hb, offset + nextPutIndex(4), value, bigEndian);
        return this;
    }

    public ByteBuffer putFloat(int index, float value) {
        checkWritable();
        putFloat0(hb, offset + checkIndex(index, 4), value, bigEndian);
        return this;
    }

    static native float getFloat0(byte[] hb, int index, boolean bigEndian);

    static native void putFloat0(byte[] hb, int index, float value, boolean bigEndian);

    public FloatBuffer asFloatBuffer() {
        int pos = position();
        int count = remaining() / 4;
        int byteOffset = offset + pos;
        float[] view = bigEndian ? null : floatView(hb, byteOffset, count);
        if (view != null) {
            return new FloatBuffer(view, -1, 0, count, count, 0, isReadOnly, this, byteOffset, false, direct);
        }
        return new FloatBuffer(null, -1, 0, count, count, 0, isReadOnly, this, byteOffset, bigEndian, direct);
    }

    static native float[] floatView(byte[] hb, int byteOffset, int count);


    public double getDouble() {
        return getDouble0(hb, offset + nextGetIndex(8), bigEndian);
    }

    public double getDouble(int index) {
        return getDouble0(hb, offset + checkIndex(index, 8), bigEndian);
    }

    public ByteBuffer putDouble(double value) {
        checkWritable();
        putDouble0(hb, offset + nextPutIndex(8), value, bigEndian);
        return this;
    }

    public ByteBuffer putDouble(int index, double value) {
        checkWritable();
        putDouble0(hb, offset + checkIndex(index, 8), value, bigEndian);
        return this;
    }

    static native double getDouble0(byte[] hb, int index, boolean bigEndian);

    static native void putDouble0(byte[] hb, int index, double value, boolean bigEndian);

    public DoubleBuffer asDoubleBuffer() {
        int pos = position();
        int count = remaining() / 8;
        int byteOffset = offset + pos;
        double[] view = bigEndian ? null : doubleView(hb, byteOffset, count);
        if (view != null) {
            return new DoubleBuffer(view, -1, 0, count, count, 0, isReadOnly, this, byteOffset, false, direct);
        }
        return new DoubleBuffer(null, -1, 0, count, count, 0, isReadOnly, this, byteOffset, bigEndian, direct);
    }

    static native double[] doubleView(byte[] hb, int byteOffset, int count);

}
