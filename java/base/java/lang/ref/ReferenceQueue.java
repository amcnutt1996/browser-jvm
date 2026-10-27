package java.lang.ref;

import java.util.ArrayDeque;

public class ReferenceQueue<T> {
    private final ArrayDeque<Reference<? extends T>> queue = new ArrayDeque<>();

    public ReferenceQueue() {
    }

    @SuppressWarnings("unchecked")
    synchronized boolean add(Reference<?> r) {
        queue.add((Reference<? extends T>) r);
        notifyAll();
        return true;
    }

    public synchronized Reference<? extends T> poll() {
        return queue.poll();
    }

    public synchronized Reference<? extends T> remove(long timeout) throws InterruptedException {
        if (queue.isEmpty()) {
            wait(timeout);
        }
        return queue.poll();
    }

    public Reference<? extends T> remove() throws InterruptedException {
        return remove(0);
    }
}
