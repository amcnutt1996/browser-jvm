package java.lang;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.util.Collections;
import java.util.Enumeration;

public abstract class ClassLoader {
    private final ClassLoader parent;
    private static ClassLoader system;

    protected ClassLoader() {
        this(null);
    }

    protected ClassLoader(ClassLoader parent) {
        this.parent = parent;
    }

    protected ClassLoader(String name, ClassLoader parent) {
        this(parent);
    }

    public String getName() {
        return "app";
    }

    public final ClassLoader getParent() {
        return parent;
    }

    public Class<?> loadClass(String name) throws ClassNotFoundException {
        return loadClass(name, false);
    }

    protected Class<?> loadClass(String name, boolean resolve) throws ClassNotFoundException {
        return Class.forName(name, false, this);
    }

    protected Class<?> findClass(String name) throws ClassNotFoundException {
        throw new ClassNotFoundException(name);
    }

    protected final Class<?> findLoadedClass(String name) {
        return null;
    }

    public URL getResource(String name) {
        return getSystemResource(name);
    }

    public Enumeration<URL> getResources(String name) throws IOException {
        URL url = getResource(name);
        return url == null ? Collections.emptyEnumeration() : Collections.enumeration(Collections.singletonList(url));
    }

    public InputStream getResourceAsStream(String name) {
        return getSystemResourceAsStream(name);
    }

    public static ClassLoader getSystemClassLoader() {
        if (system == null) {
            system = new ClassLoader() {
            };
        }
        return system;
    }

    public static ClassLoader getPlatformClassLoader() {
        return getSystemClassLoader();
    }

    public static URL getSystemResource(String name) {
        return null;
    }

    public static Enumeration<URL> getSystemResources(String name) throws IOException {
        return Collections.emptyEnumeration();
    }

    public static InputStream getSystemResourceAsStream(String name) {
        byte[] data = readResource(name);
        return data == null ? null : new ByteArrayInputStream(data);
    }

    private static native byte[] readResource(String name);

    public void setDefaultAssertionStatus(boolean enabled) {
    }

    public void setPackageAssertionStatus(String packageName, boolean enabled) {
    }

    public void setClassAssertionStatus(String className, boolean enabled) {
    }

    public void clearAssertionStatus() {
    }

    protected Package getPackage(String name) {
        return null;
    }

    public final Package getDefinedPackage(String name) {
        return null;
    }

    protected Package[] getPackages() {
        return new Package[0];
    }
}
