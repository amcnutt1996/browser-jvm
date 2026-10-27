package jdk.internal.vm;

import java.util.stream.Stream;

public class SharedThreadContainer extends ThreadContainer implements AutoCloseable {
    private final String name;
    private volatile boolean closed;

    private SharedThreadContainer(String name) {
        super(true);
        this.name = name;
    }

    public static SharedThreadContainer create(ThreadContainer parent, String name) {
        return new SharedThreadContainer(name);
    }

    public static SharedThreadContainer create(String name) {
        return new SharedThreadContainer(name);
    }

    @Override
    public String name() {
        return name;
    }

    @Override
    public Thread owner() {
        return null;
    }

    @Override
    public Stream<Thread> threads() {
        return Stream.empty();
    }

    public void start(Thread thread) {
        if (closed) {
            throw new IllegalStateException();
        }
        thread.start();
    }

    @Override
    public void close() {
        closed = true;
    }
}
