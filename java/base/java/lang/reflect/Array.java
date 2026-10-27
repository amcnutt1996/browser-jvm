package java.lang.reflect;

public final class Array {
    private Array() {
    }

    public static Object newInstance(Class<?> componentType, int length) throws NegativeArraySizeException {
        if (componentType == null) {
            throw new NullPointerException();
        }
        if (componentType == Void.TYPE) {
            throw new IllegalArgumentException();
        }
        return newArray(componentType, length);
    }

    public static Object newInstance(Class<?> componentType, int... dimensions) throws IllegalArgumentException, NegativeArraySizeException {
        if (dimensions.length == 0) {
            throw new IllegalArgumentException("Empty dimensions array");
        }
        return multiNewArray(componentType, dimensions, 0);
    }

    private static Object multiNewArray(Class<?> componentType, int[] dimensions, int depth) {
        Class<?> type = componentType;
        for (int i = depth + 1; i < dimensions.length; i++) {
            type = type.arrayType();
        }
        Object array = newArray(type, dimensions[depth]);
        if (depth + 1 < dimensions.length) {
            Object[] objects = (Object[]) array;
            for (int i = 0; i < objects.length; i++) {
                objects[i] = multiNewArray(componentType, dimensions, depth + 1);
            }
        }
        return array;
    }

    private static native Object newArray(Class<?> componentType, int length) throws NegativeArraySizeException;

    public static native int getLength(Object array) throws IllegalArgumentException;

    public static native Object get(Object array, int index) throws IllegalArgumentException, ArrayIndexOutOfBoundsException;

    public static boolean getBoolean(Object array, int index) {
        return (Boolean) get(array, index);
    }

    public static byte getByte(Object array, int index) {
        return ((Number) get(array, index)).byteValue();
    }

    public static char getChar(Object array, int index) {
        return (Character) get(array, index);
    }

    public static short getShort(Object array, int index) {
        return ((Number) get(array, index)).shortValue();
    }

    public static int getInt(Object array, int index) {
        Object v = get(array, index);
        return v instanceof Character ? (Character) v : ((Number) v).intValue();
    }

    public static long getLong(Object array, int index) {
        Object v = get(array, index);
        return v instanceof Character ? (Character) v : ((Number) v).longValue();
    }

    public static float getFloat(Object array, int index) {
        Object v = get(array, index);
        return v instanceof Character ? (Character) v : ((Number) v).floatValue();
    }

    public static double getDouble(Object array, int index) {
        Object v = get(array, index);
        return v instanceof Character ? (Character) v : ((Number) v).doubleValue();
    }

    public static native void set(Object array, int index, Object value) throws IllegalArgumentException, ArrayIndexOutOfBoundsException;

    public static void setBoolean(Object array, int index, boolean z) {
        set(array, index, z);
    }

    public static void setByte(Object array, int index, byte b) {
        set(array, index, b);
    }

    public static void setChar(Object array, int index, char c) {
        set(array, index, c);
    }

    public static void setShort(Object array, int index, short s) {
        set(array, index, s);
    }

    public static void setInt(Object array, int index, int i) {
        set(array, index, i);
    }

    public static void setLong(Object array, int index, long l) {
        set(array, index, l);
    }

    public static void setFloat(Object array, int index, float f) {
        set(array, index, f);
    }

    public static void setDouble(Object array, int index, double d) {
        set(array, index, d);
    }
}
