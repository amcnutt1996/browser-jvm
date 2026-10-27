package java.lang.reflect;

public final class Constructor<T> extends Executable {
    private Class<T> clazz;
    private Class<?>[] parameterTypes;
    private Class<?>[] exceptionTypes;
    private int modifiers;
    private int slot;

    private Constructor() {
    }

    public Class<T> getDeclaringClass() {
        return clazz;
    }

    public String getName() {
        return clazz.getName();
    }

    public int getModifiers() {
        return modifiers;
    }

    public Class<?>[] getParameterTypes() {
        return parameterTypes.clone();
    }

    public int getParameterCount() {
        return parameterTypes.length;
    }

    public Class<?>[] getExceptionTypes() {
        return exceptionTypes.clone();
    }

    public boolean equals(Object obj) {
        if (obj instanceof Constructor) {
            Constructor<?> other = (Constructor<?>) obj;
            return clazz == other.clazz && java.util.Arrays.equals(parameterTypes, other.parameterTypes);
        }
        return false;
    }

    public int hashCode() {
        return clazz.getName().hashCode();
    }

    public String toString() {
        int mod = getModifiers() & Modifier.constructorModifiers();
        return ((mod == 0) ? "" : (Modifier.toString(mod) + " ")) + clazz.getTypeName() + "(" + typeList(parameterTypes) + ")";
    }

    public String toGenericString() {
        return toString();
    }

    public T newInstance(Object... initargs) throws InstantiationException, IllegalAccessException, IllegalArgumentException, InvocationTargetException {
        if (initargs == null) {
            initargs = new Object[0];
        }
        if (initargs.length != parameterTypes.length) {
            throw new IllegalArgumentException("wrong number of arguments: " + initargs.length + " expected: " + parameterTypes.length);
        }
        if (Modifier.isAbstract(clazz.getModifiers())) {
            throw new InstantiationException(clazz.getName());
        }
        return newInstance0(initargs);
    }

    private native T newInstance0(Object[] args) throws InvocationTargetException;

    public native <A extends java.lang.annotation.Annotation> A getAnnotation(Class<A> annotationClass);

    public native java.lang.annotation.Annotation[] getDeclaredAnnotations();
}
