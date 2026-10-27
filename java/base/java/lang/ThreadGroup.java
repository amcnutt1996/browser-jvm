package java.lang;

public class ThreadGroup implements Thread.UncaughtExceptionHandler {
    private final ThreadGroup parent;
    private final String name;
    private int maxPriority = Thread.MAX_PRIORITY;
    private boolean daemon;

    ThreadGroup(ThreadGroup parent, String name, boolean system) {
        this.parent = parent;
        this.name = name;
    }

    public ThreadGroup(String name) {
        this(Thread.currentThread().getThreadGroup(), name);
    }

    public ThreadGroup(ThreadGroup parent, String name) {
        this.parent = parent;
        this.name = name;
        if (parent != null) {
            this.maxPriority = parent.maxPriority;
            this.daemon = parent.daemon;
        }
    }

    public final String getName() {
        return name;
    }

    public final ThreadGroup getParent() {
        return parent;
    }

    public final int getMaxPriority() {
        return maxPriority;
    }

    public final boolean isDaemon() {
        return daemon;
    }

    public final void setDaemon(boolean daemon) {
        this.daemon = daemon;
    }

    public final void setMaxPriority(int pri) {
        maxPriority = pri;
    }

    public final boolean parentOf(ThreadGroup g) {
        for (; g != null; g = g.parent) {
            if (g == this) {
                return true;
            }
        }
        return false;
    }

    public int activeCount() {
        return 0;
    }

    public final void interrupt() {
    }

    public void uncaughtException(Thread t, Throwable e) {
        if (parent != null) {
            parent.uncaughtException(t, e);
        } else {
            Thread.UncaughtExceptionHandler ueh = Thread.getDefaultUncaughtExceptionHandler();
            if (ueh != null) {
                ueh.uncaughtException(t, e);
            } else {
                System.err.print("Exception in thread \"" + t.getName() + "\" ");
                e.printStackTrace(System.err);
            }
        }
    }

    public String toString() {
        return getClass().getName() + "[name=" + getName() + ",maxpri=" + getMaxPriority() + "]";
    }
}
