package jdk.internal.misc;

public class CDS {
    private CDS() {
    }

    public static boolean isDumpingClassList() {
        return false;
    }

    public static boolean isDumpingArchive() {
        return false;
    }

    public static boolean isSharingEnabled() {
        return false;
    }

    public static boolean isDumpingStaticArchive() {
        return false;
    }

    public static void initializeFromArchive(Class<?> c) {
    }

    public static void defineArchivedModules(ClassLoader platformLoader, ClassLoader systemLoader) {
    }

    public static long getRandomSeedForDumping() {
        return 0;
    }

    public static void logLambdaFormInvoker(String line) {
    }

    public static void traceLambdaFormInvoker(String prefix, String holder, String name, String type) {
    }

    public static void traceSpeciesType(String prefix, String cn) {
    }
}
