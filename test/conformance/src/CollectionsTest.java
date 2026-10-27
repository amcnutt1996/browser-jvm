import java.util.*;

public class CollectionsTest {
    enum Color { RED, GREEN, BLUE }

    public static void main(String[] args) {
        List<Integer> list = new ArrayList<>();
        for (int i = 0; i < 10; i++) list.add(i * 7 % 10);
        System.out.println(list + " " + list.size() + " " + list.get(3) + " " + list.indexOf(4) + " " + list.contains(9));
        java.util.Collections.sort(list);
        System.out.println(list);
        list.sort(Comparator.reverseOrder());
        System.out.println(list + " " + java.util.Collections.max(list) + " " + java.util.Collections.min(list));
        list.removeIf(x -> x % 2 == 0);
        list.remove(Integer.valueOf(5));
        list.remove(0);
        System.out.println(list);
        Iterator<Integer> it = list.iterator();
        while (it.hasNext()) if (it.next() == 3) it.remove();
        System.out.println(list);
        try {
            for (Integer v : list) list.add(v);
        } catch (ConcurrentModificationException e) {
            System.out.println("CME");
        }
        LinkedList<String> linked = new LinkedList<>(Arrays.asList("b", "c"));
        linked.addFirst("a");
        linked.addLast("d");
        System.out.println(linked + " " + linked.getFirst() + linked.getLast() + " " + linked.pollFirst() + " " + linked.peekLast() + " " + linked);
        Map<String, Integer> hash = new HashMap<>();
        for (String w : "the quick brown fox jumps over the lazy dog the end".split(" ")) hash.merge(w, 1, Integer::sum);
        System.out.println(hash);
        System.out.println(hash.get("the") + " " + hash.getOrDefault("cat", -1) + " " + hash.containsKey("fox") + " " + hash.keySet().size() + " " + hash.values().stream().mapToInt(Integer::intValue).sum());
        Map<Integer, String> nums = new HashMap<>();
        for (int i = 20; i >= 0; i -= 3) nums.put(i, "v" + i);
        System.out.println(nums);
        TreeMap<String, Integer> tree = new TreeMap<>(hash);
        System.out.println(tree + " " + tree.firstKey() + " " + tree.lastEntry() + " " + tree.headMap("fox") + " " + tree.ceilingKey("g") + " " + tree.descendingMap().firstKey());
        LinkedHashMap<String, Integer> lhm = new LinkedHashMap<>();
        lhm.put("z", 1);
        lhm.put("a", 2);
        lhm.put("m", 3);
        lhm.put("a", 4);
        System.out.println(lhm + " " + lhm.entrySet().iterator().next().getKey());
        Set<String> hs = new HashSet<>(Arrays.asList("pear", "apple", "fig", "banana", "kiwi"));
        System.out.println(hs + " " + new TreeSet<>(hs) + " " + new TreeSet<>(hs).headSet("fig", true));
        Set<Integer> lhs = new LinkedHashSet<>(Arrays.asList(5, 3, 5, 1, 3));
        System.out.println(lhs);
        Deque<Integer> dq = new ArrayDeque<>();
        dq.push(1);
        dq.push(2);
        dq.offerLast(3);
        System.out.println(dq + " " + dq.pop() + " " + dq.pollLast() + " " + dq);
        PriorityQueue<Integer> pq = new PriorityQueue<>(Arrays.asList(5, 1, 8, 3, 9, 2));
        StringBuilder order = new StringBuilder();
        while (!pq.isEmpty()) order.append(pq.poll()).append(' ');
        System.out.println(order.toString().trim());
        PriorityQueue<String> pqs = new PriorityQueue<>(Comparator.comparing(String::length).thenComparing(Comparator.reverseOrder()));
        pqs.addAll(Arrays.asList("ccc", "a", "bb", "b", "aaa"));
        List<String> drained = new ArrayList<>();
        while (!pqs.isEmpty()) drained.add(pqs.poll());
        System.out.println(drained);
        int[] arr = {5, 3, 9, 1, 7};
        Arrays.sort(arr);
        System.out.println(Arrays.toString(arr) + " " + Arrays.binarySearch(arr, 7) + " " + Arrays.binarySearch(arr, 4));
        Integer[] boxed = {5, 3, 9, 1, 7};
        Arrays.sort(boxed, (x, y) -> y - x);
        System.out.println(Arrays.toString(boxed));
        String[] words = {"banana", "Apple", "cherry", "apple"};
        Arrays.sort(words);
        System.out.println(Arrays.toString(words));
        Arrays.sort(words, String.CASE_INSENSITIVE_ORDER);
        System.out.println(Arrays.toString(words));
        List<String> fixed = Arrays.asList("x", "y", "z");
        try {
            fixed.add("w");
        } catch (UnsupportedOperationException e) {
            System.out.println("UOE");
        }
        System.out.println(List.of(1, 2, 3) + " " + Set.of(42) + " " + Map.of("k", 1) + " " + List.copyOf(fixed) + " " + java.util.Collections.unmodifiableList(fixed));
        List<Integer> big = new ArrayList<>();
        Random r = new Random(42);
        for (int i = 0; i < 1000; i++) big.add(r.nextInt(1000));
        java.util.Collections.sort(big);
        System.out.println(big.get(0) + " " + big.get(500) + " " + big.get(999) + " " + r.nextLong() + " " + r.nextDouble() + " " + r.nextBoolean() + " " + r.nextFloat() + " " + r.nextGaussian());
        java.util.Collections.shuffle(big, new Random(7));
        System.out.println(big.subList(0, 5));
        EnumMap<Color, Integer> em = new EnumMap<>(Color.class);
        em.put(Color.BLUE, 3);
        em.put(Color.RED, 1);
        System.out.println(em + " " + EnumSet.of(Color.GREEN, Color.RED) + " " + EnumSet.allOf(Color.class) + " " + EnumSet.complementOf(EnumSet.of(Color.RED)));
        BitSet bits = new BitSet();
        bits.set(1);
        bits.set(5, 8);
        System.out.println(bits + " " + bits.cardinality() + " " + bits.nextClearBit(5));
        Map<String, List<Integer>> multi = new TreeMap<>();
        for (int i = 0; i < 6; i++) multi.computeIfAbsent(i % 2 == 0 ? "even" : "odd", k -> new ArrayList<>()).add(i);
        System.out.println(multi);
        Hashtable<String, Integer> table = new Hashtable<>();
        table.put("one", 1);
        Vector<Integer> vector = new Vector<>(Arrays.asList(1, 2));
        Stack<Integer> stack = new Stack<>();
        stack.push(9);
        System.out.println(table + " " + vector + " " + stack.peek() + " " + new IdentityHashMap<>().size());
        Object[] objs = list.toArray();
        Integer[] typed = list.toArray(new Integer[0]);
        System.out.println(objs.length + " " + typed.getClass().getSimpleName() + " " + Arrays.asList(typed));
        StringJoiner joiner = new StringJoiner(", ", "{", "}");
        joiner.add("one").add("two");
        System.out.println(joiner + " " + Objects.hash(1, 2, 3) + " " + Arrays.hashCode(new int[] {1, 2}) + " " + Objects.equals(null, null) + " " + List.of(1, 2).hashCode() + " " + Map.of("a", 1).hashCode());
        Optional<String> opt = Optional.of("v");
        System.out.println(opt.map(String::toUpperCase).orElse("none") + " " + Optional.empty().isPresent() + " " + opt);
    }
}
