package java.lang.reflect;

public final class Field extends AccessibleObject implements Member {
    private Class<?> clazz;
    private String name;
    private Class<?> type;
    private int modifiers;
    private int slot;
    private String signature;

    private Field() {
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

    public boolean isEnumConstant() {
        return (getModifiers() & 0x4000) != 0;
    }

    public boolean isSynthetic() {
        return (getModifiers() & 0x1000) != 0;
    }

    public Class<?> getType() {
        return type;
    }

    public Type getGenericType() {
        Type generic = genericType();
        return generic != null ? generic : type;
    }

    private native Type genericType();

    public boolean equals(Object obj) {
        if (obj instanceof Field) {
            Field other = (Field) obj;
            return clazz == other.clazz && name.equals(other.name) && type == other.type;
        }
        return false;
    }

    public int hashCode() {
        return clazz.getName().hashCode() ^ name.hashCode();
    }

    public String toString() {
        int mod = getModifiers();
        return (((mod == 0) ? "" : (Modifier.toString(mod) + " ")) + type.getTypeName() + " " + clazz.getTypeName() + "." + name);
    }

    public String toGenericString() {
        return toString();
    }

    public native Object get(Object obj) throws IllegalArgumentException, IllegalAccessException;

    public boolean getBoolean(Object obj) throws IllegalAccessException {
        return (Boolean) get(obj);
    }

    public byte getByte(Object obj) throws IllegalAccessException {
        return ((Number) get(obj)).byteValue();
    }

    public char getChar(Object obj) throws IllegalAccessException {
        return (Character) get(obj);
    }

    public short getShort(Object obj) throws IllegalAccessException {
        Object v = get(obj);
        return v instanceof Character ? (short) (char) (Character) v : ((Number) v).shortValue();
    }

    public int getInt(Object obj) throws IllegalAccessException {
        Object v = get(obj);
        return v instanceof Character ? (int) (char) (Character) v : ((Number) v).intValue();
    }

    public long getLong(Object obj) throws IllegalAccessException {
        Object v = get(obj);
        return v instanceof Character ? (long) (char) (Character) v : ((Number) v).longValue();
    }

    public float getFloat(Object obj) throws IllegalAccessException {
        Object v = get(obj);
        return v instanceof Character ? (float) (char) (Character) v : ((Number) v).floatValue();
    }

    public double getDouble(Object obj) throws IllegalAccessException {
        Object v = get(obj);
        return v instanceof Character ? (double) (char) (Character) v : ((Number) v).doubleValue();
    }

    public native void set(Object obj, Object value) throws IllegalArgumentException, IllegalAccessException;

    public void setBoolean(Object obj, boolean z) throws IllegalAccessException {
        set(obj, z);
    }

    public void setByte(Object obj, byte b) throws IllegalAccessException {
        set(obj, b);
    }

    public void setChar(Object obj, char c) throws IllegalAccessException {
        set(obj, c);
    }

    public void setShort(Object obj, short s) throws IllegalAccessException {
        set(obj, s);
    }

    public void setInt(Object obj, int i) throws IllegalAccessException {
        set(obj, i);
    }

    public void setLong(Object obj, long l) throws IllegalAccessException {
        set(obj, l);
    }

    public void setFloat(Object obj, float f) throws IllegalAccessException {
        set(obj, f);
    }

    public void setDouble(Object obj, double d) throws IllegalAccessException {
        set(obj, d);
    }

    public native <T extends java.lang.annotation.Annotation> T getAnnotation(Class<T> annotationClass);

    public native java.lang.annotation.Annotation[] getDeclaredAnnotations();
}
