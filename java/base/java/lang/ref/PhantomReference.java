package java.lang.ref;

public class PhantomReference<T> extends Reference<T> {

    public PhantomReference(T referent, ReferenceQueue<? super T> q) {
        super(referent, q);
    }
}
