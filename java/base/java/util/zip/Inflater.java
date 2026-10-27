package java.util.zip;

import java.nio.ByteBuffer;

public class Inflater {
    private Object stream;
    private byte[] input = new byte[0];
    private int inputPos;
    private int inputLim;
    private boolean finished;
    private boolean needDict;
    private long bytesRead;
    private long bytesWritten;
    private final boolean nowrap;
    private boolean ended;
    private boolean pendingOutput;

    public Inflater(boolean nowrap) {
        this.nowrap = nowrap;
        init(nowrap);
    }

    public Inflater() {
        this(false);
    }

    private native void init(boolean nowrap);

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
        needDict = false;
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

    boolean hasPendingOutput() {
        return pendingOutput;
    }

    public int getRemaining() {
        return inputLim - inputPos;
    }

    public boolean needsInput() {
        return inputLim - inputPos <= 0;
    }

    public boolean needsDictionary() {
        return needDict;
    }

    public boolean finished() {
        return finished;
    }

    public int inflate(byte[] output, int off, int len) throws DataFormatException {
        if (off < 0 || len < 0 || off > output.length - len) {
            throw new ArrayIndexOutOfBoundsException();
        }
        ensureOpen();
        return inflate0(output, off, len);
    }

    private native int inflate0(byte[] output, int off, int len) throws DataFormatException;

    public int inflate(byte[] output) throws DataFormatException {
        return inflate(output, 0, output.length);
    }

    public int inflate(ByteBuffer output) throws DataFormatException {
        byte[] tmp = new byte[output.remaining()];
        int n = inflate(tmp, 0, tmp.length);
        output.put(tmp, 0, n);
        return n;
    }

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
        init(nowrap);
        input = new byte[0];
        inputPos = 0;
        inputLim = 0;
        finished = false;
        needDict = false;
        pendingOutput = false;
        bytesRead = 0;
        bytesWritten = 0;
    }

    public void end() {
        ended = true;
        stream = null;
    }

    private void ensureOpen() {
        if (ended) {
            throw new NullPointerException("Inflater has been closed");
        }
    }
}
