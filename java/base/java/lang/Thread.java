package java.lang;

import java.util.Map;

public class Thread implements Runnable {
    public static final int MIN_PRIORITY = 1;
    public static final int NORM_PRIORITY = 5;
    public static final int MAX_PRIORITY = 10;

    private static volatile UncaughtExceptionHandler defaultUncaughtExceptionHandler;
    private static long threadSeqNumber;
    private static int threadInitNumber;

    private volatile String name;
    private int priority;
    private boolean daemon;
    private Runnable target;
    private ThreadGroup group;
    private ClassLoader contextClassLoader;
    private long tid;
    private volatile UncaughtExceptionHandler uncaughtExceptionHandler;
    Object threadLocals;
    Object inheritableThreadLocals;
    private boolean started;
    volatile Object parkBlocker;
    long threadLocalRandomSeed;
    int threadLocalRandomProbe;
    int threadLocalRandomSecondarySeed;

    public enum State {
        NEW,
        RUNNABLE,
        BLOCKED,
        WAITING,
        TIMED_WAITING,
        TERMINATED;
    }

    @FunctionalInterface
    public interface UncaughtExceptionHandler {
        void uncaughtException(Thread t, Throwable e);
    }

    public Thread() {
        this(null, null, nextThreadName());
    }

    public Thread(Runnable task) {
        this(null, task, nextThreadName());
    }

    public Thread(ThreadGroup group, Runnable task) {
        this(group, task, nextThreadName());
    }

    public Thread(String name) {
        this(null, null, name);
    }

    public Thread(ThreadGroup group, String name) {
        this(group, null, name);
    }

    public Thread(Runnable task, String name) {
        this(null, task, name);
    }

    public Thread(ThreadGroup group, Runnable task, String name, long stackSize) {
        this(group, task, name);
    }

    public Thread(ThreadGroup group, Runnable task, String name, long stackSize, boolean inheritInheritableThreadLocals) {
        this(group, task, name);
    }

    public Thread(ThreadGroup group, Runnable task, String name) {
        if (name == null) {
            throw new NullPointerException("'name' is null");
        }
        Thread parent = currentThread();
        this.name = name;
        this.group = group != null ? group : parent.getThreadGroup();
        this.daemon = parent.isDaemon();
        this.priority = parent.getPriority();
        this.contextClassLoader = parent.contextClassLoader;
        this.target = task;
        this.tid = nextThreadId();
        if (parent.inheritableThreadLocals != null) {
            this.inheritableThreadLocals = InheritableThreadLocal.copyMap(parent.inheritableThreadLocals);
        }
    }

    private static synchronized String nextThreadName() {
        return "Thread-" + threadInitNumber++;
    }

    private static synchronized long nextThreadId() {
        return ++threadSeqNumber + 1;
    }

    public static native Thread currentThread();

    public static native void yield();

    public static native void sleep(long millis) throws InterruptedException;

    public static void sleep(long millis, int nanos) throws InterruptedException {
        if (millis < 0) {
            throw new IllegalArgumentException("timeout value is negative");
        }
        if (nanos < 0 || nanos > 999999) {
            throw new IllegalArgumentException("nanosecond timeout value out of range");
        }
        sleep(millis + (nanos > 0 ? 1 : 0));
    }

    public static void sleep(java.time.Duration duration) throws InterruptedException {
        sleep(duration.toMillis());
    }

    public static void onSpinWait() {
    }

    public synchronized void start() {
        if (started) {
            throw new IllegalThreadStateException();
        }
        started = true;
        start0();
    }

    private native void start0();

    public void run() {
        Runnable task = target;
        if (task != null) {
            task.run();
        }
    }

    public void interrupt() {
        interrupt0();
    }

    private native void interrupt0();

    public static native boolean interrupted();

    public native boolean isInterrupted();

    public final native boolean isAlive();

    public final void setPriority(int newPriority) {
        if (newPriority > MAX_PRIORITY || newPriority < MIN_PRIORITY) {
            throw new IllegalArgumentException();
        }
        priority = newPriority;
    }

    public final int getPriority() {
        return priority;
    }

    public final synchronized void setName(String name) {
        if (name == null) {
            throw new NullPointerException("name cannot be null");
        }
        this.name = name;
        setName0(name);
    }

    private native void setName0(String name);

    public final String getName() {
        return name;
    }

    public final ThreadGroup getThreadGroup() {
        return isAlive() || !started ? group : null;
    }

    public static int activeCount() {
        return 1;
    }

    public final void join(long millis) throws InterruptedException {
        if (millis < 0) {
            throw new IllegalArgumentException("timeout value is negative");
        }
        join0(millis);
    }

    private native void join0(long millis) throws InterruptedException;

    public final void join(long millis, int nanos) throws InterruptedException {
        join(millis + (nanos > 0 ? 1 : 0));
    }

    public final void join() throws InterruptedException {
        join(0);
    }

    public static void dumpStack() {
        new Exception("Stack trace").printStackTrace();
    }

    public final void setDaemon(boolean on) {
        if (started && isAlive()) {
            throw new IllegalThreadStateException();
        }
        daemon = on;
    }

    public final boolean isDaemon() {
        return daemon;
    }

    public final void checkAccess() {
    }

    public String toString() {
        ThreadGroup g = getThreadGroup();
        return "Thread[#" + tid + "," + name + "," + priority + "," + (g == null ? "" : g.getName()) + "]";
    }

    public ClassLoader getContextClassLoader() {
        return contextClassLoader;
    }

    public void setContextClassLoader(ClassLoader cl) {
        contextClassLoader = cl;
    }

    public static native boolean holdsLock(Object obj);

    public StackTraceElement[] getStackTrace() {
        if (this != currentThread()) {
            return new StackTraceElement[0];
        }
        StackTraceElement[] trace = new Exception().getStackTrace();
        StackTraceElement[] result = new StackTraceElement[Math.max(0, trace.length)];
        System.arraycopy(trace, 0, result, 0, result.length);
        return result;
    }

    public static Map<Thread, StackTraceElement[]> getAllStackTraces() {
        return new java.util.HashMap<>();
    }

    @Deprecated(since = "19")
    public long getId() {
        return tid;
    }

    public final long threadId() {
        return tid;
    }

    public final boolean isVirtual() {
        return false;
    }

    public State getState() {
        if (!started) {
            return State.NEW;
        }
        return isAlive() ? State.RUNNABLE : State.TERMINATED;
    }

    public static void setDefaultUncaughtExceptionHandler(UncaughtExceptionHandler ueh) {
        defaultUncaughtExceptionHandler = ueh;
    }

    public static UncaughtExceptionHandler getDefaultUncaughtExceptionHandler() {
        return defaultUncaughtExceptionHandler;
    }

    public UncaughtExceptionHandler getUncaughtExceptionHandler() {
        UncaughtExceptionHandler ueh = uncaughtExceptionHandler;
        return ueh != null ? ueh : group;
    }

    public void setUncaughtExceptionHandler(UncaughtExceptionHandler ueh) {
        uncaughtExceptionHandler = ueh;
    }

    void dispatchUncaughtException(Throwable e) {
        getUncaughtExceptionHandler().uncaughtException(this, e);
    }
}
