package java.lang;

import java.io.Serializable;

public final class StringBuffer extends AbstractStringBuilder implements Serializable, Comparable<StringBuffer>, CharSequence {
    public StringBuffer() {
        value = "";
    }

    public StringBuffer(int capacity) {
        if (capacity < 0) {
            throw new NegativeArraySizeException(String.valueOf(capacity));
        }
        value = "";
    }

    public StringBuffer(String str) {
        value = str.toString();
    }

    public StringBuffer(CharSequence seq) {
        value = seq.toString();
    }

    public native StringBuffer append(String str);
    public StringBuffer append(Object obj) {
        return append(String.valueOf(obj));
    }
    public StringBuffer append(StringBuffer sb) {
        return append(String.valueOf(sb));
    }
    public StringBuffer append(CharSequence s) {
        return append(String.valueOf(s));
    }
    public StringBuffer append(CharSequence s, int start, int end) {
        if (s == null) {
            s = "null";
        }
        return append(s.subSequence(start, end).toString());
    }
    public native StringBuffer append(char[] str);
    public native StringBuffer append(char[] str, int offset, int len);
    public native StringBuffer append(boolean b);
    public native StringBuffer append(char c);
    public native StringBuffer append(int i);
    public native StringBuffer append(long lng);
    public native StringBuffer append(float f);
    public native StringBuffer append(double d);
    public native StringBuffer appendCodePoint(int codePoint);
    public native StringBuffer delete(int start, int end);
    public native StringBuffer deleteCharAt(int index);
    public native StringBuffer replace(int start, int end, String str);
    public native StringBuffer insert(int index, char[] str, int offset, int len);
    public StringBuffer insert(int offset, Object obj) {
        return insert(offset, String.valueOf(obj));
    }
    public native StringBuffer insert(int offset, String str);
    public native StringBuffer insert(int offset, char[] str);
    public StringBuffer insert(int dstOffset, CharSequence s) {
        return insert(dstOffset, String.valueOf(s));
    }
    public StringBuffer insert(int dstOffset, CharSequence s, int start, int end) {
        if (s == null) {
            s = "null";
        }
        return insert(dstOffset, s.subSequence(start, end).toString());
    }
    public StringBuffer insert(int offset, boolean b) {
        return insert(offset, String.valueOf(b));
    }
    public native StringBuffer insert(int offset, char c);
    public StringBuffer insert(int offset, int i) {
        return insert(offset, String.valueOf(i));
    }
    public StringBuffer insert(int offset, long l) {
        return insert(offset, String.valueOf(l));
    }
    public StringBuffer insert(int offset, float f) {
        return insert(offset, String.valueOf(f));
    }
    public StringBuffer insert(int offset, double d) {
        return insert(offset, String.valueOf(d));
    }
    public native int indexOf(String str);
    public native int indexOf(String str, int fromIndex);
    public native int lastIndexOf(String str);
    public native int lastIndexOf(String str, int fromIndex);
    public native StringBuffer reverse();
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
    public int compareTo(StringBuffer another) {
        return toString().compareTo(another.toString());
    }
    public java.util.stream.IntStream chars() {
        return toString().chars();
    }
    public java.util.stream.IntStream codePoints() {
        return toString().codePoints();
    }
}
