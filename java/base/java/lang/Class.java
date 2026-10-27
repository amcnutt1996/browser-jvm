package java.lang;

import java.io.InputStream;
import java.lang.annotation.Annotation;
import java.lang.reflect.AnnotatedElement;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.GenericDeclaration;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.lang.reflect.Type;
import java.lang.reflect.TypeVariable;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class Class<T> implements java.io.Serializable, GenericDeclaration, Type, AnnotatedElement {
    private static final int ANNOTATION = 0x00002000;
    private static final int ENUM = 0x00004000;
    private static final int SYNTHETIC = 0x00001000;

    private Class() {
    }

    public String toString() {
        String kind = isInterface() ? "interface " : isPrimitive() ? "" : "class ";
        return kind + getName();
    }

    public String toGenericString() {
        return toString();
    }

    public static Class<?> forName(String className) throws ClassNotFoundException {
        return forName0(className, true, null);
    }

    public static Class<?> forName(String name, boolean initialize, ClassLoader loader) throws ClassNotFoundException {
        return forName0(name, initialize, loader);
    }

    public static Class<?> forName(Module module, String name) {
        try {
            return forName0(name, false, null);
        } catch (ClassNotFoundException | LinkageError e) {
            return null;
        }
    }

    private static native Class<?> forName0(String name, boolean initialize, ClassLoader loader) throws ClassNotFoundException;

    @Deprecated(since = "9")
    public T newInstance() throws InstantiationException, IllegalAccessException {
        try {
            return getDeclaredConstructor().newInstance();
        } catch (NoSuchMethodException e) {
            throw new InstantiationException(getName());
        } catch (InvocationTargetException e) {
            Throwable cause = e.getCause();
            if (cause instanceof RuntimeException) {
                throw (RuntimeException) cause;
            }
            if (cause instanceof Error) {
                throw (Error) cause;
            }
            throw new RuntimeException(cause);
        }
    }

    public native boolean isInstance(Object obj);

    public native boolean isAssignableFrom(Class<?> cls);

    public native boolean isInterface();

    public native boolean isArray();

    public native boolean isPrimitive();

    public boolean isAnnotation() {
        return (getModifiers() & ANNOTATION) != 0;
    }

    public boolean isSynthetic() {
        return (getModifiers() & SYNTHETIC) != 0;
    }

    public native String getName();

    public ClassLoader getClassLoader() {
        return null;
    }

    public Module getModule() {
        return null;
    }

    @SuppressWarnings("unchecked")
    public TypeVariable<Class<T>>[] getTypeParameters() {
        return (TypeVariable<Class<T>>[]) new TypeVariable<?>[0];
    }

    public native Class<? super T> getSuperclass();

    public Type getGenericSuperclass() {
        return getSuperclass();
    }

    public Package getPackage() {
        if (isPrimitive() || isArray()) {
            return null;
        }
        return Package.of(this);
    }

    public String getPackageName() {
        Class<?> c = this;
        while (c.isArray()) {
            c = c.getComponentType();
        }
        if (c.isPrimitive()) {
            return "java.lang";
        }
        String cn = c.getName();
        int dot = cn.lastIndexOf('.');
        return (dot != -1) ? cn.substring(0, dot).intern() : "";
    }

    public native Class<?>[] getInterfaces();

    public Type[] getGenericInterfaces() {
        return getInterfaces();
    }

    public native Class<?> getComponentType();

    public Class<?> componentType() {
        return getComponentType();
    }

    public native Class<?> arrayType();

    public native int getModifiers();

    public Object[] getSigners() {
        return null;
    }

    public Method getEnclosingMethod() {
        return null;
    }

    public Constructor<?> getEnclosingConstructor() {
        return null;
    }

    public native Class<?> getDeclaringClass();

    public Class<?> getEnclosingClass() {
        return getDeclaringClass();
    }

    public native String getSimpleName();

    public String getTypeName() {
        if (isArray()) {
            Class<?> cl = this;
            int dimensions = 0;
            while (cl.isArray()) {
                dimensions++;
                cl = cl.getComponentType();
            }
            return cl.getName() + "[]".repeat(dimensions);
        }
        return getName();
    }

    public String getCanonicalName() {
        if (isArray()) {
            String canonicalName = getComponentType().getCanonicalName();
            return canonicalName == null ? null : canonicalName + "[]";
        }
        if (isAnonymousClass() || isLocalClass()) {
            return null;
        }
        Class<?> enclosingClass = getDeclaringClass();
        if (enclosingClass == null) {
            return getName();
        }
        String enclosingName = enclosingClass.getCanonicalName();
        return enclosingName == null ? null : enclosingName + "." + getSimpleName();
    }

    public native boolean isAnonymousClass();

    public boolean isLocalClass() {
        return false;
    }

    public boolean isMemberClass() {
        return getDeclaringClass() != null && !isAnonymousClass();
    }

    public Class<?>[] getClasses() {
        return new Class<?>[0];
    }

    public Field[] getFields() {
        List<Field> list = new ArrayList<>();
        for (Class<?> c = this; c != null; c = c.getSuperclass()) {
            for (Field f : c.getDeclaredFields()) {
                if (Modifier.isPublic(f.getModifiers())) {
                    list.add(f);
                }
            }
            for (Class<?> i : c.getInterfaces()) {
                for (Field f : i.getFields()) {
                    list.add(f);
                }
            }
        }
        return list.toArray(new Field[0]);
    }

    public Method[] getMethods() {
        Map<String, Method> map = new HashMap<>();
        List<Method> list = new ArrayList<>();
        collectPublicMethods(this, map, list);
        return list.toArray(new Method[0]);
    }

    private static void collectPublicMethods(Class<?> c, Map<String, Method> seen, List<Method> list) {
        for (Method m : c.getDeclaredMethods()) {
            if (Modifier.isPublic(m.getModifiers())) {
                String key = m.getName() + java.util.Arrays.toString(m.getParameterTypes());
                if (!seen.containsKey(key)) {
                    seen.put(key, m);
                    list.add(m);
                }
            }
        }
        Class<?> sup = c.getSuperclass();
        if (sup != null) {
            collectPublicMethods(sup, seen, list);
        }
        for (Class<?> i : c.getInterfaces()) {
            collectPublicMethods(i, seen, list);
        }
    }

    public Constructor<?>[] getConstructors() {
        List<Constructor<?>> list = new ArrayList<>();
        for (Constructor<?> c : getDeclaredConstructors()) {
            if (Modifier.isPublic(c.getModifiers())) {
                list.add(c);
            }
        }
        return list.toArray(new Constructor<?>[0]);
    }

    public Field getField(String name) throws NoSuchFieldException {
        for (Field f : getFields()) {
            if (f.getName().equals(name)) {
                return f;
            }
        }
        throw new NoSuchFieldException(name);
    }

    public Method getMethod(String name, Class<?>... parameterTypes) throws NoSuchMethodException {
        Method found = null;
        for (Method m : getMethods()) {
            if (m.getName().equals(name) && java.util.Arrays.equals(m.getParameterTypes(), parameterTypes == null ? new Class<?>[0] : parameterTypes)) {
                if (found == null || found.getReturnType().isAssignableFrom(m.getReturnType())) {
                    found = m;
                }
            }
        }
        if (found == null) {
            throw new NoSuchMethodException(getName() + "." + name + argumentTypesToString(parameterTypes));
        }
        return found;
    }

    public Constructor<T> getConstructor(Class<?>... parameterTypes) throws NoSuchMethodException {
        Constructor<T> c = getDeclaredConstructor(parameterTypes);
        if (!Modifier.isPublic(c.getModifiers())) {
            throw new NoSuchMethodException(getName() + ".<init>" + argumentTypesToString(parameterTypes));
        }
        return c;
    }

    public Class<?>[] getDeclaredClasses() {
        return new Class<?>[0];
    }

    public native Field[] getDeclaredFields();

    public native Method[] getDeclaredMethods();

    public native Constructor<?>[] getDeclaredConstructors();

    public Field getDeclaredField(String name) throws NoSuchFieldException {
        for (Field f : getDeclaredFields()) {
            if (f.getName().equals(name)) {
                return f;
            }
        }
        throw new NoSuchFieldException(name);
    }

    public Method getDeclaredMethod(String name, Class<?>... parameterTypes) throws NoSuchMethodException {
        Method found = null;
        for (Method m : getDeclaredMethods()) {
            if (m.getName().equals(name) && java.util.Arrays.equals(m.getParameterTypes(), parameterTypes == null ? new Class<?>[0] : parameterTypes)) {
                if (found == null || found.getReturnType().isAssignableFrom(m.getReturnType())) {
                    found = m;
                }
            }
        }
        if (found == null) {
            throw new NoSuchMethodException(getName() + "." + name + argumentTypesToString(parameterTypes));
        }
        return found;
    }

    @SuppressWarnings("unchecked")
    public Constructor<T> getDeclaredConstructor(Class<?>... parameterTypes) throws NoSuchMethodException {
        for (Constructor<?> c : getDeclaredConstructors()) {
            if (java.util.Arrays.equals(c.getParameterTypes(), parameterTypes == null ? new Class<?>[0] : parameterTypes)) {
                return (Constructor<T>) c;
            }
        }
        throw new NoSuchMethodException(getName() + ".<init>" + argumentTypesToString(parameterTypes));
    }

    private static String argumentTypesToString(Class<?>[] argTypes) {
        StringBuilder buf = new StringBuilder("(");
        if (argTypes != null) {
            for (int i = 0; i < argTypes.length; i++) {
                if (i > 0) {
                    buf.append(", ");
                }
                Class<?> c = argTypes[i];
                buf.append((c == null) ? "null" : c.getName());
            }
        }
        return buf.append(")").toString();
    }

    public InputStream getResourceAsStream(String name) {
        return ClassLoader.getSystemResourceAsStream(resolveName(name));
    }

    public URL getResource(String name) {
        return ClassLoader.getSystemResource(resolveName(name));
    }

    private String resolveName(String name) {
        if (!name.startsWith("/")) {
            String baseName = getPackageName();
            if (!baseName.isEmpty()) {
                name = baseName.replace('.', '/') + "/" + name;
            }
        } else {
            name = name.substring(1);
        }
        return name;
    }

    public java.security.ProtectionDomain getProtectionDomain() {
        return null;
    }

    public boolean desiredAssertionStatus() {
        return false;
    }

    public boolean isEnum() {
        return (getModifiers() & ENUM) != 0 && getSuperclass() == java.lang.Enum.class;
    }

    public boolean isRecord() {
        return false;
    }

    public boolean isHidden() {
        return false;
    }

    public boolean isSealed() {
        return false;
    }

    public Class<?>[] getPermittedSubclasses() {
        return null;
    }

    public T[] getEnumConstants() {
        T[] values = getEnumConstantsShared();
        return (values != null) ? values.clone() : null;
    }

    private transient volatile T[] enumConstants;

    @SuppressWarnings("unchecked")
    T[] getEnumConstantsShared() {
        T[] constants = enumConstants;
        if (constants == null) {
            if (!isEnum()) {
                return null;
            }
            try {
                Method values = getDeclaredMethod("values");
                values.setAccessible(true);
                constants = (T[]) values.invoke(null);
                enumConstants = constants;
            } catch (InvocationTargetException | NoSuchMethodException | IllegalAccessException | NullPointerException | ClassCastException ex) {
                return null;
            }
        }
        return constants;
    }

    private transient volatile Map<String, T> enumConstantDirectory;

    Map<String, T> enumConstantDirectory() {
        Map<String, T> directory = enumConstantDirectory;
        if (directory == null) {
            T[] universe = getEnumConstantsShared();
            if (universe == null) {
                throw new IllegalArgumentException(getName() + " is not an enum class");
            }
            directory = new HashMap<>((int) (universe.length / 0.75f) + 1);
            for (T constant : universe) {
                directory.put(((Enum<?>) constant).name(), constant);
            }
            enumConstantDirectory = directory;
        }
        return directory;
    }

    @SuppressWarnings("unchecked")
    public T cast(Object obj) {
        if (obj != null && !isInstance(obj)) {
            throw new ClassCastException("Cannot cast " + obj.getClass().getName() + " to " + getName());
        }
        return (T) obj;
    }

    @SuppressWarnings("unchecked")
    public <U> Class<? extends U> asSubclass(Class<U> clazz) {
        if (clazz.isAssignableFrom(this)) {
            return (Class<? extends U>) this;
        }
        throw new ClassCastException(this.toString());
    }

    public <A extends Annotation> A getAnnotation(Class<A> annotationClass) {
        return null;
    }

    public boolean isAnnotationPresent(Class<? extends Annotation> annotationClass) {
        return getAnnotation(annotationClass) != null;
    }

    public <A extends Annotation> A[] getAnnotationsByType(Class<A> annotationClass) {
        @SuppressWarnings("unchecked")
        A[] result = (A[]) java.lang.reflect.Array.newInstance(annotationClass, 0);
        return result;
    }

    public Annotation[] getAnnotations() {
        return new Annotation[0];
    }

    public <A extends Annotation> A getDeclaredAnnotation(Class<A> annotationClass) {
        return null;
    }

    public <A extends Annotation> A[] getDeclaredAnnotationsByType(Class<A> annotationClass) {
        return getAnnotationsByType(annotationClass);
    }

    public Annotation[] getDeclaredAnnotations() {
        return new Annotation[0];
    }

    public native Class<?> getNestHost();

    public boolean isNestmateOf(Class<?> c) {
        return getNestHost() == c.getNestHost();
    }

    public Class<?>[] getNestMembers() {
        return new Class<?>[] {this};
    }

    public String descriptorString() {
        if (isPrimitive()) {
            switch (getName()) {
                case "boolean": return "Z";
                case "byte": return "B";
                case "char": return "C";
                case "short": return "S";
                case "int": return "I";
                case "long": return "J";
                case "float": return "F";
                case "double": return "D";
                default: return "V";
            }
        }
        if (isArray()) {
            return "[" + getComponentType().descriptorString();
        }
        return "L" + getName().replace('.', '/') + ";";
    }

    static native Class<?> getPrimitiveClass(String name);
}
