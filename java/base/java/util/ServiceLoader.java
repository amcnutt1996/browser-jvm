package java.util;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.function.Consumer;
import java.util.function.Supplier;
import java.util.stream.Stream;

/**
 * Service providers come from META-INF/services files on the class path.
 * Modules do not exist in this runtime, so there is no module-based lookup.
 */
public final class ServiceLoader<S> implements Iterable<S> {
    private final Class<S> service;
    private List<S> providers;

    public interface Provider<S> extends Supplier<S> {
        Class<? extends S> type();

        @Override
        S get();
    }

    private ServiceLoader(Class<S> service) {
        this.service = Objects.requireNonNull(service);
    }

    public static <S> ServiceLoader<S> load(Class<S> service, ClassLoader loader) {
        return new ServiceLoader<>(service);
    }

    public static <S> ServiceLoader<S> load(Class<S> service) {
        return new ServiceLoader<>(service);
    }

    public static <S> ServiceLoader<S> loadInstalled(Class<S> service) {
        return new ServiceLoader<>(service);
    }

    public static <S> ServiceLoader<S> load(ModuleLayer layer, Class<S> service) {
        return new ServiceLoader<>(service);
    }

    private List<S> providers() {
        if (providers == null) {
            List<S> list = new ArrayList<>();
            InputStream in = ClassLoader.getSystemResourceAsStream("META-INF/services/" + service.getName());
            if (in != null) {
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        int comment = line.indexOf('#');
                        if (comment >= 0) {
                            line = line.substring(0, comment);
                        }
                        line = line.trim();
                        if (!line.isEmpty()) {
                            list.add(service.cast(Class.forName(line).getConstructor().newInstance()));
                        }
                    }
                } catch (IOException | ReflectiveOperationException e) {
                    throw new ServiceConfigurationError(service.getName() + ": " + e, e);
                }
            }
            providers = list;
        }
        return providers;
    }

    public Iterator<S> iterator() {
        return providers().iterator();
    }

    public Stream<Provider<S>> stream() {
        List<Provider<S>> list = new ArrayList<>();
        for (S s : providers()) {
            list.add(new Provider<S>() {
                @SuppressWarnings("unchecked")
                public Class<? extends S> type() {
                    return (Class<? extends S>) s.getClass();
                }

                public S get() {
                    return s;
                }
            });
        }
        return list.stream();
    }

    public Optional<S> findFirst() {
        List<S> list = providers();
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    public void reload() {
        providers = null;
    }

    public String toString() {
        return "java.util.ServiceLoader[" + service.getName() + "]";
    }
}
