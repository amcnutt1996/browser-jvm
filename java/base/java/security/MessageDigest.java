package java.security;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;

/**
 * MD5, SHA-1 and SHA-256 computed natively; there is no provider framework.
 */
public abstract class MessageDigest extends MessageDigestSpi {
    private final String algorithm;
    private ByteArrayOutputStream data = new ByteArrayOutputStream();

    protected MessageDigest(String algorithm) {
        this.algorithm = algorithm;
    }

    private static final class Impl extends MessageDigest {
        Impl(String algorithm) {
            super(algorithm);
        }
    }

    private static String canonical(String algorithm) {
        String upper = algorithm.toUpperCase();
        switch (upper) {
            case "MD5":
                return "MD5";
            case "SHA":
            case "SHA1":
            case "SHA-1":
                return "SHA-1";
            case "SHA256":
            case "SHA-256":
                return "SHA-256";
            default:
                return null;
        }
    }

    public static MessageDigest getInstance(String algorithm) throws NoSuchAlgorithmException {
        String name = canonical(algorithm);
        if (name == null) {
            throw new NoSuchAlgorithmException(algorithm + " MessageDigest not available");
        }
        return new Impl(name);
    }

    public static MessageDigest getInstance(String algorithm, String provider) throws NoSuchAlgorithmException {
        return getInstance(algorithm);
    }

    public final String getAlgorithm() {
        return algorithm;
    }

    public final int getDigestLength() {
        switch (algorithm) {
            case "MD5":
                return 16;
            case "SHA-1":
                return 20;
            default:
                return 32;
        }
    }

    public void update(byte input) {
        data.write(input);
    }

    public void update(byte[] input, int offset, int len) {
        data.write(input, offset, len);
    }

    public void update(byte[] input) {
        data.write(input, 0, input.length);
    }

    public final void update(ByteBuffer input) {
        byte[] copy = new byte[input.remaining()];
        input.get(copy);
        update(copy);
    }

    public byte[] digest() {
        byte[] result = compute(algorithm, data.toByteArray());
        reset();
        return result;
    }

    public int digest(byte[] buf, int offset, int len) throws DigestException {
        byte[] result = digest();
        if (len < result.length) {
            throw new DigestException("partial digests not returned");
        }
        System.arraycopy(result, 0, buf, offset, result.length);
        return result.length;
    }

    public byte[] digest(byte[] input) {
        update(input);
        return digest();
    }

    public void reset() {
        data = new ByteArrayOutputStream();
    }

    public static boolean isEqual(byte[] digesta, byte[] digestb) {
        return java.util.Arrays.equals(digesta, digestb);
    }

    public String toString() {
        return algorithm + " Message Digest from gregOS";
    }

    public Object clone() throws CloneNotSupportedException {
        MessageDigest copy = new Impl(algorithm);
        copy.update(data.toByteArray());
        return copy;
    }

    protected void engineUpdate(byte input) {
        update(input);
    }

    protected void engineUpdate(byte[] input, int offset, int len) {
        update(input, offset, len);
    }

    protected byte[] engineDigest() {
        return digest();
    }

    protected void engineReset() {
        reset();
    }

    private static native byte[] compute(String algorithm, byte[] data);
}
