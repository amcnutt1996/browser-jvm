package java.lang;

import java.io.PrintStream;
import java.io.PrintWriter;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Set;
import java.util.Collections;

public class Throwable implements Serializable {
    private static final long serialVersionUID = -3042686055658047285L;

    private transient Object backtrace;
    private String detailMessage;
    private Throwable cause = this;
    private StackTraceElement[] stackTrace;
    private List<Throwable> suppressedExceptions;
    private transient boolean writableStackTrace = true;

    public Throwable() {
        fillInStackTrace();
    }

    public Throwable(String message) {
        fillInStackTrace();
        detailMessage = message;
    }

    public Throwable(String message, Throwable cause) {
        fillInStackTrace();
        detailMessage = message;
        this.cause = cause;
    }

    public Throwable(Throwable cause) {
        fillInStackTrace();
        detailMessage = (cause == null ? null : cause.toString());
        this.cause = cause;
    }

    protected Throwable(String message, Throwable cause, boolean enableSuppression, boolean writableStackTrace) {
        if (writableStackTrace) {
            fillInStackTrace();
        } else {
            this.writableStackTrace = false;
            stackTrace = new StackTraceElement[0];
        }
        detailMessage = message;
        this.cause = cause;
    }

    public String getMessage() {
        return detailMessage;
    }

    public String getLocalizedMessage() {
        return getMessage();
    }

    public synchronized Throwable getCause() {
        return (cause == this ? null : cause);
    }

    public synchronized Throwable initCause(Throwable cause) {
        if (this.cause != this) {
            throw new IllegalStateException("Can't overwrite cause with " + String.valueOf(cause), this);
        }
        if (cause == this) {
            throw new IllegalArgumentException("Self-causation not permitted", this);
        }
        this.cause = cause;
        return this;
    }

    final void setCause(Throwable t) {
        this.cause = t;
    }

    public String toString() {
        String s = getClass().getName();
        String message = getLocalizedMessage();
        return (message != null) ? (s + ": " + message) : s;
    }

    public void printStackTrace() {
        printStackTrace(System.err);
    }

    public void printStackTrace(PrintStream s) {
        StringBuilder sb = new StringBuilder();
        describe(sb);
        synchronized (s) {
            s.print(sb.toString());
        }
    }

    public void printStackTrace(PrintWriter s) {
        StringBuilder sb = new StringBuilder();
        describe(sb);
        synchronized (s) {
            s.print(sb.toString());
            s.flush();
        }
    }

    private void describe(StringBuilder sb) {
        Set<Throwable> dejaVu = Collections.newSetFromMap(new IdentityHashMap<>());
        dejaVu.add(this);
        sb.append(this).append('\n');
        StackTraceElement[] trace = getOurStackTrace();
        for (StackTraceElement traceElement : trace) {
            sb.append("\tat ").append(traceElement).append('\n');
        }
        for (Throwable se : getSuppressed()) {
            se.describeEnclosed(sb, trace, "Suppressed: ", "\t", dejaVu);
        }
        Throwable ourCause = getCause();
        if (ourCause != null) {
            ourCause.describeEnclosed(sb, trace, "Caused by: ", "", dejaVu);
        }
    }

    private void describeEnclosed(StringBuilder sb, StackTraceElement[] enclosingTrace, String caption, String prefix, Set<Throwable> dejaVu) {
        if (dejaVu.contains(this)) {
            sb.append(prefix).append(caption).append("[CIRCULAR REFERENCE: ").append(this).append("]\n");
            return;
        }
        dejaVu.add(this);
        StackTraceElement[] trace = getOurStackTrace();
        int m = trace.length - 1;
        int n = enclosingTrace.length - 1;
        while (m >= 0 && n >= 0 && trace[m].equals(enclosingTrace[n])) {
            m--;
            n--;
        }
        int framesInCommon = trace.length - 1 - m;
        sb.append(prefix).append(caption).append(this).append('\n');
        for (int i = 0; i <= m; i++) {
            sb.append(prefix).append("\tat ").append(trace[i]).append('\n');
        }
        if (framesInCommon != 0) {
            sb.append(prefix).append("\t... ").append(framesInCommon).append(" more\n");
        }
        for (Throwable se : getSuppressed()) {
            se.describeEnclosed(sb, trace, "Suppressed: ", prefix + "\t", dejaVu);
        }
        Throwable ourCause = getCause();
        if (ourCause != null) {
            ourCause.describeEnclosed(sb, trace, "Caused by: ", prefix, dejaVu);
        }
    }

    public synchronized Throwable fillInStackTrace() {
        if (writableStackTrace) {
            stackTrace = null;
            fillInStackTrace0();
        }
        return this;
    }

    private native void fillInStackTrace0();

    private native StackTraceElement[] buildStackTrace();

    public StackTraceElement[] getStackTrace() {
        return getOurStackTrace().clone();
    }

    private synchronized StackTraceElement[] getOurStackTrace() {
        if (stackTrace == null) {
            stackTrace = backtrace == null ? new StackTraceElement[0] : buildStackTrace();
        }
        return stackTrace;
    }

    public void setStackTrace(StackTraceElement[] stackTrace) {
        StackTraceElement[] defensiveCopy = stackTrace.clone();
        for (int i = 0; i < defensiveCopy.length; i++) {
            if (defensiveCopy[i] == null) {
                throw new NullPointerException("stackTrace[" + i + "]");
            }
        }
        synchronized (this) {
            if (!writableStackTrace) {
                return;
            }
            this.stackTrace = defensiveCopy;
        }
    }

    public final synchronized void addSuppressed(Throwable exception) {
        if (exception == this) {
            throw new IllegalArgumentException("Self-suppression not permitted", exception);
        }
        if (exception == null) {
            throw new NullPointerException("Cannot suppress a null exception.");
        }
        if (suppressedExceptions == null) {
            suppressedExceptions = new ArrayList<>(1);
        }
        suppressedExceptions.add(exception);
    }

    public final synchronized Throwable[] getSuppressed() {
        if (suppressedExceptions == null) {
            return new Throwable[0];
        }
        return suppressedExceptions.toArray(new Throwable[0]);
    }
}
