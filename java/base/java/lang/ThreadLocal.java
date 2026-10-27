package java.lang;

import java.util.IdentityHashMap;
import java.util.Objects;
import java.util.function.Supplier;

public class ThreadLocal<T> {
    public ThreadLocal() {
    }

    protected T initialValue() {
        return null;
    }

    public static <S> ThreadLocal<S> withInitial(Supplier<? extends S> supplier) {
        Objects.requireNonNull(supplier);
        return new ThreadLocal<S>() {
            protected S initialValue() {
                return supplier.get();
            }
        };
    }

    @SuppressWarnings("unchecked")
    IdentityHashMap<ThreadLocal<?>, Object> map(Thread t, boolean create) {
        IdentityHashMap<ThreadLocal<?>, Object> map = (IdentityHashMap<ThreadLocal<?>, Object>) t.threadLocals;
        if (map == null && create) {
            map = new IdentityHashMap<>();
            t.threadLocals = map;
        }
        return map;
    }

    @SuppressWarnings("unchecked")
    public T get() {
        IdentityHashMap<ThreadLocal<?>, Object> map = map(Thread.currentThread(), true);
        if (map.containsKey(this)) {
            return (T) map.get(this);
        }
        T value = initialValue();
        map.put(this, value);
        return value;
    }

    public void set(T value) {
        map(Thread.currentThread(), true).put(this, value);
    }

    public void remove() {
        IdentityHashMap<ThreadLocal<?>, Object> map = map(Thread.currentThread(), false);
        if (map != null) {
            map.remove(this);
        }
    }
}
