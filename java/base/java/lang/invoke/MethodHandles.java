package java.lang.invoke;

/**
 * Only variable handles are supported: method handles are not.
 */
public class MethodHandles {
    private MethodHandles() {
    }

    public static Lookup lookup() {
        return new Lookup(Object.class);
    }

    public static Lookup publicLookup() {
        return new Lookup(Object.class);
    }

    public static Lookup privateLookupIn(Class<?> targetClass, Lookup caller) {
        return new Lookup(targetClass);
    }

    public static VarHandle arrayElementVarHandle(Class<?> arrayClass) throws IllegalArgumentException {
        if (!arrayClass.isArray()) {
            throw new IllegalArgumentException("not an array class: " + arrayClass.getName());
        }
        return new VarHandle.ArrayHandle(arrayClass);
    }

    public static final class Lookup {
        public static final int PUBLIC = 0x00000001;
        public static final int PRIVATE = 0x00000002;
        public static final int PROTECTED = 0x00000004;
        public static final int PACKAGE = 0x00000008;
        public static final int MODULE = 0x00000010;
        public static final int UNCONDITIONAL = 0x00000020;
        public static final int ORIGINAL = 0x00000040;

        private final Class<?> lookupClass;

        Lookup(Class<?> lookupClass) {
            this.lookupClass = lookupClass;
        }

        public Class<?> lookupClass() {
            return lookupClass;
        }

        public Class<?> previousLookupClass() {
            return null;
        }

        public int lookupModes() {
            return PUBLIC | PRIVATE | PROTECTED | PACKAGE | MODULE;
        }

        public Lookup in(Class<?> requestedLookupClass) {
            return new Lookup(requestedLookupClass);
        }

        public Lookup dropLookupMode(int modeToDrop) {
            return this;
        }

        public boolean hasFullPrivilegeAccess() {
            return true;
        }

        public VarHandle findVarHandle(Class<?> recv, String name, Class<?> type) throws NoSuchFieldException, IllegalAccessException {
            java.lang.reflect.Field field = findField(recv, name);
            if (java.lang.reflect.Modifier.isStatic(field.getModifiers()) || field.getType() != type) {
                throw new NoSuchFieldException(name);
            }
            return new VarHandle.FieldHandle(recv, name, type, false);
        }

        public VarHandle findStaticVarHandle(Class<?> decl, String name, Class<?> type) throws NoSuchFieldException, IllegalAccessException {
            java.lang.reflect.Field field = findField(decl, name);
            if (!java.lang.reflect.Modifier.isStatic(field.getModifiers()) || field.getType() != type) {
                throw new NoSuchFieldException(name);
            }
            return new VarHandle.FieldHandle(decl, name, type, true);
        }

        public VarHandle unreflectVarHandle(java.lang.reflect.Field f) throws IllegalAccessException {
            return new VarHandle.FieldHandle(f.getDeclaringClass(), f.getName(), f.getType(), java.lang.reflect.Modifier.isStatic(f.getModifiers()));
        }

        public Class<?> findClass(String targetName) throws ClassNotFoundException, IllegalAccessException {
            return Class.forName(targetName, false, null);
        }

        public Class<?> ensureInitialized(Class<?> targetClass) throws IllegalAccessException {
            try {
                Class.forName(targetName(targetClass), true, null);
            } catch (ClassNotFoundException e) {
                throw new IllegalAccessException(e.getMessage());
            }
            return targetClass;
        }

        private static String targetName(Class<?> c) {
            return c.getName();
        }

        private static java.lang.reflect.Field findField(Class<?> c, String name) throws NoSuchFieldException {
            for (Class<?> k = c; k != null; k = k.getSuperclass()) {
                for (java.lang.reflect.Field f : k.getDeclaredFields()) {
                    if (f.getName().equals(name)) {
                        return f;
                    }
                }
            }
            throw new NoSuchFieldException(name);
        }

        public String toString() {
            return lookupClass.getName();
        }
    }
}
