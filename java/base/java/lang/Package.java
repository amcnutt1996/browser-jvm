package java.lang;

import java.lang.annotation.Annotation;
import java.lang.reflect.AnnotatedElement;

public class Package implements AnnotatedElement {
    private final String name;
    private final String specTitle;
    private final String specVersion;
    private final String specVendor;
    private final String implTitle;
    private final String implVersion;
    private final String implVendor;

    private Package(String name, String[] attributes) {
        this.name = name;
        this.specTitle = attributes[0];
        this.specVersion = attributes[1];
        this.specVendor = attributes[2];
        this.implTitle = attributes[3];
        this.implVersion = attributes[4];
        this.implVendor = attributes[5];
    }

    static Package of(Class<?> c) {
        return new Package(c.getPackageName(), manifestAttributes(c));
    }

    private static native String[] manifestAttributes(Class<?> c);

    public String getName() {
        return name;
    }

    public String getSpecificationTitle() {
        return specTitle;
    }

    public String getSpecificationVersion() {
        return specVersion;
    }

    public String getSpecificationVendor() {
        return specVendor;
    }

    public String getImplementationTitle() {
        return implTitle;
    }

    public String getImplementationVersion() {
        return implVersion;
    }

    public String getImplementationVendor() {
        return implVendor;
    }

    public boolean isSealed() {
        return false;
    }

    public boolean isCompatibleWith(String desired) {
        return true;
    }

    public static Package getPackage(String name) {
        return null;
    }

    public static Package[] getPackages() {
        return new Package[0];
    }

    public int hashCode() {
        return name.hashCode();
    }

    public String toString() {
        return "package " + name;
    }

    public <A extends Annotation> A getAnnotation(Class<A> annotationClass) {
        return null;
    }

    public Annotation[] getAnnotations() {
        return new Annotation[0];
    }

    public Annotation[] getDeclaredAnnotations() {
        return new Annotation[0];
    }
}
