public class Uncaught {
    static void fail(int depth) {
        if (depth == 0) throw new IllegalStateException("broken on purpose");
        fail(depth - 1);
    }

    public static void main(String[] args) {
        System.out.println("before");
        fail(2);
    }
}
