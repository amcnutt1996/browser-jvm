public class ExitCode {
    public static void main(String[] args) {
        Runtime.getRuntime().addShutdownHook(new Thread(() -> System.out.println("hook")));
        new Thread(() -> {
            try {
                Thread.sleep(100000);
            } catch (InterruptedException e) {
                // exit interrupts nothing; the thread just stops
            }
        }).start();
        System.out.println("exiting " + args.length);
        System.exit(42);
    }
}
