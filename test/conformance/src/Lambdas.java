import java.util.*;
import java.util.function.*;
import java.util.stream.*;

public class Lambdas {
    int field = 10;

    int addField(int x) {
        return x + field;
    }

    static int twice(int x) {
        return x * 2;
    }

    static class Person {
        final String name;
        final int age;
        final String city;

        Person(String name, int age, String city) {
            this.name = name;
            this.age = age;
            this.city = city;
        }

        String getName() {
            return name;
        }

        int getAge() {
            return age;
        }

        String getCity() {
            return city;
        }

        public String toString() {
            return name + "(" + age + ")";
        }
    }

    public static void main(String[] args) {
        int captured = 5;
        Function<Integer, Integer> add = x -> x + captured;
        Function<Integer, Integer> times = x -> x * 3;
        System.out.println(add.apply(1) + " " + add.andThen(times).apply(1) + " " + add.compose(times).apply(1) + " " + Function.<Integer>identity().apply(9));
        BiFunction<Integer, Integer, Integer> sum = Integer::sum;
        BinaryOperator<Integer> max = BinaryOperator.maxBy(Comparator.naturalOrder());
        Supplier<List<String>> supplier = ArrayList::new;
        List<String> made = supplier.get();
        made.add("m");
        UnaryOperator<String> upper = String::toUpperCase;
        Predicate<String> empty = String::isEmpty;
        System.out.println(sum.apply(3, 4) + " " + max.apply(3, 9) + " " + made + " " + upper.apply("up") + " " + empty.negate().test("") + " " + empty.or(s -> s.length() > 3).test("long"));
        Lambdas self = new Lambdas();
        IntUnaryOperator bound = self::addField;
        IntUnaryOperator stat = Lambdas::twice;
        IntBinaryOperator mul = (a, b) -> a * b;
        ToIntFunction<String> len = String::length;
        IntFunction<String[]> arrays = String[]::new;
        System.out.println(bound.applyAsInt(1) + " " + stat.applyAsInt(21) + " " + mul.applyAsInt(6, 7) + " " + len.applyAsInt("four") + " " + arrays.apply(3).length);
        Runnable r = () -> System.out.println("ran " + captured);
        r.run();
        Consumer<String> printer = System.out::println;
        printer.andThen(s -> System.out.println(s.length())).accept("consumed");
        Function<String, Integer> parse = Integer::parseInt;
        Supplier<Person> ctor = () -> new Person("Zed", 99, "Nowhere");
        System.out.println(parse.apply("123") + 1 + " " + ctor.get());
        List<Person> people = Arrays.asList(
            new Person("Alice", 31, "Paris"),
            new Person("Bob", 25, "London"),
            new Person("Carol", 35, "Paris"),
            new Person("Dave", 25, "Berlin"),
            new Person("Eve", 28, "London"));
        List<Person> sorted = new ArrayList<>(people);
        sorted.sort(Comparator.comparing(Person::getAge).thenComparing(Person::getName, Comparator.reverseOrder()));
        System.out.println(sorted);
        sorted.sort(Comparator.comparingInt(Person::getAge).reversed());
        System.out.println(sorted);
        System.out.println(people.stream().filter(p -> p.age > 26).map(Person::getName).collect(Collectors.toList()));
        System.out.println(people.stream().mapToInt(Person::getAge).sum() + " " + people.stream().mapToInt(Person::getAge).max().getAsInt() + " " + people.stream().mapToInt(Person::getAge).average().getAsDouble());
        System.out.println(people.stream().map(Person::getName).collect(Collectors.joining(", ", "[", "]")));
        Map<String, List<String>> byCity = people.stream().collect(Collectors.groupingBy(Person::getCity, TreeMap::new, Collectors.mapping(Person::getName, Collectors.toList())));
        System.out.println(byCity);
        Map<String, Long> counts = people.stream().collect(Collectors.groupingBy(Person::getCity, TreeMap::new, Collectors.counting()));
        System.out.println(counts);
        System.out.println(IntStream.rangeClosed(1, 10).filter(i -> i % 2 == 1).boxed().collect(Collectors.toList()) + " " + IntStream.range(0, 5).map(i -> i * i).sum() + " " + Stream.of("b", "a", "c", "a").distinct().sorted().collect(Collectors.joining()));
        System.out.println(Stream.iterate(1, x -> x * 2).limit(10).reduce(0, Integer::sum) + " " + Stream.of(1, 2, 3, 4).reduce(Integer::max).get() + " " + Arrays.stream(new int[] {3, 1, 2}).sorted().boxed().map(String::valueOf).collect(Collectors.joining("-")));
        System.out.println(people.stream().anyMatch(p -> p.age > 34) + " " + people.stream().allMatch(p -> p.age > 20) + " " + people.stream().noneMatch(p -> p.city.equals("Rome")) + " " + people.stream().filter(p -> p.age < 20).findFirst().isPresent());
        Map<Boolean, List<Integer>> parts = IntStream.range(0, 8).boxed().collect(Collectors.partitioningBy(i -> i % 3 == 0));
        System.out.println(parts);
        System.out.println(Stream.of("x", "yy", "zzz").collect(Collectors.toMap(s -> s, String::length, (a, b) -> a, () -> new LinkedHashMap<String, Integer>())));
        List<List<Integer>> nested = Arrays.asList(Arrays.asList(1, 2), Arrays.asList(3), Collections.emptyList());
        System.out.println(nested.stream().flatMap(List::stream).map(i -> i * 10).collect(Collectors.toList()) + " " + Stream.of("a", "b").peek(s -> {}).count());
        Optional<Person> oldest = people.stream().max(Comparator.comparingInt(Person::getAge));
        System.out.println(oldest.map(Person::getName).orElse("?") + " " + Optional.ofNullable(null).map(Object::toString).orElseGet(() -> "empty"));
        DoubleSummaryStatistics stats = DoubleStream.of(1.5, 2.5, 3.5).summaryStatistics();
        System.out.println(stats.getMin() + " " + stats.getMax() + " " + stats.getSum() + " " + stats.getCount());
        int[] counter = {0};
        Runnable inc = () -> counter[0]++;
        for (int i = 0; i < 5; i++) inc.run();
        System.out.println(counter[0]);
        Comparator<String> cmp = (a, b) -> b.compareTo(a);
        List<String> letters = new ArrayList<>(Arrays.asList("q", "w", "e"));
        letters.sort(cmp);
        letters.forEach(s -> System.out.print(s));
        System.out.println();
        Map<String, Integer> m = new TreeMap<>();
        m.put("a", 1);
        m.put("b", 2);
        m.replaceAll((k, v) -> v * 100);
        m.forEach((k, v) -> System.out.print(k + "=" + v + ";"));
        m.computeIfPresent("a", (k, v) -> v + 1);
        m.compute("c", (k, v) -> v == null ? 7 : v);
        System.out.println(" " + m);
        BooleanSupplier bs = () -> true;
        LongSupplier ls = () -> Long.MAX_VALUE;
        DoubleUnaryOperator half = d -> d / 2;
        ToLongFunction<String> hash = s -> s.hashCode() * 31L;
        System.out.println(bs.getAsBoolean() + " " + ls.getAsLong() + " " + half.applyAsDouble(5) + " " + hash.applyAsLong("hi"));
    }
}
