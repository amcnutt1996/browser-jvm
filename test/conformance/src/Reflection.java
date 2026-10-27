import java.lang.reflect.*;
import java.util.Arrays;
import java.util.List;

public class Reflection {
    public static class Target implements Comparable<Target> {
        public int count = 3;
        private String name = "target";
        public static String shared = "static";
        protected long big = 1L << 40;

        public Target() {
        }

        public Target(String name, int count) {
            this.name = name;
            this.count = count;
        }

        public String greet(String who) {
            return "hi " + who + " from " + name;
        }

        public int add(int a, Integer b) {
            return a + b;
        }

        public static double half(double x) {
            return x / 2;
        }

        private void secret() {
        }

        public void boom() {
            throw new IllegalStateException("boom");
        }

        public int compareTo(Target other) {
            return Integer.compare(count, other.count);
        }
    }

    enum Level { LOW, HIGH }

    public static void main(String[] args) throws Exception {
        Class<?> cls = Class.forName("Reflection$Target");
        System.out.println(cls.getName() + " " + cls.getSimpleName() + " " + Modifier.isPublic(cls.getModifiers()) + " " + Modifier.isStatic(cls.getModifiers()) + " " + cls.getSuperclass().getName() + " " + Arrays.toString(cls.getInterfaces()));
        Object instance = cls.getDeclaredConstructor().newInstance();
        Object other = cls.getConstructor(String.class, int.class).newInstance("other", 9);
        Method greet = cls.getMethod("greet", String.class);
        System.out.println(greet.invoke(instance, "you") + " | " + greet.invoke(other, "me") + " | " + greet.getReturnType().getSimpleName() + " " + greet.getParameterCount());
        Method add = cls.getMethod("add", int.class, Integer.class);
        Method half = cls.getMethod("half", double.class);
        System.out.println(add.invoke(instance, 2, 3) + " " + half.invoke(null, 5.0) + " " + Modifier.isStatic(half.getModifiers()));
        Field count = cls.getField("count");
        Field name = cls.getDeclaredField("name");
        name.setAccessible(true);
        count.setInt(instance, 42);
        name.set(instance, "renamed");
        System.out.println(count.get(instance) + " " + name.get(instance) + " " + greet.invoke(instance, "again") + " " + count.getType() + " " + name.getType().getSimpleName() + " " + Modifier.isPrivate(name.getModifiers()));
        Field shared = cls.getField("shared");
        System.out.println(shared.get(null) + " " + Modifier.isStatic(shared.getModifiers()) + " " + cls.getDeclaredField("big").getLong(instance));
        try {
            cls.getMethod("boom").invoke(instance);
        } catch (InvocationTargetException e) {
            System.out.println("ITE " + e.getCause().getMessage());
        }
        try {
            cls.getMethod("missing");
        } catch (NoSuchMethodException e) {
            System.out.println("NSME " + e.getMessage());
        }
        try {
            Class.forName("does.not.Exist");
        } catch (ClassNotFoundException e) {
            System.out.println("CNFE " + e.getMessage());
        }
        System.out.println(Comparable.class.isAssignableFrom(cls) + " " + cls.isInstance(instance) + " " + Number.class.isAssignableFrom(Integer.class) + " " + int.class.isPrimitive() + " " + Object.class.isAssignableFrom(int[].class) + " " + int.class.isAssignableFrom(Integer.class));
        System.out.println(Arrays.toString(Level.class.getEnumConstants()) + " " + Level.class.getEnumConstants()[1].ordinal() + " " + Enum.valueOf(Level.class, "LOW"));
        Object array = Array.newInstance(int.class, 3);
        Array.setInt(array, 1, 7);
        Array.set(array, 2, 9);
        Object strings = Array.newInstance(String.class, 2);
        Array.set(strings, 0, "x");
        System.out.println(Array.getLength(array) + " " + Array.get(array, 1) + " " + Arrays.toString((int[]) array) + " " + Arrays.toString((String[]) strings) + " " + array.getClass().getName());
        int methods = 0;
        for (Method m : cls.getDeclaredMethods()) if (!m.isSynthetic()) methods++;
        int fields = cls.getDeclaredFields().length;
        System.out.println(methods + " " + fields + " " + cls.getDeclaredConstructors().length + " " + cls.getConstructors().length);
        Object created = cls.newInstance();
        System.out.println(((Target) created).count + " " + created.getClass().getDeclaredMethod("secret").getName() + " " + Integer.class.getMethod("parseInt", String.class).invoke(null, "77"));
        List<String> list = new java.util.ArrayList<>();
        list.getClass().getMethod("add", Object.class).invoke(list, "reflected");
        System.out.println(list + " " + String.class.getMethod("length").invoke("four") + " " + Object.class.getMethod("hashCode").invoke("a"));
    }
}
