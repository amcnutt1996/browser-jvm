package java.lang;

import java.io.FileDescriptor;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.PrintStream;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;

public final class System {
    public static final InputStream in;
    public static final PrintStream out;
    public static final PrintStream err;

    private static Properties props;
    private static Map<String, String> env;

    static {
        jdk.internal.access.SharedSecrets.setJavaLangAccess(new JavaLangAccessImpl());
        props = new Properties();
        String[] pairs = initialProperties();
        for (int i = 0; i < pairs.length; i += 2) {
            props.setProperty(pairs[i], pairs[i + 1]);
        }
        in = new FileInputStream(FileDescriptor.in);
        out = new PrintStream(new FileOutputStream(FileDescriptor.out), true);
        err = new PrintStream(new FileOutputStream(FileDescriptor.err), true);
    }

    private System() {
    }

    private static native String[] initialProperties();

    private static native String[] environmentPairs();

    public static native void setIn(InputStream in);

    public static native void setOut(PrintStream out);

    public static native void setErr(PrintStream err);

    public static java.io.Console console() {
        return null;
    }

    public static SecurityManager getSecurityManager() {
        return null;
    }

    @Deprecated(since = "17", forRemoval = true)
    public static void setSecurityManager(SecurityManager sm) {
        throw new UnsupportedOperationException("The Security Manager is deprecated and will be removed in a future release");
    }

    public static native long currentTimeMillis();

    public static native long nanoTime();

    public static native void arraycopy(Object src, int srcPos, Object dest, int destPos, int length);

    public static native int identityHashCode(Object x);

    public static Properties getProperties() {
        return props;
    }

    public static String lineSeparator() {
        return "\n";
    }

    public static void setProperties(Properties props) {
        System.props = props == null ? new Properties() : props;
    }

    public static String getProperty(String key) {
        checkKey(key);
        return props.getProperty(key);
    }

    public static String getProperty(String key, String def) {
        checkKey(key);
        return props.getProperty(key, def);
    }

    public static String setProperty(String key, String value) {
        checkKey(key);
        return (String) props.setProperty(key, value);
    }

    public static String clearProperty(String key) {
        checkKey(key);
        return (String) props.remove(key);
    }

    private static void checkKey(String key) {
        if (key == null) {
            throw new NullPointerException("key can't be null");
        }
        if (key.isEmpty()) {
            throw new IllegalArgumentException("key can't be empty");
        }
    }

    public static String getenv(String name) {
        return getenv().get(name);
    }

    public static Map<String, String> getenv() {
        if (env == null) {
            Map<String, String> map = new HashMap<>();
            String[] pairs = environmentPairs();
            for (int i = 0; i < pairs.length; i += 2) {
                map.put(pairs[i], pairs[i + 1]);
            }
            env = Collections.unmodifiableMap(map);
        }
        return env;
    }

    public static void exit(int status) {
        Runtime.getRuntime().exit(status);
    }

    public static void gc() {
    }

    public static void runFinalization() {
    }

    public static void load(String filename) {
    }

    public static void loadLibrary(String libname) {
    }

    public static String mapLibraryName(String libname) {
        if (libname == null) {
            throw new NullPointerException();
        }
        return "lib" + libname + ".so";
    }
}
