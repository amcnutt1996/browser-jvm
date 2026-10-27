package java.lang.ref;

public abstract class Reference<T> {
    private T referent;
    final ReferenceQueue<? super T> queue;

    Reference(T referent) {
        this(referent, null);
    }

    Reference(T referent, ReferenceQueue<? super T> queue) {
        this.referent = referent;
        this.queue = queue;
    }

    public T get() {
        return referent;
    }

    public final boolean refersTo(T obj) {
        return referent == obj;
    }

    public void clear() {
        referent = null;
    }

    @Deprecated(since = "16")
    public boolean isEnqueued() {
        return false;
    }

    public boolean enqueue() {
        clear();
        return queue != null && queue.add(this);
    }

    protected Object clone() throws CloneNotSupportedException {
        throw new CloneNotSupportedException();
    }

    public static void reachabilityFence(Object ref) {
    }
}
