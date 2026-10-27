import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.util.*;
import java.util.regex.*;

public class Text {
    public static void main(String[] args) {
        Pattern p = Pattern.compile("(\\w+)@(\\w+)\\.com");
        Matcher m = p.matcher("mail bob@example.com and amy@test.com now");
        while (m.find()) System.out.println(m.group() + " user=" + m.group(1) + " host=" + m.group(2) + " at " + m.start() + "-" + m.end());
        System.out.println("2024-01-15".matches("\\d{4}-\\d{2}-\\d{2}") + " " + Pattern.compile("^a.*z$", Pattern.CASE_INSENSITIVE).matcher("AbcZ").matches() + " " + "a1b2c3".replaceAll("\\d", "#") + " " + Pattern.quote("a.b"));
        Matcher named = Pattern.compile("(?<key>[a-z]+)=(?<val>\\d+)").matcher("x=1, yy=22");
        StringBuilder sb = new StringBuilder();
        while (named.find()) sb.append(named.group("key")).append("->").append(named.group("val")).append(' ');
        System.out.println(sb.toString().trim() + " " + Arrays.toString(Pattern.compile("[,;]\\s*").split("a, b;c,  d")));
        System.out.println(Pattern.compile("(a)(b)?").matcher("a").replaceAll("[$1|$2]") + " " + "tab\tsep".split("\t").length + " " + "CamelCaseString".replaceAll("([A-Z])", "_$1").toLowerCase());
        Matcher greedy = Pattern.compile("<.+?>").matcher("<a><b></b></a>");
        int tags = 0;
        while (greedy.find()) tags++;
        System.out.println(tags + " " + "aaa".replaceAll("a*", "X") + " " + "hello world".replaceAll("(?<=o) ", "_"));
        BigInteger big = BigInteger.valueOf(2).pow(100);
        System.out.println(big + " " + big.mod(BigInteger.valueOf(97)) + " " + new BigInteger("123456789012345678901234567890").multiply(BigInteger.TEN).subtract(BigInteger.ONE) + " " + big.bitLength() + " " + BigInteger.valueOf(-17).gcd(BigInteger.valueOf(51)));
        BigDecimal dec = new BigDecimal("10.25");
        System.out.println(dec.add(new BigDecimal("0.75")) + " " + dec.multiply(dec) + " " + dec.divide(new BigDecimal("3"), 5, RoundingMode.HALF_UP) + " " + dec.setScale(1, RoundingMode.HALF_EVEN) + " " + new BigDecimal(0.1).toString().substring(0, 12) + " " + BigDecimal.valueOf(2.5).compareTo(new BigDecimal("2.50")));
        System.out.println(String.format("%,.2f", 1234567.891) + " " + String.format("%.3e", 6.02214076e23) + " " + String.format("%10.3f|", Math.E) + " " + String.format("%-6sEND", "ab") + " " + String.format("%3$s %1$s %2$s", "a", "b", "c"));
        System.out.println(Integer.toString(42, 2) + " " + Integer.valueOf("-0") + " " + Long.valueOf("123") + " " + Short.parseShort("-300") + " " + Byte.parseByte("7f", 16) + " " + Integer.decode("0x1F") + " " + Integer.decode("-010"));
        StringTokenizer tok = new StringTokenizer("a b,c", " ,");
        StringBuilder toks = new StringBuilder();
        while (tok.hasMoreTokens()) toks.append(tok.nextToken()).append('/');
        System.out.println(toks + " " + tok.countTokens());
        Scanner sc = new Scanner("12 apples and 3.5 pears");
        int count = sc.nextInt();
        String what = sc.next();
        sc.next();
        double more = sc.nextDouble();
        System.out.println(count + " " + what + " " + more + " " + sc.hasNext() + " " + sc.next() + " " + sc.hasNext());
        char[] cs = {'d', 'a', 'c', 'b'};
        Arrays.sort(cs);
        System.out.println(new String(cs) + " " + Character.isJavaIdentifierStart('$') + " " + Character.digit('f', 16) + " " + Character.forDigit(11, 16) + " " + Character.getType('A') + " " + (int) Character.MAX_VALUE);
        UUID uuid = UUID.fromString("123e4567-e89b-12d3-a456-426614174000");
        System.out.println(uuid + " " + uuid.version() + " " + UUID.nameUUIDFromBytes("x".getBytes()).toString().length());
        System.out.println(Objects.toString(null, "dflt") + " " + Objects.requireNonNullElse(null, "else") + " " + Objects.hashCode(null) + " " + Objects.compare("a", "b", Comparator.naturalOrder()));
        System.out.println(String.valueOf((Object) null) + " " + Boolean.parseBoolean("TRUE") + " " + Boolean.parseBoolean("yes") + " " + Boolean.valueOf(false) + " " + Boolean.logicalXor(true, false));
        Locale.setDefault(Locale.ROOT);
        System.out.println(String.format("%.2f", 0.125) + " " + String.format("%.1f", 0.05) + " " + String.format("%.0f", 0.5) + " " + String.format("%.0f", 1.5) + " " + String.format("%5.1f%%", 99.44));
    }
}
