package java.nio;

public class CharBuffer extends Buffer implements Comparable<CharBuffer>, Appendable, CharSequence, Readable {
    final char[] hb;
    final int offset;
    final boolean isReadOnly;
    final ByteBuffer bb;
    final int byteOffset;
    final boolean bigEndian;
    final boolean direct;

    CharBuffer(char[] hb, int mark, int pos, int lim, int cap, int offset, boolean readOnly, ByteBuffer bb, int byteOffset, boolean bigEndian, boolean direct) {
        super(mark, pos, lim, cap);
        this.hb = hb;
        this.offset = offset;
        this.isReadOnly = readOnly;
        this.bb = bb;
        this.byteOffset = byteOffset;
        this.bigEndian = bigEndian;
        this.direct = direct;
    }

    public static CharBuffer allocate(int capacity) {
        if (capacity < 0) {
            throw new IllegalArgumentException("capacity < 0: (" + capacity + " < 0)");
        }
        return new CharBuffer(new char[capacity], -1, 0, capacity, capacity, 0, false, null, 0, false, false);
    }

    public static CharBuffer wrap(char[] array, int offset, int length) {
        checkFromIndexSize(offset, length, array.length);
        return new CharBuffer(array, -1, offset, offset + length, array.length, 0, false, null, 0, false, false);
    }

    public static CharBuffer wrap(char[] array) {
        return wrap(array, 0, array.length);
    }

    private void checkWritable() {
        if (isReadOnly) {
            throw new ReadOnlyBufferException();
        }
    }

    private char load(int i) {
        if (hb != null) {
            return hb[offset + i];
        }
        return ByteBuffer.getChar0(bb.hb, byteOffset + i * 2, bigEndian);
    }

    private void store(int i, char x) {
        if (hb != null) {
            hb[offset + i] = x;
        } else {
            ByteBuffer.putChar0(bb.hb, byteOffset + i * 2, x, bigEndian);
        }
    }

    private CharBuffer derive(int mark, int pos, int lim, int cap, int start, boolean readOnly) {
        if (hb != null) {
            return new CharBuffer(hb, mark, pos, lim, cap, offset + start, readOnly, bb, byteOffset, bigEndian, direct);
        }
        return new CharBuffer(null, mark, pos, lim, cap, 0, readOnly, bb, byteOffset + start * 2, bigEndian, direct);
    }

    public CharBuffer slice() {
        int pos = this.position();
        int lim = this.limit();
        int rem = (pos <= lim ? lim - pos : 0);
        return derive(-1, 0, rem, rem, pos, isReadOnly);
    }

    public CharBuffer slice(int index, int length) {
        checkFromIndexSize(index, length, limit());
        return derive(-1, 0, length, length, index, isReadOnly);
    }

    public CharBuffer duplicate() {
        return derive(markValue(), position(), limit(), capacity(), 0, isReadOnly);
    }

    public CharBuffer asReadOnlyBuffer() {
        return derive(markValue(), position(), limit(), capacity(), 0, true);
    }

    public char get() {
        return load(nextGetIndex());
    }

    public char get(int index) {
        return load(checkIndex(index));
    }

    public CharBuffer get(char[] dst, int off, int length) {
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

    public CharBuffer get(char[] dst) {
        return get(dst, 0, dst.length);
    }

    public CharBuffer get(int index, char[] dst, int off, int length) {
        checkFromIndexSize(index, length, limit());
        checkFromIndexSize(off, length, dst.length);
        for (int i = 0; i < length; i++) {
            dst[off + i] = load(index + i);
        }
        return this;
    }

    public CharBuffer get(int index, char[] dst) {
        return get(index, dst, 0, dst.length);
    }

    public CharBuffer put(char x) {
        checkWritable();
        store(nextPutIndex(), x);
        return this;
    }

    public CharBuffer put(int index, char x) {
        checkWritable();
        store(checkIndex(index), x);
        return this;
    }

    public CharBuffer put(CharBuffer src) {
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

    public CharBuffer put(int index, CharBuffer src, int off, int length) {
        checkWritable();
        checkFromIndexSize(index, length, limit());
        checkFromIndexSize(off, length, src.limit());
        for (int i = 0; i < length; i++) {
            store(index + i, src.load(off + i));
        }
        return this;
    }

    public CharBuffer put(char[] src, int off, int length) {
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

    public final CharBuffer put(char[] src) {
        return put(src, 0, src.length);
    }

    public CharBuffer put(int index, char[] src, int off, int length) {
        checkWritable();
        checkFromIndexSize(index, length, limit());
        checkFromIndexSize(off, length, src.length);
        for (int i = 0; i < length; i++) {
            store(index + i, src[off + i]);
        }
        return this;
    }

    public CharBuffer put(int index, char[] src) {
        return put(index, src, 0, src.length);
    }

    public final boolean hasArray() {
        return hb != null && bb == null && !isReadOnly;
    }

    public final char[] array() {
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

    public CharBuffer position(int newPosition) {
        super.position(newPosition);
        return this;
    }

    public CharBuffer limit(int newLimit) {
        super.limit(newLimit);
        return this;
    }

    public CharBuffer mark() {
        super.mark();
        return this;
    }

    public CharBuffer reset() {
        super.reset();
        return this;
    }

    public CharBuffer clear() {
        super.clear();
        return this;
    }

    public CharBuffer flip() {
        super.flip();
        return this;
    }

    public CharBuffer rewind() {
        super.rewind();
        return this;
    }

    public CharBuffer compact() {
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
        if (!(ob instanceof CharBuffer)) {
            return false;
        }
        CharBuffer that = (CharBuffer) ob;
        int thisRem = this.limit() - this.position();
        int thatRem = that.limit() - that.position();
        if (thisRem < 0 || thisRem != thatRem) {
            return false;
        }
        return mismatch(that) < 0;
    }

    public int compareTo(CharBuffer that) {
        int thisPos = this.position();
        int thisRem = this.limit() - thisPos;
        int thatPos = that.position();
        int thatRem = that.limit() - thatPos;
        int length = Math.min(thisRem, thatRem);
        for (int i = 0; i < length; i++) {
            int cmp = Character.compare(this.get(thisPos + i), that.get(thatPos + i));
            if (cmp != 0) {
                return cmp;
            }
        }
        return thisRem - thatRem;
    }

    public int mismatch(CharBuffer that) {
        int thisPos = this.position();
        int thisRem = this.limit() - thisPos;
        int thatPos = that.position();
        int thatRem = that.limit() - thatPos;
        int length = Math.min(thisRem, thatRem);
        for (int i = 0; i < length; i++) {
            if (Character.compare(this.get(thisPos + i), that.get(thatPos + i)) != 0) {
                return i;
            }
        }
        return thisRem == thatRem ? -1 : length;
    }

    String str;

    public static CharBuffer wrap(CharSequence csq, int start, int end) {
        checkFromIndexSize(start, end - start, csq.length());
        String s = csq.toString();
        CharBuffer b = new CharBuffer(s.toCharArray(), -1, start, end, s.length(), 0, true, null, 0, false, false);
        return b;
    }

    public static CharBuffer wrap(CharSequence csq) {
        return wrap(csq, 0, csq.length());
    }

    public int read(CharBuffer target) throws java.io.IOException {
        int limit = limit();
        int pos = position();
        int remaining = limit - pos;
        int targetRemaining = target.remaining();
        if (targetRemaining <= 0) {
            return -1;
        }
        if (remaining <= 0) {
            return -1;
        }
        int n = Math.min(remaining, targetRemaining);
        for (int i = 0; i < n; i++) {
            target.put(get());
        }
        return n;
    }

    public String toString() {
        StringBuilder sb = new StringBuilder(remaining());
        int lim = limit();
        for (int i = position(); i < lim; i++) {
            sb.append(get(i));
        }
        return sb.toString();
    }

    public final int length() {
        return remaining();
    }

    public final boolean isEmpty() {
        return remaining() == 0;
    }

    public final char charAt(int index) {
        return get(position() + checkIndex(index, 1));
    }

    public CharBuffer subSequence(int start, int end) {
        int pos = position();
        int lim = limit();
        if (start < 0 || end > lim - pos || start > end) {
            throw new IndexOutOfBoundsException();
        }
        CharBuffer b = duplicate();
        b.limit(pos + end);
        b.position(pos + start);
        return b;
    }

    public CharBuffer put(String src, int start, int end) {
        checkFromIndexSize(start, end - start, src.length());
        if (isReadOnly) {
            throw new ReadOnlyBufferException();
        }
        if (end - start > remaining()) {
            throw new BufferOverflowException();
        }
        for (int i = start; i < end; i++) {
            this.put(src.charAt(i));
        }
        return this;
    }

    public final CharBuffer put(String src) {
        return put(src, 0, src.length());
    }

    public CharBuffer append(CharSequence csq) {
        if (csq == null) {
            return put("null");
        }
        return put(csq.toString());
    }

    public CharBuffer append(CharSequence csq, int start, int end) {
        CharSequence cs = (csq == null ? "null" : csq);
        return put(cs.subSequence(start, end).toString());
    }

    public CharBuffer append(char c) {
        return put(c);
    }

    public java.util.stream.IntStream chars() {
        return toString().chars();
    }
}
