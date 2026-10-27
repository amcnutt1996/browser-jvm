package java.util.zip;

import java.nio.ByteBuffer;

public class Deflater {
    public static final int DEFLATED = 8;
    public static final int NO_COMPRESSION = 0;
    public static final int BEST_SPEED = 1;
    public static final int BEST_COMPRESSION = 9;
    public static final int DEFAULT_COMPRESSION = -1;
    public static final int FILTERED = 1;
    public static final int HUFFMAN_ONLY = 2;
    public static final int DEFAULT_STRATEGY = 0;
    public static final int NO_FLUSH = 0;
    public static final int SYNC_FLUSH = 2;
    public static final int FULL_FLUSH = 3;

    private Object stream;
    private byte[] input = new byte[0];
    private int inputPos;
    private int inputLim;
    private int level;
    private int strategy;
    private boolean setParams;
    private boolean finish;
    private boolean finished;
    private long bytesRead;
    private long bytesWritten;
    private final boolean nowrap;
    private boolean ended;

    public Deflater(int level, boolean nowrap) {
        if ((level < 0 || level > 9) && level != DEFAULT_COMPRESSION) {
            throw new IllegalArgumentException("invalid compression level");
        }
        this.level = level;
        this.strategy = DEFAULT_STRATEGY;
        this.nowrap = nowrap;
        init(level, strategy, nowrap);
    }

    public Deflater(int level) {
        this(level, false);
    }

    public Deflater() {
        this(DEFAULT_COMPRESSION, false);
    }

    private native void init(int level, int strategy, boolean nowrap);

    public void setInput(byte[] input, int off, int len) {
        if (off < 0 || len < 0 || off > input.length - len) {
            throw new ArrayIndexOutOfBoundsException();
        }
        this.input = input;
        this.inputPos = off;
        this.inputLim = off + len;
    }

    public void setInput(byte[] input) {
        setInput(input, 0, input.length);
    }

    public void setInput(ByteBuffer input) {
        byte[] copy = new byte[input.remaining()];
        input.get(copy);
        setInput(copy);
    }

    public void setDictionary(byte[] dictionary, int off, int len) {
        ensureOpen();
        setDictionary0(dictionary, off, len);
    }

    public void setDictionary(byte[] dictionary) {
        setDictionary(dictionary, 0, dictionary.length);
    }

    public void setDictionary(ByteBuffer dictionary) {
        byte[] copy = new byte[dictionary.remaining()];
        dictionary.get(copy);
        setDictionary(copy);
    }

    private native void setDictionary0(byte[] dictionary, int off, int len);

    public void setStrategy(int strategy) {
        if (strategy != DEFAULT_STRATEGY && strategy != FILTERED && strategy != HUFFMAN_ONLY) {
            throw new IllegalArgumentException();
        }
        if (this.strategy != strategy) {
            this.strategy = strategy;
            setParams = true;
        }
    }

    public void setLevel(int level) {
        if ((level < 0 || level > 9) && level != DEFAULT_COMPRESSION) {
            throw new IllegalArgumentException("invalid compression level");
        }
        if (this.level != level) {
            this.level = level;
            setParams = true;
        }
    }

    public boolean needsInput() {
        return inputLim - inputPos <= 0;
    }

    public void finish() {
        finish = true;
    }

    public boolean finished() {
        return finished;
    }

    public int deflate(byte[] output, int off, int len) {
        return deflate(output, off, len, NO_FLUSH);
    }

    public int deflate(byte[] output) {
        return deflate(output, 0, output.length, NO_FLUSH);
    }

    public int deflate(ByteBuffer output) {
        return deflate(output, NO_FLUSH);
    }

    public int deflate(byte[] output, int off, int len, int flush) {
        if (off < 0 || len < 0 || off > output.length - len) {
            throw new ArrayIndexOutOfBoundsException();
        }
        if (flush != NO_FLUSH && flush != SYNC_FLUSH && flush != FULL_FLUSH) {
            throw new IllegalArgumentException();
        }
        ensureOpen();
        if (setParams) {
            setParams = false;
            params0(level, strategy);
        }
        return deflate0(output, off, len, finish ? 4 : flush);
    }

    public int deflate(ByteBuffer output, int flush) {
        byte[] tmp = new byte[output.remaining()];
        int n = deflate(tmp, 0, tmp.length, flush);
        output.put(tmp, 0, n);
        return n;
    }

    private native void params0(int level, int strategy);

    private native int deflate0(byte[] output, int off, int len, int flush);

    public native int getAdler();

    public int getTotalIn() {
        return (int) bytesRead;
    }

    public long getBytesRead() {
        return bytesRead;
    }

    public int getTotalOut() {
        return (int) bytesWritten;
    }

    public long getBytesWritten() {
        return bytesWritten;
    }

    public void reset() {
        ensureOpen();
        init(level, strategy, nowrap);
        input = new byte[0];
        inputPos = 0;
        inputLim = 0;
        finish = false;
        finished = false;
        bytesRead = 0;
        bytesWritten = 0;
    }

    public void end() {
        ended = true;
        stream = null;
    }

    private void ensureOpen() {
        if (ended) {
            throw new NullPointerException("Deflater has been closed");
        }
    }
}
