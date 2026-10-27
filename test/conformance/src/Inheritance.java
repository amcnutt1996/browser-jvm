import java.util.ArrayList;
import java.util.List;

public class Inheritance {
    static StringBuilder log = new StringBuilder();

    interface Shape {
        double area();

        default String describe() {
            return name() + " with area " + Math.round(area() * 100) / 100.0;
        }

        String name();

        static Shape unit() {
            return new Square(1);
        }
    }

    interface Named {
        default String name() {
            return "named";
        }
    }

    static abstract class Base implements Shape {
        static {
            log.append("Base.clinit ");
        }

        protected final String label;

        Base(String label) {
            this.label = label;
            log.append("Base(" + label + ") ");
            init();
        }

        void init() {
            log.append("Base.init ");
        }

        public String name() {
            return label;
        }

        public String toString() {
            return getClass().getSimpleName() + "[" + label + "]";
        }
    }

    static class Square extends Base {
        static {
            log.append("Square.clinit ");
        }

        final double side;
        int initCalls;

        Square(double side) {
            super("square");
            this.side = side;
            log.append("Square() ");
        }

        void init() {
            initCalls++;
            log.append("Square.init(side=" + side + ") ");
        }

        public double area() {
            return side * side;
        }
    }

    static class Circle extends Base implements Named {
        final double r;

        Circle(double r) {
            super("circle");
            this.r = r;
        }

        public double area() {
            return Math.PI * r * r;
        }

        public String name() {
            return "round " + super.name() + " " + Named.super.name();
        }
    }

    static class Parent {
        String field = "parent-field";
        static String staticName() {
            return "Parent.static";
        }

        String who() {
            return "Parent";
        }

        String callWho() {
            return who() + "/" + field;
        }
    }

    static class Child extends Parent {
        String field = "child-field";

        static String staticName() {
            return "Child.static";
        }

        String who() {
            return "Child";
        }

        String superWho() {
            return super.who() + " " + super.field + " " + ((Parent) this).field;
        }
    }

    static String overload(Object o) {
        return "Object";
    }

    static String overload(String s) {
        return "String";
    }

    static String overload(Integer i) {
        return "Integer";
    }

    static String overload(long l) {
        return "long";
    }

    enum Op {
        ADD("+") {
            int apply(int a, int b) {
                return a + b;
            }
        },
        MUL("*") {
            int apply(int a, int b) {
                return a * b;
            }
        };

        final String symbol;

        Op(String symbol) {
            this.symbol = symbol;
        }

        abstract int apply(int a, int b);
    }

    enum Planet { MERCURY, VENUS, EARTH }

    class Inner {
        int value() {
            return outerValue * 2;
        }
    }

    int outerValue = 21;

    private int secret() {
        return 7;
    }

    static class Nest {
        int peek(Inheritance outer) {
            return outer.secret();
        }
    }

    interface Counter {
        int next();
    }

    public static void main(String[] args) {
        Shape sq = new Square(3);
        System.out.println(log.toString().trim());
        log.setLength(0);
        Shape c = new Circle(1);
        System.out.println(log.toString().trim());
        System.out.println(sq.describe() + " | " + c.describe() + " | " + Shape.unit().area());
        System.out.println(sq + " " + c + " " + ((Square) sq).initCalls + " " + (sq instanceof Base) + " " + (c instanceof Named) + " " + (sq instanceof Named));
        Parent p = new Child();
        System.out.println(p.who() + " " + p.field + " " + ((Child) p).field + " " + p.callWho() + " " + ((Child) p).superWho() + " " + Parent.staticName() + " " + Child.staticName());
        Object o = "str";
        System.out.println(overload(o) + " " + overload("s") + " " + overload(5) + " " + overload(Integer.valueOf(5)) + " " + overload((Object) null));
        for (Op op : Op.values()) System.out.print(op + op.symbol + op.apply(6, 7) + " " + op.ordinal() + " " + op.getClass().getSuperclass().getSimpleName() + " " + op.getDeclaringClass().getSimpleName() + "; ");
        System.out.println();
        System.out.println(Op.valueOf("MUL").apply(3, 3) + " " + Planet.valueOf("EARTH").compareTo(Planet.MERCURY) + " " + Planet.VENUS.name() + " " + java.util.Arrays.toString(Planet.values()));
        try {
            Planet.valueOf("PLUTO");
        } catch (IllegalArgumentException e) {
            System.out.println(e.getMessage());
        }
        for (Planet planet : Planet.values()) {
            switch (planet) {
                case EARTH:
                    System.out.print("home ");
                    break;
                default:
                    System.out.print(planet.name().toLowerCase() + " ");
            }
        }
        System.out.println();
        Inheritance outer = new Inheritance();
        Inheritance.Inner inner = outer.new Inner();
        System.out.println(inner.value() + " " + new Nest().peek(outer));
        int[] state = {0};
        Counter counter = new Counter() {
            int base = 100;

            public int next() {
                return base + ++state[0];
            }
        };
        System.out.println(counter.next() + " " + counter.next() + " " + counter.getClass().getSuperclass().getSimpleName() + " " + (counter.getClass().getSimpleName().isEmpty()));
        class Local implements Comparable<Local> {
            final int v;

            Local(int v) {
                this.v = v;
            }

            public int compareTo(Local other) {
                return Integer.compare(v, other.v);
            }

            public String toString() {
                return "L" + v;
            }
        }
        List<Local> locals = new ArrayList<>();
        locals.add(new Local(3));
        locals.add(new Local(1));
        locals.add(new Local(2));
        java.util.Collections.sort(locals);
        System.out.println(locals);
        Object[] things = {1, "two", 3.0, 'c', null, new int[0], new String[0][0], Op.ADD};
        for (Object thing : things) {
            System.out.print((thing == null ? "null" : thing.getClass().getName()) + " ");
        }
        System.out.println();
        System.out.println(int.class.getName() + " " + String[].class.getName() + " " + int[][].class.getSimpleName() + " " + Inner.class.getName() + " " + Inner.class.getSimpleName() + " " + Integer.TYPE + " " + Shape.class.isInterface() + " " + Op.class.isEnum() + " " + Op.ADD.getClass().isEnum());
        Object obj = new Object();
        System.out.println(obj.equals(obj) + " " + (obj.hashCode() == System.identityHashCode(obj)) + " " + new Object().equals(obj) + " " + "x".equals(new StringBuilder("x").toString()));
    }
}
