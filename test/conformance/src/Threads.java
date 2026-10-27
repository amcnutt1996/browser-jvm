import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.locks.ReentrantLock;

public class Threads {
    static int counter;
    static final Object lock = new Object();

    static synchronized void syncIncrement() {
        synchronized (lock) {
            counter++;
        }
    }

    public static void main(String[] args) throws Exception {
        List<Thread> threads = new ArrayList<>();
        for (int t = 0; t < 4; t++) {
            Thread thread = new Thread(() -> {
                for (int i = 0; i < 10000; i++) {
                    synchronized (lock) {
                        counter++;
                    }
                    syncIncrement();
                }
            }, "worker-" + t);
            threads.add(thread);
            thread.start();
        }
        for (Thread thread : threads) thread.join();
        System.out.println("counter " + counter + " alive " + threads.get(0).isAlive() + " " + threads.get(2).getName());

        LinkedList<Integer> queue = new LinkedList<>();
        int[] consumed = {0, 0};
        Thread consumer = new Thread(() -> {
            try {
                while (true) {
                    int value;
                    synchronized (queue) {
                        while (queue.isEmpty()) queue.wait();
                        value = queue.removeFirst();
                    }
                    if (value < 0) break;
                    consumed[0]++;
                    consumed[1] += value;
                }
            } catch (InterruptedException e) {
                System.out.println("unexpected interrupt");
            }
        });
        consumer.start();
        for (int i = 1; i <= 100; i++) {
            synchronized (queue) {
                queue.addLast(i);
                queue.notifyAll();
            }
            if (i % 10 == 0) Thread.yield();
        }
        synchronized (queue) {
            queue.addLast(-1);
            queue.notifyAll();
        }
        consumer.join();
        System.out.println("consumed " + consumed[0] + " sum " + consumed[1]);

        List<String> order = new CopyOnWriteArrayList<>();
        Thread slow = new Thread(() -> {
            try {
                Thread.sleep(60);
            } catch (InterruptedException e) {
                return;
            }
            order.add("slow");
        });
        Thread fast = new Thread(() -> {
            try {
                Thread.sleep(10);
            } catch (InterruptedException e) {
                return;
            }
            order.add("fast");
        });
        slow.start();
        fast.start();
        slow.join();
        fast.join();
        System.out.println(order);

        Thread sleeper = new Thread(() -> {
            try {
                Thread.sleep(100000);
                System.out.println("woke normally");
            } catch (InterruptedException e) {
                System.out.println("interrupted " + Thread.currentThread().isInterrupted());
            }
        });
        sleeper.start();
        Thread.sleep(20);
        sleeper.interrupt();
        sleeper.join();

        ThreadLocal<String> local = ThreadLocal.withInitial(() -> "initial");
        local.set("main-value");
        String[] seen = new String[1];
        Thread other = new Thread(() -> seen[0] = local.get());
        other.start();
        other.join();
        System.out.println(local.get() + " " + seen[0]);

        ExecutorService pool = Executors.newFixedThreadPool(3);
        List<Future<Integer>> futures = new ArrayList<>();
        for (int i = 1; i <= 5; i++) {
            final int n = i;
            futures.add(pool.submit(() -> {
                Thread.sleep(5 * (6 - n));
                return n * n;
            }));
        }
        int total = 0;
        for (Future<Integer> f : futures) total += f.get();
        pool.shutdown();
        System.out.println("futures " + total + " " + pool.awaitTermination(1, TimeUnit.SECONDS) + " " + pool.isShutdown());

        AtomicInteger atomic = new AtomicInteger();
        AtomicLong along = new AtomicLong(10);
        Thread[] incs = new Thread[3];
        for (int i = 0; i < incs.length; i++) {
            incs[i] = new Thread(() -> {
                for (int j = 0; j < 1000; j++) {
                    atomic.incrementAndGet();
                    along.addAndGet(2);
                }
            });
            incs[i].start();
        }
        for (Thread t : incs) t.join();
        System.out.println("atomic " + atomic.get() + " " + along.get() + " " + atomic.compareAndSet(3000, 1) + " " + atomic.getAndAdd(5) + " " + atomic.get());

        ReentrantLock rlock = new ReentrantLock();
        int[] guarded = {0};
        Thread[] lockers = new Thread[2];
        for (int i = 0; i < lockers.length; i++) {
            lockers[i] = new Thread(() -> {
                for (int j = 0; j < 500; j++) {
                    rlock.lock();
                    try {
                        guarded[0]++;
                    } finally {
                        rlock.unlock();
                    }
                }
            });
            lockers[i].start();
        }
        for (Thread t : lockers) t.join();
        System.out.println("locked " + guarded[0]);

        CountDownLatch latch = new CountDownLatch(2);
        ConcurrentHashMap<String, Integer> chm = new ConcurrentHashMap<>();
        for (int i = 0; i < 2; i++) {
            final int id = i;
            new Thread(() -> {
                chm.merge("hits", 1, Integer::sum);
                chm.put("t" + id, id);
                latch.countDown();
            }).start();
        }
        latch.await();
        System.out.println("latch " + chm.get("hits") + " " + chm.size());

        BlockingQueue<String> bq = new LinkedBlockingQueue<>();
        Thread producer = new Thread(() -> {
            for (int i = 0; i < 3; i++) bq.add("item" + i);
        });
        producer.start();
        StringBuilder got = new StringBuilder();
        for (int i = 0; i < 3; i++) got.append(bq.take()).append(' ');
        System.out.println(got.toString().trim() + " " + bq.poll(10, TimeUnit.MILLISECONDS));

        Thread failing = new Thread(() -> {
            throw new IllegalStateException("thread failure");
        });
        failing.setUncaughtExceptionHandler((t, e) -> System.out.println("handler got " + e.getMessage()));
        failing.start();
        failing.join();

        Thread daemon = new Thread(() -> {
            while (true) {
                try {
                    Thread.sleep(1000);
                } catch (InterruptedException e) {
                    return;
                }
            }
        });
        daemon.setDaemon(true);
        daemon.start();
        System.out.println("main " + Thread.currentThread().getName() + " daemon " + daemon.isDaemon() + " state " + failing.getState());

        CompletableFuture<String> cf = CompletableFuture.supplyAsync(() -> "async").thenApply(s -> s + "!");
        System.out.println(cf.get());
    }
}
