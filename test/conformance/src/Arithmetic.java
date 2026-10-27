public class Arithmetic {
    static int zero = 0;
    static long lzero = 0;

    public static void main(String[] args) {
        int max = Integer.MAX_VALUE, min = Integer.MIN_VALUE;
        System.out.println(max + 1);
        System.out.println(min - 1);
        System.out.println(max * 2);
        System.out.println(min / -1);
        System.out.println(min % -1);
        System.out.println(-7 / 2 + " " + -7 % 2 + " " + 7 / -2 + " " + 7 % -2);
        System.out.println((1 << 33) + " " + (1 << -1) + " " + (-8 >> 1) + " " + (-8 >>> 1) + " " + (-8 >>> 33));
        long lmax = Long.MAX_VALUE, lmin = Long.MIN_VALUE;
        System.out.println(lmax + 1);
        System.out.println(lmin / -1);
        System.out.println(lmin % -1);
        System.out.println(-7L / 2 + " " + -7L % 2);
        System.out.println((1L << 65) + " " + (-8L >> 1) + " " + (-8L >>> 1) + " " + (-8L >>> 65));
        System.out.println(123456789L * 987654321L);
        System.out.println(0x7fffffffffffffffL * 3);
        System.out.println(Long.toHexString(-1L) + " " + Long.toBinaryString(5) + " " + Long.toString(-255, 16));
        System.out.println(Integer.toHexString(-1) + " " + Integer.toBinaryString(10) + " " + Integer.toOctalString(8) + " " + Integer.toString(255, 36));
        System.out.println(Integer.parseInt("-123") + Integer.parseInt("7fffffff", 16) + " " + Long.parseLong("-9223372036854775808"));
        System.out.println(Integer.reverse(1) + " " + Integer.bitCount(255) + " " + Integer.numberOfLeadingZeros(1) + " " + Long.numberOfTrailingZeros(64));
        System.out.println(Integer.compare(3, 5) + " " + Long.compare(5, 3) + " " + Integer.signum(-9) + " " + Integer.highestOneBit(100));
        System.out.println(Integer.divideUnsigned(-1, 2) + " " + Integer.toUnsignedString(-1) + " " + Long.toUnsignedString(-1L) + " " + Long.divideUnsigned(-1L, 3));

        float f = 0.1f;
        double d = 0.1;
        System.out.println(f + " " + d + " " + (f + 0.2f) + " " + (d + 0.2));
        System.out.println(1.0f + " " + 100.0 + " " + 1e7 + " " + 1.0e-3 + " " + 9.999e-4 + " " + 12345678.9f + " " + 1e21 + " " + 1.0E-10f);
        System.out.println(Float.MAX_VALUE + " " + Float.MIN_VALUE + " " + Double.MAX_VALUE + " " + Double.MIN_VALUE);
        System.out.println((0.0 / 0.0) + " " + (1 / 0.0) + " " + (-1 / 0.0) + " " + (-0.0) + " " + (0.0 == -0.0));
        System.out.println(1.0f / 3 + " " + 2.0 / 3 + " " + (float) Math.PI + " " + Math.E);
        System.out.println(100.0f / 7 + " " + 3.0e10f + " " + 123.456 + " " + 1.0E23 + " " + 2.5e-5);
        double nan = Double.NaN;
        System.out.println((nan < 1) + " " + (nan > 1) + " " + (nan == nan) + " " + (nan != nan) + " " + Double.compare(nan, 1) + " " + Double.isNaN(nan));
        System.out.println((int) 3.99 + " " + (int) -3.99 + " " + (int) 1e20 + " " + (int) -1e20 + " " + (int) Double.NaN + " " + (long) 1e30 + " " + (long) -2.5);
        System.out.println((int) 3.7f + " " + (long) Float.POSITIVE_INFINITY + " " + (char) 65 + " " + (int) 'z' + " " + (byte) 200 + " " + (short) 70000 + " " + (char) -1 + 0);
        System.out.println((float) 1e40 + " " + (float) 1.23456789 + " " + (double) 1.1f + " " + (long) Long.MAX_VALUE + " " + (float) Long.MAX_VALUE + " " + (double) Long.MIN_VALUE);
        System.out.println(5.5 % 2 + " " + -5.5 % 2 + " " + 5.5f % 2.5f + " " + 1e300 * 1e10);
        System.out.println(Math.floor(-1.5) + " " + Math.ceil(-1.5) + " " + Math.round(-1.5) + " " + Math.round(2.5) + " " + Math.round(-2.5f) + " " + Math.rint(2.5) + " " + Math.rint(3.5));
        System.out.println(Math.abs(-0.0) + " " + Math.max(-0.0, 0.0) + " " + Math.min(-0.0, 0.0) + " " + Math.abs(Integer.MIN_VALUE) + " " + Math.sqrt(2) + " " + Math.pow(2, 0.5));
        System.out.println(Math.floorDiv(-7, 2) + " " + Math.floorMod(-7, 2) + " " + Math.hypot(3, 4) + " " + Math.signum(-2.5) + " " + Math.toDegrees(Math.PI) + " " + Math.cbrt(27));
        System.out.println(Float.floatToIntBits(1.5f) + " " + Float.intBitsToFloat(0x40490fdb) + " " + Double.doubleToLongBits(-2.0) + " " + Double.longBitsToDouble(0x3ff8000000000000L));
        System.out.println(Double.parseDouble("1e-5") + " " + Float.parseFloat("3.4028235e38") + " " + Double.valueOf("  -12.5  ") + " " + Double.parseDouble("0x1.8p1") + " " + Float.parseFloat("1.5f"));
        System.out.println(Integer.MAX_VALUE + 1.0f + " " + (0.1 + 0.7) * 10 + " " + (int) ((0.1 + 0.7) * 10));
        char c = 'A';
        c += 2;
        c++;
        System.out.println(c + " " + (c + 1) + " " + (char) (c + 1) + " " + Character.toLowerCase(c) + Character.getNumericValue('7'));
        byte b = 127;
        b++;
        short s = -32768;
        s--;
        System.out.println(b + " " + s);
        int x = 5;
        x += 3.7;
        System.out.println(x + " " + (x++ + ++x) + " " + x);
        try {
            System.out.println(1 / zero);
        } catch (ArithmeticException e) {
            System.out.println("caught " + e.getMessage());
        }
        try {
            System.out.println(5 % zero);
        } catch (ArithmeticException e) {
            System.out.println("caught " + e.getMessage());
        }
        try {
            System.out.println(1L / lzero);
        } catch (ArithmeticException e) {
            System.out.println("caught " + e.getMessage());
        }
        System.out.println(Math.addExact(1, 2) + " " + Math.multiplyHigh(Long.MAX_VALUE, 4));
        try {
            Math.addExact(Integer.MAX_VALUE, 1);
        } catch (ArithmeticException e) {
            System.out.println("caught " + e.getMessage());
        }
        System.out.println(Integer.valueOf(127) == Integer.valueOf(127));
        System.out.println(Integer.valueOf(128) == Integer.valueOf(128));
        System.out.println(Long.valueOf(5).equals(5L) + " " + Integer.valueOf(5).equals(5L) + " " + Double.hashCode(1.5) + " " + Boolean.hashCode(true) + " " + Long.hashCode(-5L) + " " + Float.hashCode(2.5f));
    }
}
