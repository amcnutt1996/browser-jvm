package java.lang.ref;

import java.util.concurrent.ThreadFactory;

public final class Cleaner {
    private Cleaner() {
    }

    public static Cleaner create() {
        return new Cleaner();
    }

    public static Cleaner create(ThreadFactory threadFactory) {
        return new Cleaner();
    }

    public Cleanable register(Object obj, Runnable action) {
        return action::run;
    }

    public interface Cleanable {
        void clean();
    }
}
