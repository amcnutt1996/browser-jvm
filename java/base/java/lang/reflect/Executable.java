package java.lang.reflect;

public abstract class Executable extends AccessibleObject implements Member, GenericDeclaration {
    Executable() {
    }

    public abstract Class<?> getDeclaringClass();

    public abstract String getName();

    public abstract int getModifiers();

    public abstract Class<?>[] getParameterTypes();

    public int getParameterCount() {
        return getParameterTypes().length;
    }

    public Type[] getGenericParameterTypes() {
        return getParameterTypes();
    }

    public abstract Class<?>[] getExceptionTypes();

    public Type[] getGenericExceptionTypes() {
        return getExceptionTypes();
    }

    public boolean isVarArgs() {
        return (getModifiers() & 0x0080) != 0;
    }

    public boolean isSynthetic() {
        return (getModifiers() & 0x1000) != 0;
    }

    public java.lang.annotation.Annotation[][] getParameterAnnotations() {
        return new java.lang.annotation.Annotation[getParameterCount()][0];
    }

    @SuppressWarnings("unchecked")
    public TypeVariable<?>[] getTypeParameters() {
        return new TypeVariable<?>[0];
    }

    public abstract String toGenericString();

    static String typeList(Class<?>[] types) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < types.length; i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append(types[i].getTypeName());
        }
        return sb.toString();
    }
}
