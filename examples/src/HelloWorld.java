import java.util.List;
import java.util.stream.Collectors;

public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
        System.out.println();
        System.out.println("This is Java " + System.getProperty("java.version") + " on the " + System.getProperty("java.vm.name") + ",");
        System.out.println("a JVM written in TypeScript, running inside a gregOS window.");
        System.out.println();
        List<String> squares = java.util.stream.IntStream.rangeClosed(1, 10)
            .mapToObj(n -> n + "²=" + n * n)
            .collect(Collectors.toList());
        System.out.println(String.join("  ", squares));
    }
}
