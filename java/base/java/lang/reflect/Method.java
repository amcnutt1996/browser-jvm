package java.lang.reflect;

public final class Method extends Executable {
    private Class<?> clazz;
    private String name;
    private Class<?> returnType;
    private Class<?>[] parameterTypes;
    private Class<?>[] exceptionTypes;
    private int modifiers;
    private int slot;

    private Method() {
    }

    public Class<?> getDeclaringClass() {
        return clazz;
    }

    public String getName() {
        return name;
    }

    public int getModifiers() {
        return modifiers;
    }

    public Class<?> getReturnType() {
        return returnType;
    }

    public Type getGenericReturnType() {
        return returnType;
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
        if (obj instanceof Method) {
            Method other = (Method) obj;
            return clazz == other.clazz && name.equals(other.name) && returnType == other.returnType && java.util.Arrays.equals(parameterTypes, other.parameterTypes);
        }
        return false;
    }

    public int hashCode() {
        return clazz.getName().hashCode() ^ name.hashCode();
    }

    public String toString() {
        int mod = getModifiers() & Modifier.methodModifiers();
        return ((mod == 0) ? "" : (Modifier.toString(mod) + " ")) + returnType.getTypeName() + " " + clazz.getTypeName() + "." + name + "(" + typeList(parameterTypes) + ")";
    }

    public String toGenericString() {
        return toString();
    }

    public Object invoke(Object obj, Object... args) throws IllegalAccessException, InvocationTargetException {
        if (args == null) {
            args = new Object[0];
        }
        if (args.length != parameterTypes.length) {
            throw new IllegalArgumentException("wrong number of arguments: " + args.length + " expected: " + parameterTypes.length);
        }
        if (!Modifier.isStatic(modifiers)) {
            if (obj == null) {
                throw new NullPointerException();
            }
            if (!clazz.isInstance(obj)) {
                throw new IllegalArgumentException("object is not an instance of declaring class");
            }
        }
        return invoke0(obj, args);
    }

    private native Object invoke0(Object obj, Object[] args) throws InvocationTargetException;

    public boolean isBridge() {
        return (getModifiers() & 0x0040) != 0;
    }

    public boolean isDefault() {
        return ((getModifiers() & (Modifier.ABSTRACT | Modifier.PUBLIC | Modifier.STATIC)) == Modifier.PUBLIC) && getDeclaringClass().isInterface();
    }

    public Object getDefaultValue() {
        return null;
    }

    public native <T extends java.lang.annotation.Annotation> T getAnnotation(Class<T> annotationClass);

    public native java.lang.annotation.Annotation[] getDeclaredAnnotations();
}
