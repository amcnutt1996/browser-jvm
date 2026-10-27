package java.security;

import java.util.Random;

public class SecureRandom extends Random {
    private static final long serialVersionUID = 4940670005562187L;

    private final String algorithm;

    public SecureRandom() {
        this("NativePRNG");
    }

    public SecureRandom(byte[] seed) {
        this("NativePRNG");
    }

    private SecureRandom(String algorithm) {
        super(0);
        this.algorithm = algorithm;
    }

    public static SecureRandom getInstance(String algorithm) throws NoSuchAlgorithmException {
        if (algorithm == null) {
            throw new NullPointerException("null algorithm name");
        }
        return new SecureRandom(algorithm);
    }

    public static SecureRandom getInstance(String algorithm, String provider) throws NoSuchAlgorithmException {
        return getInstance(algorithm);
    }

    public static SecureRandom getInstanceStrong() throws NoSuchAlgorithmException {
        return new SecureRandom("NativePRNGBlocking");
    }

    public String getAlgorithm() {
        return algorithm;
    }

    public synchronized void setSeed(byte[] seed) {
    }

    @Override
    public void setSeed(long seed) {
    }

    @Override
    public void nextBytes(byte[] bytes) {
        fill(bytes);
    }

    @Override
    protected final int next(int numBits) {
        byte[] bytes = new byte[4];
        fill(bytes);
        int value = ((bytes[0] & 0xff) << 24) | ((bytes[1] & 0xff) << 16) | ((bytes[2] & 0xff) << 8) | (bytes[3] & 0xff);
        return value >>> (32 - numBits);
    }

    public static byte[] getSeed(int numBytes) {
        byte[] seed = new byte[numBytes];
        fill(seed);
        return seed;
    }

    public byte[] generateSeed(int numBytes) {
        return getSeed(numBytes);
    }

    public String toString() {
        return algorithm;
    }

    private static native void fill(byte[] bytes);
}
