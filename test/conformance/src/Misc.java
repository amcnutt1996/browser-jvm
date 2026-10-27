import java.util.Arrays;

public class Misc {
    static int sumAll(int... values) {
        int s = 0;
        for (int v : values) s += v;
        return s;
    }

    static String describe(Object... parts) {
        return parts.length + ":" + Arrays.toString(parts);
    }

    static int table(int x) {
        switch (x) {
            case 0: return 10;
            case 1: return 11;
            case 2: return 12;
            case 3: return 13;
            case 5: return 15;
            default: return -1;
        }
    }

    static int lookup(int x) {
        switch (x) {
            case -1000: return 1;
            case 7: return 2;
            case 99999: return 3;
            default: return 0;
        }
    }

    static long fib(int n) {
        long a = 0, b = 1;
        for (int i = 0; i < n; i++) {
            long t = a + b;
            a = b;
            b = t;
        }
        return a;
    }

    static int recursiveFib(int n) {
        return n < 2 ? n : recursiveFib(n - 1) + recursiveFib(n - 2);
    }

    public static void main(String[] args) {
        int[][] grid = new int[3][4];
        for (int i = 0; i < 3; i++) for (int j = 0; j < 4; j++) grid[i][j] = i * j;
        System.out.println(Arrays.deepToString(grid) + " " + grid.length + " " + grid[0].length);
        int[][] jagged = {{1}, {2, 3}, {}};
        long[][][] cube = new long[2][2][2];
        cube[1][1][1] = Long.MIN_VALUE;
        String[][] strs = new String[2][];
        System.out.println(Arrays.deepToString(jagged) + " " + cube[1][1][1] + " " + strs[1] + " " + Arrays.deepToString(new boolean[2][1]) + " " + new char[2][3][0].length);
        int[] src = {1, 2, 3, 4, 5};
        int[] copy = src.clone();
        copy[0] = 99;
        System.arraycopy(src, 0, src, 1, 4);
        System.out.println(Arrays.toString(src) + " " + Arrays.toString(copy) + " " + Arrays.toString(Arrays.copyOf(copy, 7)) + " " + Arrays.toString(Arrays.copyOfRange(copy, 1, 3)) + " " + Arrays.equals(src, copy));
        double[] filled = new double[3];
        Arrays.fill(filled, 2.5);
        Object[] objs = new Object[2];
        objs[0] = "s";
        System.out.println(Arrays.toString(filled) + " " + Arrays.toString(objs) + " " + Arrays.asList(1, 2).getClass().getSimpleName() + " " + new int[0].getClass() + " " + Arrays.toString(new float[] {1.5f}));
        System.out.println(sumAll() + " " + sumAll(1, 2, 3) + " " + describe("a", 1, null) + " " + describe() + " " + describe((Object[]) new String[] {"x", "y"}));
        StringBuilder sw = new StringBuilder();
        for (int i = -1; i < 7; i++) sw.append(table(i)).append(',');
        sw.append(' ');
        for (int x : new int[] {-1000, 7, 99999, 8}) sw.append(lookup(x)).append(',');
        System.out.println(sw);
        outer:
        for (int i = 0; i < 5; i++) {
            for (int j = 0; j < 5; j++) {
                if (j == 3) continue outer;
                if (i == 3) break outer;
                System.out.print(i + "" + j + " ");
            }
        }
        System.out.println();
        System.out.println(fib(90) + " " + recursiveFib(20));
        Integer boxed = 1000;
        int unboxed = boxed;
        Long lb = 5L;
        Character cb = 'z';
        Boolean bb = true;
        Double db = 1.5;
        System.out.println((boxed == 1000) + " " + boxed.equals(unboxed) + " " + (lb + unboxed) + " " + (char) (cb + 1) + " " + (bb ? 1 : 0) + " " + (db * 2) + " " + Integer.valueOf(-128).equals(Integer.valueOf(-128)) + " " + (Integer.valueOf(-128) == Integer.valueOf(-128)));
        try {
            Integer missing = null;
            int bad = missing;
        } catch (NullPointerException e) {
            System.out.println("unboxing NPE");
        }
        Object arr = new int[] {1, 2};
        System.out.println((arr instanceof int[]) + " " + (arr instanceof Object[]) + " " + (new String[0] instanceof Object[]) + " " + (new Integer[0] instanceof Number[]) + " " + int[].class.isArray() + " " + String[].class.getComponentType());
        long start = System.currentTimeMillis();
        long nano = System.nanoTime();
        System.out.println((start > 1500000000000L) + " " + (System.nanoTime() >= nano) + " " + (System.getProperty("line.separator").equals("\n")) + " " + System.getProperty("does.not.exist", "default") + " " + (System.getenv("DOES_NOT_EXIST") == null));
        char[] letters = new char[26];
        for (char c = 'a'; c <= 'z'; c++) letters[c - 'a'] = (char) (c ^ 0x20);
        System.out.println(new String(letters));
        int bits = 0b1010_1010;
        long hex = 0xCAFE_BABEL;
        System.out.println(bits + " " + hex + " " + 1_000_000 + " " + 017 + " " + (bits & 0xF) + " " + (bits | 1) + " " + (~bits) + " " + (bits ^ 0xFF));
        int x = 10;
        x <<= 2;
        x >>>= 1;
        x %= 7;
        x *= -3;
        System.out.println(x + " " + (x > 0 ? "pos" : x < 0 ? "neg" : "zero"));
        final int[] holder = {1};
        holder[0] += holder[0]++ + ++holder[0];
        System.out.println(holder[0]);
        System.out.println(Integer.MAX_VALUE + Integer.MAX_VALUE + " " + (byte) (127 + 1) + " " + (short) 32768 + " " + (int) 'A' + 'B');
        String text = null;
        System.out.println("null concat " + text + " " + (text == null));
        Object[] mixed = {1, 2L, 3.0f, 4.0, (short) 5, (byte) 6, '7', "8", true};
        StringBuilder types = new StringBuilder();
        for (Object o : mixed) types.append(o.getClass().getSimpleName().charAt(0));
        System.out.println(types);
        int h = 0;
        for (int i = 0; i < 100000; i++) h = 31 * h + i;
        System.out.println(h);
        double acc = 0;
        for (int i = 1; i <= 1000; i++) acc += 1.0 / i;
        System.out.println(acc);
        float facc = 0;
        for (int i = 1; i <= 1000; i++) facc += 1.0f / i;
        System.out.println(facc);
        long lacc = 1;
        for (int i = 1; i <= 25; i++) lacc *= i;
        System.out.println(lacc);
    }
}
