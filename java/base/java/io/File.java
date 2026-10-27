package java.io;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;

public class File implements Serializable, Comparable<File> {
    public static final char separatorChar = '/';
    public static final String separator = "/";
    public static final char pathSeparatorChar = ':';
    public static final String pathSeparator = ":";

    private final String path;

    public File(String pathname) {
        if (pathname == null) {
            throw new NullPointerException();
        }
        this.path = normalize(pathname);
    }

    public File(String parent, String child) {
        if (child == null) {
            throw new NullPointerException();
        }
        if (parent != null) {
            this.path = resolve(normalize(parent), normalize(child));
        } else {
            this.path = normalize(child);
        }
    }

    public File(File parent, String child) {
        if (child == null) {
            throw new NullPointerException();
        }
        if (parent != null) {
            this.path = resolve(parent.path, normalize(child));
        } else {
            this.path = normalize(child);
        }
    }

    public File(URI uri) {
        this(uri.getPath());
    }

    private static String normalize(String pathname) {
        StringBuilder sb = new StringBuilder(pathname.length());
        char prev = 0;
        for (int i = 0; i < pathname.length(); i++) {
            char c = pathname.charAt(i);
            if (c == '\\') {
                c = '/';
            }
            if (c == '/' && prev == '/') {
                continue;
            }
            sb.append(c);
            prev = c;
        }
        int n = sb.length();
        if (n > 1 && sb.charAt(n - 1) == '/') {
            sb.setLength(n - 1);
        }
        return sb.toString();
    }

    private static String resolve(String parent, String child) {
        if (child.isEmpty()) {
            return parent;
        }
        if (child.charAt(0) == '/') {
            if (parent.equals("/")) {
                return child;
            }
            return parent + child;
        }
        if (parent.equals("/")) {
            return parent + child;
        }
        if (parent.isEmpty()) {
            return "/" + child;
        }
        return parent + '/' + child;
    }

    final boolean isInvalid() {
        return path.indexOf('\u0000') >= 0;
    }

    public String getName() {
        int index = path.lastIndexOf(separatorChar);
        return path.substring(index + 1);
    }

    public String getParent() {
        int index = path.lastIndexOf(separatorChar);
        if (index < 0) {
            return null;
        }
        if (index == 0) {
            return path.length() > 1 ? "/" : null;
        }
        return path.substring(0, index);
    }

    public File getParentFile() {
        String p = getParent();
        return p == null ? null : new File(p);
    }

    public String getPath() {
        return path;
    }

    public boolean isAbsolute() {
        return path.startsWith("/");
    }

    public String getAbsolutePath() {
        if (isAbsolute()) {
            return path;
        }
        return resolve(System.getProperty("user.dir"), path);
    }

    public File getAbsoluteFile() {
        return new File(getAbsolutePath());
    }

    public String getCanonicalPath() throws IOException {
        String[] parts = getAbsolutePath().split("/");
        List<String> out = new ArrayList<>();
        for (String part : parts) {
            if (part.isEmpty() || part.equals(".")) {
                continue;
            }
            if (part.equals("..")) {
                if (!out.isEmpty()) {
                    out.remove(out.size() - 1);
                }
            } else {
                out.add(part);
            }
        }
        return "/" + String.join("/", out);
    }

    public File getCanonicalFile() throws IOException {
        return new File(getCanonicalPath());
    }

    @Deprecated
    public java.net.URL toURL() throws java.net.MalformedURLException {
        return new java.net.URL("file", "", getAbsolutePath());
    }

    public URI toURI() {
        try {
            String p = getAbsolutePath();
            if (isDirectory() && !p.endsWith("/")) {
                p = p + "/";
            }
            return new URI("file", null, p, null);
        } catch (java.net.URISyntaxException x) {
            throw new Error(x);
        }
    }

    public boolean canRead() {
        return exists();
    }

    public boolean canWrite() {
        return true;
    }

    public boolean exists() {
        return stat0(getAbsolutePath()) != null;
    }

    public boolean isDirectory() {
        long[] stat = stat0(getAbsolutePath());
        return stat != null && stat[0] == 1;
    }

    public boolean isFile() {
        long[] stat = stat0(getAbsolutePath());
        return stat != null && stat[0] == 0;
    }

    public boolean isHidden() {
        return getName().startsWith(".");
    }

    public long lastModified() {
        long[] stat = stat0(getAbsolutePath());
        return stat == null ? 0L : stat[2];
    }

    public long length() {
        long[] stat = stat0(getAbsolutePath());
        return stat == null || stat[0] == 1 ? 0L : stat[1];
    }

    private static native long[] stat0(String path);

    public boolean createNewFile() throws IOException {
        if (exists()) {
            return false;
        }
        return create0(getAbsolutePath());
    }

    private static native boolean create0(String path) throws IOException;

    public boolean delete() {
        return delete0(getAbsolutePath());
    }

    private static native boolean delete0(String path);

    public void deleteOnExit() {
    }

    public String[] list() {
        return list0(getAbsolutePath());
    }

    private static native String[] list0(String path);

    public String[] list(FilenameFilter filter) {
        String[] names = list();
        if ((names == null) || (filter == null)) {
            return names;
        }
        List<String> v = new ArrayList<>();
        for (int i = 0; i < names.length; i++) {
            if (filter.accept(this, names[i])) {
                v.add(names[i]);
            }
        }
        return v.toArray(new String[v.size()]);
    }

    public File[] listFiles() {
        String[] ss = list();
        if (ss == null) {
            return null;
        }
        int n = ss.length;
        File[] fs = new File[n];
        for (int i = 0; i < n; i++) {
            fs[i] = new File(this, ss[i]);
        }
        return fs;
    }

    public File[] listFiles(FilenameFilter filter) {
        String[] ss = list();
        if (ss == null) {
            return null;
        }
        ArrayList<File> files = new ArrayList<>();
        for (String s : ss) {
            if ((filter == null) || filter.accept(this, s)) {
                files.add(new File(this, s));
            }
        }
        return files.toArray(new File[files.size()]);
    }

    public File[] listFiles(FileFilter filter) {
        String[] ss = list();
        if (ss == null) {
            return null;
        }
        ArrayList<File> files = new ArrayList<>();
        for (String s : ss) {
            File f = new File(this, s);
            if ((filter == null) || filter.accept(f)) {
                files.add(f);
            }
        }
        return files.toArray(new File[files.size()]);
    }

    public boolean mkdir() {
        if (exists()) {
            return false;
        }
        File parent = getAbsoluteFile().getParentFile();
        if (parent != null && !parent.isDirectory()) {
            return false;
        }
        return mkdir0(getAbsolutePath());
    }

    private static native boolean mkdir0(String path);

    public boolean mkdirs() {
        if (exists()) {
            return false;
        }
        if (mkdir()) {
            return true;
        }
        File canonFile;
        try {
            canonFile = getCanonicalFile();
        } catch (IOException e) {
            return false;
        }
        File parent = canonFile.getParentFile();
        return (parent != null && (parent.mkdirs() || parent.exists()) && canonFile.mkdir());
    }

    public boolean renameTo(File dest) {
        if (dest == null) {
            throw new NullPointerException();
        }
        return rename0(getAbsolutePath(), dest.getAbsolutePath());
    }

    private static native boolean rename0(String from, String to);

    public boolean setLastModified(long time) {
        return exists();
    }

    public boolean setReadOnly() {
        return exists();
    }

    public boolean setWritable(boolean writable, boolean ownerOnly) {
        return exists();
    }

    public boolean setWritable(boolean writable) {
        return exists();
    }

    public boolean setReadable(boolean readable, boolean ownerOnly) {
        return exists();
    }

    public boolean setReadable(boolean readable) {
        return exists();
    }

    public boolean setExecutable(boolean executable, boolean ownerOnly) {
        return exists();
    }

    public boolean setExecutable(boolean executable) {
        return exists();
    }

    public boolean canExecute() {
        return false;
    }

    public static File[] listRoots() {
        return new File[] {new File("/")};
    }

    public long getTotalSpace() {
        return 1L << 32;
    }

    public long getFreeSpace() {
        return 1L << 31;
    }

    public long getUsableSpace() {
        return 1L << 31;
    }

    private static int tempCounter;

    public static File createTempFile(String prefix, String suffix, File directory) throws IOException {
        if (prefix.length() < 3) {
            throw new IllegalArgumentException("Prefix string \"" + prefix + "\" too short: length must be at least 3");
        }
        if (suffix == null) {
            suffix = ".tmp";
        }
        File dir = directory != null ? directory : new File(System.getProperty("java.io.tmpdir"));
        dir.mkdirs();
        File f;
        do {
            f = new File(dir, prefix + (System.nanoTime() & 0xffffff) + (tempCounter++) + suffix);
        } while (f.exists());
        f.createNewFile();
        return f;
    }

    public static File createTempFile(String prefix, String suffix) throws IOException {
        return createTempFile(prefix, suffix, null);
    }

    public int compareTo(File pathname) {
        return path.compareTo(pathname.path);
    }

    public boolean equals(Object obj) {
        return (obj instanceof File) && compareTo((File) obj) == 0;
    }

    public int hashCode() {
        return path.hashCode() ^ 1234321;
    }

    public String toString() {
        return getPath();
    }

    public java.nio.file.Path toPath() {
        throw new UnsupportedOperationException("java.nio.file is not available");
    }
}
