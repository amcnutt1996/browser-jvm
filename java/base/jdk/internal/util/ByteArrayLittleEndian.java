package jdk.internal.util;

public final class ByteArrayLittleEndian {
    private ByteArrayLittleEndian() {
    }

    private static void check(byte[] array, int offset, int size) {
        if (offset < 0 || offset > array.length - size) {
            throw new ArrayIndexOutOfBoundsException("Index " + offset + " out of bounds for length " + array.length);
        }
    }

    private static long read(byte[] array, int offset, int size) {
        check(array, offset, size);
        switch (size) {
            case 2: return ((long) (array[offset + 1] & 0xff) << 8) | ((long) (array[offset + 0] & 0xff) << 0);
            case 4: return ((long) (array[offset + 3] & 0xff) << 24) | ((long) (array[offset + 2] & 0xff) << 16) | ((long) (array[offset + 1] & 0xff) << 8) | ((long) (array[offset + 0] & 0xff) << 0);
            default: return ((long) (array[offset + 7] & 0xff) << 56) | ((long) (array[offset + 6] & 0xff) << 48) | ((long) (array[offset + 5] & 0xff) << 40) | ((long) (array[offset + 4] & 0xff) << 32) | ((long) (array[offset + 3] & 0xff) << 24) | ((long) (array[offset + 2] & 0xff) << 16) | ((long) (array[offset + 1] & 0xff) << 8) | ((long) (array[offset + 0] & 0xff) << 0);
        }
    }

    private static void write(byte[] array, int offset, int size, long value) {
        check(array, offset, size);
        switch (size) {
            case 2:
        array[offset + 1] = (byte) (value >> 8);
        array[offset + 0] = (byte) (value >> 0);
                break;
            case 4:
        array[offset + 3] = (byte) (value >> 24);
        array[offset + 2] = (byte) (value >> 16);
        array[offset + 1] = (byte) (value >> 8);
        array[offset + 0] = (byte) (value >> 0);
                break;
            default:
        array[offset + 7] = (byte) (value >> 56);
        array[offset + 6] = (byte) (value >> 48);
        array[offset + 5] = (byte) (value >> 40);
        array[offset + 4] = (byte) (value >> 32);
        array[offset + 3] = (byte) (value >> 24);
        array[offset + 2] = (byte) (value >> 16);
        array[offset + 1] = (byte) (value >> 8);
        array[offset + 0] = (byte) (value >> 0);
        }
    }

    public static boolean getBoolean(byte[] array, int offset) {
        return array[offset] != 0;
    }

    public static char getChar(byte[] array, int offset) {
        return (char) read(array, offset, 2);
    }

    public static short getShort(byte[] array, int offset) {
        return (short) read(array, offset, 2);
    }

    public static int getUnsignedShort(byte[] array, int offset) {
        return (int) read(array, offset, 2) & 0xffff;
    }

    public static int getInt(byte[] array, int offset) {
        return (int) read(array, offset, 4);
    }

    public static float getFloat(byte[] array, int offset) {
        return Float.intBitsToFloat(getInt(array, offset));
    }

    public static float getFloatRaw(byte[] array, int offset) {
        return Float.intBitsToFloat(getInt(array, offset));
    }

    public static long getLong(byte[] array, int offset) {
        return read(array, offset, 8);
    }

    public static double getDouble(byte[] array, int offset) {
        return Double.longBitsToDouble(getLong(array, offset));
    }

    public static double getDoubleRaw(byte[] array, int offset) {
        return Double.longBitsToDouble(getLong(array, offset));
    }

    public static void setBoolean(byte[] array, int offset, boolean value) {
        array[offset] = (byte) (value ? 1 : 0);
    }

    public static void setChar(byte[] array, int offset, char value) {
        write(array, offset, 2, value);
    }

    public static void setShort(byte[] array, int offset, short value) {
        write(array, offset, 2, value);
    }

    public static void setUnsignedShort(byte[] array, int offset, int value) {
        write(array, offset, 2, value);
    }

    public static void setInt(byte[] array, int offset, int value) {
        write(array, offset, 4, value);
    }

    public static void setFloat(byte[] array, int offset, float value) {
        write(array, offset, 4, Float.floatToIntBits(value));
    }

    public static void setFloatRaw(byte[] array, int offset, float value) {
        write(array, offset, 4, Float.floatToRawIntBits(value));
    }

    public static void setLong(byte[] array, int offset, long value) {
        write(array, offset, 8, value);
    }

    public static void setDouble(byte[] array, int offset, double value) {
        write(array, offset, 8, Double.doubleToLongBits(value));
    }

    public static void setDoubleRaw(byte[] array, int offset, double value) {
        write(array, offset, 8, Double.doubleToRawLongBits(value));
    }
}
