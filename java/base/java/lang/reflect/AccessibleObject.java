package java.lang.reflect;

import java.lang.annotation.Annotation;

public class AccessibleObject implements AnnotatedElement {
    boolean override;

    protected AccessibleObject() {
    }

    public static void setAccessible(AccessibleObject[] array, boolean flag) {
        for (AccessibleObject ao : array) {
            ao.setAccessible(flag);
        }
    }

    public void setAccessible(boolean flag) {
        override = flag;
    }

    public final boolean trySetAccessible() {
        override = true;
        return true;
    }

    @Deprecated(since = "9")
    public boolean isAccessible() {
        return override;
    }

    public final boolean canAccess(Object obj) {
        return true;
    }

    public <T extends Annotation> T getAnnotation(Class<T> annotationClass) {
        return null;
    }

    public boolean isAnnotationPresent(Class<? extends Annotation> annotationClass) {
        return getAnnotation(annotationClass) != null;
    }

    public <T extends Annotation> T[] getAnnotationsByType(Class<T> annotationClass) {
        @SuppressWarnings("unchecked")
        T[] result = (T[]) Array.newInstance(annotationClass, 0);
        return result;
    }

    public Annotation[] getAnnotations() {
        return getDeclaredAnnotations();
    }

    public <T extends Annotation> T getDeclaredAnnotation(Class<T> annotationClass) {
        return getAnnotation(annotationClass);
    }

    public <T extends Annotation> T[] getDeclaredAnnotationsByType(Class<T> annotationClass) {
        return getAnnotationsByType(annotationClass);
    }

    public Annotation[] getDeclaredAnnotations() {
        return new Annotation[0];
    }
}
