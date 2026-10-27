import java.util.Arrays;
import java.util.Locale;

public class Strings {
    public static void main(String[] args) {
        String s = "Hello, World";
        Object nothing = null;
        char ch = 'x';
        System.out.println(s + 1 + 2 + " " + (1 + 2) + s + " " + ch + true + nothing + 1.5f + 2.5 + 3L + 'c');
        System.out.println(s.length() + " " + s.charAt(4) + " " + s.indexOf('o') + " " + s.indexOf("o", 5) + " " + s.lastIndexOf('o') + " " + s.indexOf("xyz") + " " + s.lastIndexOf("o", 3));
        System.out.println(s.substring(7) + "|" + s.substring(0, 5) + "|" + s.toUpperCase() + "|" + s.toLowerCase() + "|" + s.replace('l', 'L') + "|" + s.replace("World", "There"));
        System.out.println(s.contains("lo,") + " " + s.startsWith("Hell") + " " + s.endsWith("ld") + " " + s.startsWith("o", 4) + " " + s.isEmpty() + " " + "".isEmpty() + " " + "  ".isBlank());
        System.out.println("[" + "  padded \t\n".trim() + "] [" + " x ".strip() + "] [" + " y ".stripLeading() + "] [" + " z ".stripTrailing() + "]");
        System.out.println(Arrays.toString("a,b,,c,,".split(",")) + " " + Arrays.toString("a,b,,c,,".split(",", -1)) + " " + Arrays.toString("a1b22c333".split("\\d+")) + " " + Arrays.toString(" x  y ".split("\\s+")) + " " + Arrays.toString("a.b.c".split("\\.", 2)) + " " + Arrays.toString("".split(",")));
        System.out.println("a-b_c".replaceAll("[-_]", "+") + " " + "aaa".replaceFirst("a", "b") + " " + "x1y2".replaceAll("(\\w)(\\d)", "$2$1") + " " + "abc".replace("", "-") + " " + "abc".matches("[a-c]+"));
        System.out.println(String.join("|", "a", "b", "c") + " " + String.join(",", Arrays.asList("x", "y")) + " " + "ab".repeat(3) + " " + String.valueOf(new char[] {'h', 'i'}) + " " + new String(new char[] {'a', 'b', 'c'}, 1, 2));
        System.out.println("abc".compareTo("abd") + " " + "abc".compareTo("ab") + " " + "B".compareToIgnoreCase("a") + " " + "Hello".equalsIgnoreCase("hELLO") + " " + "hello".hashCode() + " " + "".hashCode() + " " + "été".hashCode());
        String a = "hel" + "lo";
        String b = "hello";
        String c = new String("hello");
        System.out.println((a == b) + " " + b.equals(c) + " " + (c.intern() == b));
        StringBuilder sb = new StringBuilder("start");
        sb.append(1).append('c').append(2.5).append(true).append((Object) null).append(new char[] {'z'}).append(3L).append(1.5f);
        System.out.println(sb + " " + sb.length() + " " + sb.charAt(2) + " " + sb.indexOf("1"));
        sb.insert(0, "[").insert(sb.length(), ']').reverse();
        System.out.println(sb);
        sb.setLength(5);
        sb.setCharAt(0, 'Q');
        sb.deleteCharAt(1).delete(0, 1).replace(0, 1, "RR");
        System.out.println(sb + " " + new StringBuilder("racecar").reverse() + " " + new StringBuffer("buf").append(1).insert(0, 0));
        System.out.println(String.format("%d|%5d|%-5d|%05d|%x|%X|%o|%,d|%+d", 42, 42, 42, 42, 255, 255, 8, 1234567, 5));
        System.out.println(String.format("%.2f|%8.3f|%-8.1f|%e|%.0f|%10.4e|%g", 3.14159, 2.5, 1.25, 12345.678, 2.5, 0.000123, 0.0001));
        System.out.println(String.format("%s|%10s|%-10s|%c|%b|%%|%n", "str", "right", "left", 'c', null).trim());
        System.out.println(String.format(Locale.ROOT, "%.3f %s %S", 1.0005, Arrays.asList(1, 2), "up"));
        System.out.println(String.format("%08.3f|%(d|% d|%#x", -3.14159, -5, 5, 255));
        String unicode = "aé中😀z";
        System.out.println(unicode.length() + " " + unicode.codePointCount(0, unicode.length()) + " " + unicode.codePointAt(3) + " " + (int) unicode.charAt(3) + " " + unicode.toUpperCase() + " " + new StringBuilder(unicode).reverse().toString().equals("z😀中éa"));
        System.out.println(Arrays.toString(unicode.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        System.out.println(new String(new byte[] {(byte) 0xe4, (byte) 0xb8, (byte) 0xad, 65}, java.nio.charset.StandardCharsets.UTF_8) + " " + new String(new byte[] {72, 105}));
        System.out.println(Character.isLetter('x') + " " + Character.isDigit('5') + " " + Character.isWhitespace('\t') + " " + Character.isUpperCase('a') + " " + Character.toUpperCase('q') + " " + Character.isLetterOrDigit('_') + " " + Character.isLetter('é') + " " + Character.toChars(0x1F600).length);
        switch (s.substring(0, 5)) {
            case "Hello":
                System.out.println("switch hello");
                break;
            default:
                System.out.println("switch default");
        }
        char[] chars = s.toCharArray();
        Arrays.sort(chars);
        System.out.println(new String(chars).trim() + " " + s.chars().filter(Character::isUpperCase).count());
        System.out.println("x".concat("y") + " " + "abc".contentEquals(new StringBuilder("abc")) + " " + "Mississippi".lastIndexOf("ss") + " " + "Mississippi".indexOf("ss", 3) + " " + "a\tb".length());
        System.out.println(String.valueOf(3.0f) + String.valueOf(true) + String.valueOf('c') + String.valueOf(10L) + Integer.toString(7) + Double.toString(0.5));
    }
}
