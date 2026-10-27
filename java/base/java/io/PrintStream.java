package java.io;

import java.nio.charset.Charset;
import java.util.Formatter;
import java.util.Locale;

public class PrintStream extends FilterOutputStream implements Appendable, Closeable {
    private final boolean autoFlush;
    private boolean trouble = false;
    private boolean closing = false;
    private final String charsetName;

    public PrintStream(OutputStream out) {
        this(out, false);
    }

    public PrintStream(OutputStream out, boolean autoFlush) {
        super(out);
        if (out == null) {
            throw new NullPointerException("Null output stream");
        }
        this.autoFlush = autoFlush;
        this.charsetName = "UTF-8";
    }

    public PrintStream(OutputStream out, boolean autoFlush, String encoding) throws UnsupportedEncodingException {
        super(out);
        if (out == null) {
            throw new NullPointerException("Null output stream");
        }
        if (encoding == null) {
            throw new NullPointerException("charsetName");
        }
        this.autoFlush = autoFlush;
        this.charsetName = encoding;
    }

    public PrintStream(OutputStream out, boolean autoFlush, Charset charset) {
        super(out);
        this.autoFlush = autoFlush;
        this.charsetName = charset.name();
    }

    public PrintStream(String fileName) throws FileNotFoundException {
        this(new FileOutputStream(fileName), false);
    }

    public PrintStream(String fileName, String csn) throws FileNotFoundException, UnsupportedEncodingException {
        this(new FileOutputStream(fileName), false, csn);
    }

    public PrintStream(String fileName, Charset charset) throws IOException {
        this(new FileOutputStream(fileName), false, charset);
    }

    public PrintStream(File file) throws FileNotFoundException {
        this(new FileOutputStream(file), false);
    }

    public PrintStream(File file, String csn) throws FileNotFoundException, UnsupportedEncodingException {
        this(new FileOutputStream(file), false, csn);
    }

    public PrintStream(File file, Charset charset) throws IOException {
        this(new FileOutputStream(file), false, charset);
    }

    public Charset charset() {
        return Charset.forName(charsetName);
    }

    public void flush() {
        synchronized (this) {
            try {
                out.flush();
            } catch (IOException x) {
                trouble = true;
            }
        }
    }

    public void close() {
        synchronized (this) {
            if (!closing) {
                closing = true;
                try {
                    out.close();
                } catch (IOException x) {
                    trouble = true;
                }
            }
        }
    }

    public boolean checkError() {
        if (out != null) {
            flush();
        }
        return trouble;
    }

    protected void setError() {
        trouble = true;
    }

    protected void clearError() {
        trouble = false;
    }

    public void write(int b) {
        try {
            synchronized (this) {
                out.write(b);
                if ((b == '\n') && autoFlush) {
                    out.flush();
                }
            }
        } catch (IOException x) {
            trouble = true;
        }
    }

    public void write(byte[] buf, int off, int len) {
        try {
            synchronized (this) {
                out.write(buf, off, len);
                if (autoFlush) {
                    out.flush();
                }
            }
        } catch (IOException x) {
            trouble = true;
        }
    }

    public void write(byte[] buf) throws IOException {
        this.write(buf, 0, buf.length);
    }

    public void writeBytes(byte[] buf) {
        this.write(buf, 0, buf.length);
    }

    private void writeString(String s) {
        try {
            byte[] bytes = s.getBytes(charsetName);
            synchronized (this) {
                out.write(bytes, 0, bytes.length);
                if (autoFlush && s.indexOf('\n') >= 0) {
                    out.flush();
                }
            }
        } catch (IOException x) {
            trouble = true;
        }
    }

    private void newLine() {
        writeString("\n");
    }

    public void print(boolean b) {
        writeString(String.valueOf(b));
    }

    public void print(char c) {
        writeString(String.valueOf(c));
    }

    public void print(int i) {
        writeString(String.valueOf(i));
    }

    public void print(long l) {
        writeString(String.valueOf(l));
    }

    public void print(float f) {
        writeString(String.valueOf(f));
    }

    public void print(double d) {
        writeString(String.valueOf(d));
    }

    public void print(char[] s) {
        writeString(String.valueOf(s));
    }

    public void print(String s) {
        writeString(String.valueOf(s));
    }

    public void print(Object obj) {
        writeString(String.valueOf(obj));
    }

    public void println() {
        newLine();
    }

    public void println(boolean x) {
        writeString(String.valueOf(x) + "\n");
    }

    public void println(char x) {
        writeString(String.valueOf(x) + "\n");
    }

    public void println(int x) {
        writeString(String.valueOf(x) + "\n");
    }

    public void println(long x) {
        writeString(String.valueOf(x) + "\n");
    }

    public void println(float x) {
        writeString(String.valueOf(x) + "\n");
    }

    public void println(double x) {
        writeString(String.valueOf(x) + "\n");
    }

    public void println(char[] x) {
        writeString(String.valueOf(x) + "\n");
    }

    public void println(String x) {
        writeString(String.valueOf(x) + "\n");
    }

    public void println(Object x) {
        writeString(String.valueOf(x) + "\n");
    }

    public PrintStream printf(String format, Object... args) {
        return format(format, args);
    }

    public PrintStream printf(Locale l, String format, Object... args) {
        return format(l, format, args);
    }

    public PrintStream format(String format, Object... args) {
        writeString(new Formatter().format(format, args).toString());
        return this;
    }

    public PrintStream format(Locale l, String format, Object... args) {
        writeString(new Formatter(l).format(format, args).toString());
        return this;
    }

    public PrintStream append(CharSequence csq) {
        print(String.valueOf(csq));
        return this;
    }

    public PrintStream append(CharSequence csq, int start, int end) {
        if (csq == null) {
            csq = "null";
        }
        return append(csq.subSequence(start, end));
    }

    public PrintStream append(char c) {
        print(c);
        return this;
    }
}
