package java.lang;

import java.util.ArrayList;
import java.util.List;

public class Runtime {
    private static final Runtime currentRuntime = new Runtime();
    private final List<Thread> hooks = new ArrayList<>();

    public static Runtime getRuntime() {
        return currentRuntime;
    }

    private Runtime() {
    }

    public void exit(int status) {
        List<Thread> pending;
        synchronized (hooks) {
            pending = new ArrayList<>(hooks);
            hooks.clear();
        }
        for (Thread hook : pending) {
            try {
                hook.run();
            } catch (Throwable ignored) {
            }
        }
        halt(status);
    }

    public void addShutdownHook(Thread hook) {
        synchronized (hooks) {
            hooks.add(hook);
        }
    }

    public boolean removeShutdownHook(Thread hook) {
        synchronized (hooks) {
            return hooks.remove(hook);
        }
    }

    public native void halt(int status);

    public native int availableProcessors();

    public native long freeMemory();

    public native long totalMemory();

    public native long maxMemory();

    public void gc() {
    }

    public void runFinalization() {
    }

    public void load(String filename) {
    }

    public void loadLibrary(String libname) {
    }

    public static Version version() {
        throw new UnsupportedOperationException();
    }

    public static final class Version {
        private Version() {
        }
    }
}
