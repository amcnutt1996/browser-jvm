package java.lang;

import java.io.Serializable;

public final class StringBuilder extends AbstractStringBuilder implements Serializable, Comparable<StringBuilder>, CharSequence {
    public StringBuilder() {
        value = "";
    }

    public StringBuilder(int capacity) {
        if (capacity < 0) {
            throw new NegativeArraySizeException(String.valueOf(capacity));
        }
        value = "";
    }

    public StringBuilder(String str) {
        value = str.toString();
    }

    public StringBuilder(CharSequence seq) {
        value = seq.toString();
    }

    public native StringBuilder append(String str);
    public StringBuilder append(Object obj) {
        return append(String.valueOf(obj));
    }
    public StringBuilder append(StringBuffer sb) {
        return append(String.valueOf(sb));
    }
    public StringBuilder append(CharSequence s) {
        return append(String.valueOf(s));
    }
    public StringBuilder append(CharSequence s, int start, int end) {
        if (s == null) {
            s = "null";
        }
        return append(s.subSequence(start, end).toString());
    }
    public native StringBuilder append(char[] str);
    public native StringBuilder append(char[] str, int offset, int len);
    public native StringBuilder append(boolean b);
    public native StringBuilder append(char c);
    public native StringBuilder append(int i);
    public native StringBuilder append(long lng);
    public native StringBuilder append(float f);
    public native StringBuilder append(double d);
    public native StringBuilder appendCodePoint(int codePoint);
    public native StringBuilder delete(int start, int end);
    public native StringBuilder deleteCharAt(int index);
    public native StringBuilder replace(int start, int end, String str);
    public native StringBuilder insert(int index, char[] str, int offset, int len);
    public StringBuilder insert(int offset, Object obj) {
        return insert(offset, String.valueOf(obj));
    }
    public native StringBuilder insert(int offset, String str);
    public native StringBuilder insert(int offset, char[] str);
    public StringBuilder insert(int dstOffset, CharSequence s) {
        return insert(dstOffset, String.valueOf(s));
    }
    public StringBuilder insert(int dstOffset, CharSequence s, int start, int end) {
        if (s == null) {
            s = "null";
        }
        return insert(dstOffset, s.subSequence(start, end).toString());
    }
    public StringBuilder insert(int offset, boolean b) {
        return insert(offset, String.valueOf(b));
    }
    public native StringBuilder insert(int offset, char c);
    public StringBuilder insert(int offset, int i) {
        return insert(offset, String.valueOf(i));
    }
    public StringBuilder insert(int offset, long l) {
        return insert(offset, String.valueOf(l));
    }
    public StringBuilder insert(int offset, float f) {
        return insert(offset, String.valueOf(f));
    }
    public StringBuilder insert(int offset, double d) {
        return insert(offset, String.valueOf(d));
    }
    public native int indexOf(String str);
    public native int indexOf(String str, int fromIndex);
    public native int lastIndexOf(String str);
    public native int lastIndexOf(String str, int fromIndex);
    public native StringBuilder reverse();
    public native String toString();
    public native int length();
    public native int capacity();
    public void ensureCapacity(int minimumCapacity) {
    }
    public void trimToSize() {
    }
    public native void setLength(int newLength);
    public native char charAt(int index);
    public native int codePointAt(int index);
    public native int codePointBefore(int index);
    public native int codePointCount(int beginIndex, int endIndex);
    public native int offsetByCodePoints(int index, int codePointOffset);
    public native void getChars(int srcBegin, int srcEnd, char[] dst, int dstBegin);
    public native void setCharAt(int index, char ch);
    public native String substring(int start);
    public native String substring(int start, int end);
    public CharSequence subSequence(int start, int end) {
        return substring(start, end);
    }
    public int compareTo(StringBuilder another) {
        return toString().compareTo(another.toString());
    }
    public java.util.stream.IntStream chars() {
        return toString().chars();
    }
    public java.util.stream.IntStream codePoints() {
        return toString().codePoints();
    }
}
