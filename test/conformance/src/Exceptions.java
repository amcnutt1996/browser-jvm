import java.util.ArrayList;
import java.util.List;

public class Exceptions {
    static class MyException extends Exception {
        final int code;

        MyException(String message, int code) {
            super(message);
            this.code = code;
        }
    }

    static class Resource implements AutoCloseable {
        final String name;
        final boolean failOnClose;

        Resource(String name, boolean failOnClose) {
            this.name = name;
            this.failOnClose = failOnClose;
            System.out.println("open " + name);
        }

        public void close() throws Exception {
            System.out.println("close " + name);
            if (failOnClose) throw new IllegalStateException("close failed " + name);
        }
    }

    static class BadInit {
        static int value = compute();

        static int compute() {
            throw new RuntimeException("init failed");
        }
    }

    static int finallyReturn() {
        try {
            return 1;
        } finally {
            System.out.println("finally runs");
        }
    }

    @SuppressWarnings("finally")
    static int finallyOverride() {
        try {
            throw new RuntimeException("lost");
        } finally {
            return 2;
        }
    }

    static void thrower(int depth) throws MyException {
        if (depth == 0) throw new MyException("deep", 42);
        thrower(depth - 1);
    }

    static int recurse(int n) {
        return recurse(n + 1) + 1;
    }

    public static void main(String[] args) throws Exception {
        try {
            thrower(3);
        } catch (MyException e) {
            System.out.println(e.getMessage() + " " + e.code + " " + e + " " + e.getStackTrace()[0].getMethodName() + " " + e.getStackTrace().length);
        }
        System.out.println(finallyReturn() + " " + finallyOverride());
        try {
            Object o = "string";
            Integer i = (Integer) o;
        } catch (ClassCastException e) {
            System.out.println("CCE " + e.getMessage());
        }
        try {
            int[] arr = new int[3];
            arr[3] = 1;
        } catch (ArrayIndexOutOfBoundsException e) {
            System.out.println("AIOOBE " + e.getMessage());
        }
        try {
            String s = null;
            s.length();
        } catch (NullPointerException e) {
            System.out.println("NPE");
        }
        try {
            "abc".substring(5);
        } catch (StringIndexOutOfBoundsException e) {
            System.out.println("SIOOBE " + e.getMessage());
        }
        try {
            Object[] objs = new String[1];
            objs[0] = 1;
        } catch (ArrayStoreException e) {
            System.out.println("ASE " + e.getMessage());
        }
        try {
            int[] neg = new int[-1];
        } catch (NegativeArraySizeException e) {
            System.out.println("NASE " + e.getMessage());
        }
        try {
            Integer.parseInt("12x");
        } catch (NumberFormatException e) {
            System.out.println("NFE " + e.getMessage());
        }
        try {
            List<Integer> l = new ArrayList<>();
            l.get(0);
        } catch (IndexOutOfBoundsException e) {
            System.out.println("IOOBE " + e.getMessage());
        }
        try {
            System.out.println(BadInit.value);
        } catch (ExceptionInInitializerError e) {
            System.out.println("EIIE " + e.getCause().getMessage());
        }
        try {
            System.out.println(BadInit.value);
        } catch (NoClassDefFoundError e) {
            System.out.println("NCDFE " + e.getMessage());
        }
        try (Resource a = new Resource("a", false); Resource b = new Resource("b", true)) {
            System.out.println("body");
            throw new RuntimeException("body failed");
        } catch (RuntimeException e) {
            System.out.println("caught " + e.getMessage() + " suppressed=" + e.getSuppressed().length + " " + e.getSuppressed()[0].getMessage());
        }
        try {
            try {
                throw new IllegalArgumentException("inner");
            } finally {
                System.out.println("inner finally");
            }
        } catch (IllegalArgumentException | IllegalStateException e) {
            System.out.println("multi " + e.getMessage());
        }
        try {
            try {
                throw new RuntimeException("first");
            } catch (RuntimeException e) {
                throw new Exception("wrapped", e);
            }
        } catch (Exception e) {
            System.out.println(e.getMessage() + " <- " + e.getCause().getMessage() + " " + (e.getCause() instanceof RuntimeException));
        }
        int count = 0;
        for (int i = 0; i < 5; i++) {
            try {
                if (i % 2 == 0) continue;
                count += 10;
            } finally {
                count++;
            }
        }
        System.out.println("count " + count);
        try {
            recurse(0);
        } catch (StackOverflowError e) {
            System.out.println("SOE");
        }
        Throwable t = new Throwable("plain");
        System.out.println(t + " " + t.getCause() + " " + new RuntimeException(new IllegalStateException("x")).getMessage());
        try {
            throw new Error("custom error");
        } catch (Throwable e) {
            System.out.println(e.getClass().getName() + ": " + e.getLocalizedMessage());
        }
        Exception chained = new Exception("top", new RuntimeException("middle", new IllegalStateException("bottom")));
        Throwable root = chained;
        while (root.getCause() != null) root = root.getCause();
        System.out.println(root.getMessage());
        java.io.StringWriter sw = new java.io.StringWriter();
        new IllegalStateException("printed").printStackTrace(new java.io.PrintWriter(sw));
        System.out.println(sw.toString().split("\n")[0] + " / " + sw.toString().split("\n")[1].trim().startsWith("at Exceptions.main"));
    }
}
