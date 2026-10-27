package java.lang;

import java.util.IdentityHashMap;
import java.util.Map;

public class InheritableThreadLocal<T> extends ThreadLocal<T> {
    public InheritableThreadLocal() {
    }

    protected T childValue(T parentValue) {
        return parentValue;
    }

    @SuppressWarnings("unchecked")
    IdentityHashMap<ThreadLocal<?>, Object> map(Thread t, boolean create) {
        IdentityHashMap<ThreadLocal<?>, Object> map = (IdentityHashMap<ThreadLocal<?>, Object>) t.inheritableThreadLocals;
        if (map == null && create) {
            map = new IdentityHashMap<>();
            t.inheritableThreadLocals = map;
        }
        return map;
    }

    @SuppressWarnings("unchecked")
    static Object copyMap(Object parent) {
        IdentityHashMap<ThreadLocal<?>, Object> source = (IdentityHashMap<ThreadLocal<?>, Object>) parent;
        IdentityHashMap<ThreadLocal<?>, Object> copy = new IdentityHashMap<>();
        for (Map.Entry<ThreadLocal<?>, Object> e : source.entrySet()) {
            InheritableThreadLocal<Object> key = (InheritableThreadLocal<Object>) e.getKey();
            copy.put(key, key.childValue(e.getValue()));
        }
        return copy;
    }
}
