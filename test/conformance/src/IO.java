import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.zip.*;
import java.util.Properties;

public class IO {
    public static void main(String[] args) throws Exception {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        DataOutputStream data = new DataOutputStream(bytes);
        data.writeInt(-42);
        data.writeLong(Long.MAX_VALUE);
        data.writeDouble(Math.PI);
        data.writeUTF("héllo ☃");
        data.writeBoolean(true);
        data.writeShort(65535);
        data.writeFloat(1.25f);
        data.flush();
        System.out.println("bytes " + bytes.size());
        DataInputStream in = new DataInputStream(new ByteArrayInputStream(bytes.toByteArray()));
        System.out.println(in.readInt() + " " + in.readLong() + " " + in.readDouble() + " " + in.readUTF() + " " + in.readBoolean() + " " + in.readShort() + " " + in.readFloat() + " " + in.read());
        BufferedReader reader = new BufferedReader(new StringReader("line one\nline two\r\nline three"));
        String line;
        int n = 0;
        while ((line = reader.readLine()) != null) System.out.println(++n + ": " + line);
        StringWriter sw = new StringWriter();
        PrintWriter pw = new PrintWriter(sw);
        pw.printf("%s=%d%n", "x", 5);
        pw.print(1.5);
        pw.flush();
        System.out.println(sw.toString().replace("\n", "\\n"));
        File dir = new File("/tmp/iotest");
        System.out.println(dir.mkdirs() + " " + dir.isDirectory() + " " + dir.exists());
        File file = new File(dir, "data.txt");
        try (Writer w = new OutputStreamWriter(new FileOutputStream(file), StandardCharsets.UTF_8)) {
            w.write("first line\nsecond ünïcode line\n");
        }
        try (FileOutputStream append = new FileOutputStream(file, true)) {
            append.write("third\n".getBytes(StandardCharsets.UTF_8));
        }
        System.out.println(file.exists() + " " + file.isFile() + " " + file.length() + " " + file.getName() + " " + file.getParent() + " " + file.getPath());
        try (BufferedReader br = new BufferedReader(new InputStreamReader(new FileInputStream(file), StandardCharsets.UTF_8))) {
            br.lines().forEach(l -> System.out.println("> " + l));
        }
        File renamed = new File(dir, "moved.txt");
        System.out.println(file.renameTo(renamed) + " " + file.exists() + " " + renamed.exists() + " " + java.util.Arrays.toString(dir.list()));
        try {
            new FileInputStream(new File(dir, "nope.txt"));
        } catch (FileNotFoundException e) {
            System.out.println("FNFE " + e.getMessage());
        }
        System.out.println(renamed.delete() + " " + renamed.exists() + " " + dir.delete() + " " + dir.exists());
        ByteArrayOutputStream gz = new ByteArrayOutputStream();
        try (GZIPOutputStream out = new GZIPOutputStream(gz)) {
            for (int i = 0; i < 100; i++) out.write(("repeated text " + i + "\n").getBytes(StandardCharsets.UTF_8));
        }
        byte[] compressed = gz.toByteArray();
        System.out.println("compressed smaller " + (compressed.length < 1500) + " magic " + (compressed[0] & 0xff) + " " + (compressed[1] & 0xff));
        try (BufferedReader br = new BufferedReader(new InputStreamReader(new GZIPInputStream(new ByteArrayInputStream(compressed)), StandardCharsets.UTF_8))) {
            int count = 0;
            String last = null;
            for (String l; (l = br.readLine()) != null; count++) last = l;
            System.out.println(count + " " + last);
        }
        CRC32 crc = new CRC32();
        crc.update("hello world".getBytes(StandardCharsets.US_ASCII));
        Adler32 adler = new Adler32();
        adler.update("hello world".getBytes(StandardCharsets.US_ASCII));
        System.out.println(Long.toHexString(crc.getValue()) + " " + Long.toHexString(adler.getValue()));
        Deflater deflater = new Deflater();
        byte[] input = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbbbbbbbbbbbbbbbbb".getBytes(StandardCharsets.US_ASCII);
        deflater.setInput(input);
        deflater.finish();
        byte[] buf = new byte[100];
        int len = deflater.deflate(buf);
        deflater.end();
        Inflater inflater = new Inflater();
        inflater.setInput(buf, 0, len);
        byte[] result = new byte[100];
        int outLen = inflater.inflate(result);
        System.out.println(inflater.finished() + " " + outLen + " " + new String(result, 0, outLen, StandardCharsets.US_ASCII).equals(new String(input, StandardCharsets.US_ASCII)));
        inflater.end();
        Properties props = new Properties();
        props.load(new StringReader("# comment\nkey=value\nspaced = with spaces \nunicode=\\u00e9\n"));
        System.out.println(props.getProperty("key") + "|" + props.getProperty("spaced") + "|" + props.getProperty("unicode") + "|" + props.getProperty("missing", "dflt") + "|" + props.size());
        PushbackInputStream pb = new PushbackInputStream(new ByteArrayInputStream(new byte[] {1, 2, 3}));
        int first = pb.read();
        pb.unread(first);
        System.out.println(pb.read() + " " + pb.read() + " " + pb.available());
        System.err.println("to stderr");
    }
}
