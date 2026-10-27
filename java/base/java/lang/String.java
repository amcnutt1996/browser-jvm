package java.lang;

import java.io.Serializable;
import java.io.UnsupportedEncodingException;
import java.nio.charset.Charset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Formatter;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.StringJoiner;
import java.util.regex.Pattern;
import java.util.stream.IntStream;
import java.util.stream.Stream;

/**
 * Strings are JavaScript strings in this runtime. Constructors and most
 * methods are implemented natively; the constructors' bodies never run.
 */
public final class String implements Serializable, Comparable<String>, CharSequence {
    static final boolean COMPACT_STRINGS = true;
    static final byte LATIN1 = 0;
    static final byte UTF16 = 1;

    public static final Comparator<String> CASE_INSENSITIVE_ORDER = new CaseInsensitiveComparator();

    private static class CaseInsensitiveComparator implements Comparator<String>, Serializable {
        public int compare(String s1, String s2) {
            return s1.compareToIgnoreCase(s2);
        }
    }

    public String() {
    }

    public String(String original) {
    }

    public String(char[] value) {
    }

    public String(char[] value, int offset, int count) {
    }

    public String(int[] codePoints, int offset, int count) {
    }

    @Deprecated(since = "1.1")
    public String(byte[] ascii, int hibyte, int offset, int count) {
    }

    @Deprecated(since = "1.1")
    public String(byte[] ascii, int hibyte) {
    }

    public String(byte[] bytes, int offset, int length, String charsetName) throws UnsupportedEncodingException {
    }

    public String(byte[] bytes, int offset, int length, Charset charset) {
    }

    public String(byte[] bytes, String charsetName) throws UnsupportedEncodingException {
    }

    public String(byte[] bytes, Charset charset) {
    }

    public String(byte[] bytes, int offset, int length) {
    }

    public String(byte[] bytes) {
    }

    public String(StringBuffer buffer) {
    }

    public String(StringBuilder builder) {
    }

    String(byte[] value, byte coder) {
    }

    public native int length();

    public native boolean isEmpty();

    public native char charAt(int index);

    public native int codePointAt(int index);

    public native int codePointBefore(int index);

    public native int codePointCount(int beginIndex, int endIndex);

    public native int offsetByCodePoints(int index, int codePointOffset);

    public native void getChars(int srcBegin, int srcEnd, char[] dst, int dstBegin);

    @Deprecated(since = "1.1")
    public native void getBytes(int srcBegin, int srcEnd, byte[] dst, int dstBegin);

    public byte[] getBytes(String charsetName) throws UnsupportedEncodingException {
        if (charsetName == null) {
            throw new NullPointerException();
        }
        return getBytes0(charsetName);
    }

    public byte[] getBytes(Charset charset) {
        if (charset == null) {
            throw new NullPointerException();
        }
        return getBytes0(charset.name());
    }

    public byte[] getBytes() {
        return getBytes0("UTF-8");
    }

    private native byte[] getBytes0(String charsetName);

    public native boolean equals(Object anObject);

    public boolean contentEquals(StringBuffer sb) {
        return contentEquals((CharSequence) sb);
    }

    public boolean contentEquals(CharSequence cs) {
        return equals(cs.toString());
    }

    public native boolean equalsIgnoreCase(String anotherString);

    public native int compareTo(String anotherString);

    public native int compareToIgnoreCase(String str);

    public native boolean regionMatches(int toffset, String other, int ooffset, int len);

    public native boolean regionMatches(boolean ignoreCase, int toffset, String other, int ooffset, int len);

    public native boolean startsWith(String prefix, int toffset);

    public native boolean startsWith(String prefix);

    public native boolean endsWith(String suffix);

    public native int hashCode();

    public native int indexOf(int ch);

    public native int indexOf(int ch, int fromIndex);

    public int indexOf(int ch, int beginIndex, int endIndex) {
        int index = indexOf(ch, beginIndex);
        return index >= endIndex ? -1 : index;
    }

    public native int lastIndexOf(int ch);

    public native int lastIndexOf(int ch, int fromIndex);

    public native int indexOf(String str);

    public native int indexOf(String str, int fromIndex);

    public native int lastIndexOf(String str);

    public native int lastIndexOf(String str, int fromIndex);

    public native String substring(int beginIndex);

    public native String substring(int beginIndex, int endIndex);

    public CharSequence subSequence(int beginIndex, int endIndex) {
        return substring(beginIndex, endIndex);
    }

    public native String concat(String str);

    public native String replace(char oldChar, char newChar);

    public boolean matches(String regex) {
        return Pattern.matches(regex, this);
    }

    public boolean contains(CharSequence s) {
        return indexOf(s.toString()) >= 0;
    }

    public String replaceFirst(String regex, String replacement) {
        return Pattern.compile(regex).matcher(this).replaceFirst(replacement);
    }

    public String replaceAll(String regex, String replacement) {
        return Pattern.compile(regex).matcher(this).replaceAll(replacement);
    }

    public String replace(CharSequence target, CharSequence replacement) {
        return replace0(target.toString(), replacement.toString());
    }

    private native String replace0(String target, String replacement);

    public String[] split(String regex, int limit) {
        String[] fast = splitFast(regex, limit);
        if (fast != null) {
            return fast;
        }
        return Pattern.compile(regex).split(this, limit);
    }

    private native String[] splitFast(String regex, int limit);

    public String[] split(String regex) {
        return split(regex, 0);
    }

    public static String join(CharSequence delimiter, CharSequence... elements) {
        Objects.requireNonNull(delimiter);
        Objects.requireNonNull(elements);
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < elements.length; i++) {
            if (i > 0) {
                sb.append(delimiter);
            }
            sb.append(elements[i]);
        }
        return sb.toString();
    }

    public static String join(CharSequence delimiter, Iterable<? extends CharSequence> elements) {
        Objects.requireNonNull(delimiter);
        Objects.requireNonNull(elements);
        StringBuilder sb = new StringBuilder();
        boolean first = true;
        for (CharSequence cs : elements) {
            if (!first) {
                sb.append(delimiter);
            }
            sb.append(cs);
            first = false;
        }
        return sb.toString();
    }

    public String toLowerCase(Locale locale) {
        return toLowerCase();
    }

    public native String toLowerCase();

    public String toUpperCase(Locale locale) {
        return toUpperCase();
    }

    public native String toUpperCase();

    public native String trim();

    public native String strip();

    public native String stripLeading();

    public native String stripTrailing();

    public native boolean isBlank();

    public Stream<String> lines() {
        List<String> list = new ArrayList<>();
        for (String line : split("\r\n|\r|\n", -1)) {
            list.add(line);
        }
        if (!list.isEmpty() && list.get(list.size() - 1).isEmpty()) {
            list.remove(list.size() - 1);
        }
        return list.stream();
    }

    public String indent(int n) {
        if (isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        Iterator<String> it = lines().iterator();
        while (it.hasNext()) {
            String line = it.next();
            if (n > 0) {
                sb.append(" ".repeat(n)).append(line);
            } else if (n < 0) {
                int strip = 0;
                while (strip < -n && strip < line.length() && Character.isWhitespace(line.charAt(strip))) {
                    strip++;
                }
                sb.append(line.substring(strip));
            } else {
                sb.append(line);
            }
            sb.append('\n');
        }
        return sb.toString();
    }

    public String toString() {
        return this;
    }

    public IntStream chars() {
        int[] values = new int[length()];
        for (int i = 0; i < values.length; i++) {
            values[i] = charAt(i);
        }
        return java.util.Arrays.stream(values);
    }

    public IntStream codePoints() {
        return java.util.Arrays.stream(codePointArray());
    }

    private native int[] codePointArray();

    public native char[] toCharArray();

    public static String format(String format, Object... args) {
        return new Formatter().format(format, args).toString();
    }

    public static String format(Locale l, String format, Object... args) {
        return new Formatter(l).format(format, args).toString();
    }

    public String formatted(Object... args) {
        return new Formatter().format(this, args).toString();
    }

    public static String valueOf(Object obj) {
        return (obj == null) ? "null" : obj.toString();
    }

    public static native String valueOf(char[] data);

    public static native String valueOf(char[] data, int offset, int count);

    public static String copyValueOf(char[] data, int offset, int count) {
        return valueOf(data, offset, count);
    }

    public static String copyValueOf(char[] data) {
        return valueOf(data);
    }

    public static String valueOf(boolean b) {
        return b ? "true" : "false";
    }

    public static native String valueOf(char c);

    public static native String valueOf(int i);

    public static native String valueOf(long l);

    public static native String valueOf(float f);

    public static native String valueOf(double d);

    public native String intern();

    public native String repeat(int count);

    native byte coder();

    native byte[] value();

    boolean isLatin1() {
        return coder() == LATIN1;
    }

    static void checkIndex(int index, int length) {
        if (index < 0 || index >= length) {
            throw new StringIndexOutOfBoundsException("index " + index + ", length " + length);
        }
    }

    static void checkOffset(int offset, int length) {
        if (offset < 0 || offset > length) {
            throw new StringIndexOutOfBoundsException("offset " + offset + ", length " + length);
        }
    }

    static void checkBoundsBeginEnd(int begin, int end, int length) {
        if (begin < 0 || begin > end || end > length) {
            throw new StringIndexOutOfBoundsException("begin " + begin + ", end " + end + ", length " + length);
        }
    }

    static void checkBoundsOffCount(int offset, int count, int length) {
        if (offset < 0 || count < 0 || offset > length - count) {
            throw new StringIndexOutOfBoundsException("offset " + offset + ", count " + count + ", length " + length);
        }
    }

    static String valueOfCodePoint(int codePoint) {
        return new String(Character.toChars(codePoint));
    }
}
