package com.badlogic.gdx.backends.lwjgl3;

import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.ApplicationLogger;
import com.badlogic.gdx.Audio;
import com.badlogic.gdx.Files;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Graphics;
import com.badlogic.gdx.Input;
import com.badlogic.gdx.LifecycleListener;
import com.badlogic.gdx.Net;
import com.badlogic.gdx.Preferences;
import com.badlogic.gdx.backends.lwjgl3.audio.Lwjgl3Audio;
import com.badlogic.gdx.backends.lwjgl3.audio.WebAudio;
import com.badlogic.gdx.backends.lwjgl3.audio.mock.MockAudio;
import com.badlogic.gdx.utils.Array;
import com.badlogic.gdx.utils.Clipboard;
import com.badlogic.gdx.utils.GdxRuntimeException;
import com.badlogic.gdx.utils.ObjectMap;

public class Lwjgl3Application implements Lwjgl3ApplicationBase {
    private final Lwjgl3ApplicationConfiguration config;
    final Array<Lwjgl3Window> windows = new Array<>();
    private volatile Lwjgl3Window currentWindow;
    private Lwjgl3Audio audio;
    private final Files files;
    private final Net net;
    private final ObjectMap<String, Preferences> preferences = new ObjectMap<>();
    private final Lwjgl3Clipboard clipboard;
    private int logLevel = LOG_INFO;
    private ApplicationLogger applicationLogger;
    private volatile boolean running = true;
    private final Array<Runnable> runnables = new Array<>();
    private final Array<Runnable> executedRunnables = new Array<>();
    private final Array<LifecycleListener> lifecycleListeners = new Array<>();

    public Lwjgl3Application(ApplicationListener listener) {
        this(listener, new Lwjgl3ApplicationConfiguration());
    }

    public Lwjgl3Application(ApplicationListener listener, Lwjgl3ApplicationConfiguration config) {
        if (config.title == null) {
            config.title = listener.getClass().getSimpleName();
        }
        this.config = config = Lwjgl3ApplicationConfiguration.copy(config);
        setApplicationLogger(new Lwjgl3ApplicationLogger());
        Gdx.app = this;
        this.audio = createAudio(config);
        Gdx.audio = audio;
        this.files = Gdx.files = createFiles();
        this.net = Gdx.net = new Lwjgl3Net(config);
        this.clipboard = new Lwjgl3Clipboard();

        Lwjgl3Window window = new Lwjgl3Window(listener, lifecycleListeners, config, this);
        window.create();
        windows.add(window);
        currentWindow = window;
        window.makeCurrent();

        try {
            loop();
            cleanupWindows();
        } catch (Throwable t) {
            if (t instanceof RuntimeException) {
                throw (RuntimeException) t;
            }
            throw new GdxRuntimeException(t);
        } finally {
            cleanup();
        }
    }

    protected void loop() {
        Lwjgl3Window window = windows.first();
        while (running) {
            audio.update();
            pollEvents(window);
            synchronized (lifecycleListeners) {
                window.update();
            }

            boolean shouldRequestRendering;
            synchronized (runnables) {
                shouldRequestRendering = runnables.size > 0;
                executedRunnables.clear();
                executedRunnables.addAll(runnables);
                runnables.clear();
            }
            for (Runnable runnable : executedRunnables) {
                runnable.run();
            }
            if (shouldRequestRendering && !window.getGraphics().isContinuousRendering()) {
                window.requestRendering();
            }

            if (window.shouldClose()) {
                break;
            }
            WebHost.waitForFrame();
        }
    }

    private void pollEvents(Lwjgl3Window window) {
        int[] events = WebHost.pollEvents();
        if (events == null) {
            return;
        }
        Lwjgl3Input input = window.getInput();
        for (int i = 0; i + WebHost.EVENT_SIZE <= events.length; i += WebHost.EVENT_SIZE) {
            int type = events[i];
            if (type == WebHost.FOCUS || type == WebHost.CLOSE) {
                window.handleEvent(type, events[i + 1]);
            } else if (input instanceof DefaultLwjgl3Input) {
                ((DefaultLwjgl3Input) input).handle(type, events[i + 1], events[i + 2], events[i + 3]);
            }
        }
        if (events.length > 0 && !window.getGraphics().isContinuousRendering()) {
            window.requestRendering();
        }
    }

    protected void cleanupWindows() {
        synchronized (lifecycleListeners) {
            for (LifecycleListener lifecycleListener : lifecycleListeners) {
                lifecycleListener.pause();
                lifecycleListener.dispose();
            }
        }
        for (Lwjgl3Window window : windows) {
            window.dispose();
        }
        windows.clear();
    }

    protected void cleanup() {
        audio.dispose();
    }

    @Override
    public ApplicationListener getApplicationListener() {
        return currentWindow.getListener();
    }

    @Override
    public Graphics getGraphics() {
        return currentWindow.getGraphics();
    }

    @Override
    public Audio getAudio() {
        return audio;
    }

    @Override
    public Input getInput() {
        return currentWindow.getInput();
    }

    @Override
    public Files getFiles() {
        return files;
    }

    @Override
    public Net getNet() {
        return net;
    }

    @Override
    public void debug(String tag, String message) {
        if (logLevel >= LOG_DEBUG) {
            getApplicationLogger().debug(tag, message);
        }
    }

    @Override
    public void debug(String tag, String message, Throwable exception) {
        if (logLevel >= LOG_DEBUG) {
            getApplicationLogger().debug(tag, message, exception);
        }
    }

    @Override
    public void log(String tag, String message) {
        if (logLevel >= LOG_INFO) {
            getApplicationLogger().log(tag, message);
        }
    }

    @Override
    public void log(String tag, String message, Throwable exception) {
        if (logLevel >= LOG_INFO) {
            getApplicationLogger().log(tag, message, exception);
        }
    }

    @Override
    public void error(String tag, String message) {
        if (logLevel >= LOG_ERROR) {
            getApplicationLogger().error(tag, message);
        }
    }

    @Override
    public void error(String tag, String message, Throwable exception) {
        if (logLevel >= LOG_ERROR) {
            getApplicationLogger().error(tag, message, exception);
        }
    }

    @Override
    public void setLogLevel(int logLevel) {
        this.logLevel = logLevel;
    }

    @Override
    public int getLogLevel() {
        return logLevel;
    }

    @Override
    public void setApplicationLogger(ApplicationLogger applicationLogger) {
        this.applicationLogger = applicationLogger;
    }

    @Override
    public ApplicationLogger getApplicationLogger() {
        return applicationLogger;
    }

    @Override
    public ApplicationType getType() {
        return ApplicationType.Desktop;
    }

    @Override
    public int getVersion() {
        return 0;
    }

    @Override
    public long getJavaHeap() {
        return Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory();
    }

    @Override
    public long getNativeHeap() {
        return getJavaHeap();
    }

    @Override
    public Preferences getPreferences(String name) {
        if (preferences.containsKey(name)) {
            return preferences.get(name);
        }
        Preferences prefs = new Lwjgl3Preferences(
            new Lwjgl3FileHandle(new java.io.File(config.preferencesDirectory, name), config.preferencesFileType));
        preferences.put(name, prefs);
        return prefs;
    }

    @Override
    public Clipboard getClipboard() {
        return clipboard;
    }

    @Override
    public void postRunnable(Runnable runnable) {
        synchronized (runnables) {
            runnables.add(runnable);
        }
    }

    @Override
    public void exit() {
        running = false;
    }

    @Override
    public void addLifecycleListener(LifecycleListener listener) {
        synchronized (lifecycleListeners) {
            lifecycleListeners.add(listener);
        }
    }

    @Override
    public void removeLifecycleListener(LifecycleListener listener) {
        synchronized (lifecycleListeners) {
            lifecycleListeners.removeValue(listener, true);
        }
    }

    @Override
    public Lwjgl3Audio createAudio(Lwjgl3ApplicationConfiguration config) {
        if (config.disableAudio) {
            return new MockAudio();
        }
        return new WebAudio();
    }

    @Override
    public Lwjgl3Input createInput(Lwjgl3Window window) {
        return new DefaultLwjgl3Input(window);
    }

    protected Files createFiles() {
        return new Lwjgl3Files();
    }

    public Lwjgl3Window newWindow(ApplicationListener listener, Lwjgl3WindowConfiguration config) {
        throw new GdxRuntimeException("Only one window is supported");
    }

    public enum GLDebugMessageSeverity {
        HIGH, MEDIUM, LOW, NOTIFICATION
    }

    public static boolean setGLDebugMessageControl(GLDebugMessageSeverity severity, boolean enabled) {
        return false;
    }
}
