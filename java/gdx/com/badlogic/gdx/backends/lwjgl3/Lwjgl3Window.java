package com.badlogic.gdx.backends.lwjgl3;

import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.LifecycleListener;
import com.badlogic.gdx.graphics.Pixmap;
import com.badlogic.gdx.utils.Array;
import com.badlogic.gdx.utils.Disposable;

public class Lwjgl3Window implements Disposable {
    private ApplicationListener listener;
    private final Array<LifecycleListener> lifecycleListeners;
    final Lwjgl3ApplicationBase application;
    private boolean listenerInitialized = false;
    Lwjgl3WindowListener windowListener;
    private Lwjgl3Graphics graphics;
    private Lwjgl3Input input;
    private final Lwjgl3ApplicationConfiguration config;
    private final Array<Runnable> runnables = new Array<>();
    private final Array<Runnable> executedRunnables = new Array<>();
    private boolean iconified = false;
    private boolean focused = true;
    private boolean requestRendering = false;
    private boolean shouldClose = false;
    private int lastWidth;
    private int lastHeight;

    Lwjgl3Window(ApplicationListener listener, Array<LifecycleListener> lifecycleListeners, Lwjgl3ApplicationConfiguration config,
        Lwjgl3ApplicationBase application) {
        this.listener = listener;
        this.lifecycleListeners = lifecycleListeners;
        this.windowListener = config.windowListener;
        this.config = config;
        this.application = application;
    }

    void create() {
        if (config.title != null) {
            WebHost.setTitle(config.title);
        }
        if (config.fullscreenMode != null) {
            WebHost.setFullscreen(true);
        } else if (!config.windowMaximized && config.windowWidth > 0 && config.windowHeight > 0) {
            WebHost.setWindowSize(config.windowWidth, config.windowHeight);
        }
        this.graphics = new Lwjgl3Graphics(this);
        this.input = application.createInput(this);
        lastWidth = graphics.getWidth();
        lastHeight = graphics.getHeight();
        if (windowListener != null) {
            windowListener.created(this);
        }
    }

    public ApplicationListener getListener() {
        return listener;
    }

    public Lwjgl3WindowListener getWindowListener() {
        return windowListener;
    }

    public void setWindowListener(Lwjgl3WindowListener listener) {
        this.windowListener = listener;
    }

    public void postRunnable(Runnable runnable) {
        synchronized (runnables) {
            runnables.add(runnable);
        }
    }

    public void setPosition(int x, int y) {
    }

    public int getPositionX() {
        return 0;
    }

    public int getPositionY() {
        return 0;
    }

    public void setVisible(boolean visible) {
    }

    public void closeWindow() {
        shouldClose = true;
    }

    public void iconifyWindow() {
    }

    public boolean isIconified() {
        return iconified;
    }

    public void restoreWindow() {
    }

    public void maximizeWindow() {
    }

    public void focusWindow() {
    }

    public boolean isFocused() {
        return focused;
    }

    public void setIcon(Pixmap... image) {
    }

    public void setTitle(CharSequence title) {
        WebHost.setTitle(title == null ? "" : title.toString());
    }

    public void setSizeLimits(int minWidth, int minHeight, int maxWidth, int maxHeight) {
    }

    Lwjgl3Graphics getGraphics() {
        return graphics;
    }

    Lwjgl3Input getInput() {
        return input;
    }

    public long getWindowHandle() {
        return 1;
    }

    void windowHandleChanged(long windowHandle) {
    }

    void handleEvent(int type, int value) {
        if (type == WebHost.FOCUS) {
            boolean gained = value != 0;
            if (gained == focused) {
                return;
            }
            focused = gained;
            if (windowListener != null) {
                if (gained) {
                    windowListener.focusGained();
                } else {
                    windowListener.focusLost();
                }
            }
            if (config.pauseWhenLostFocus) {
                synchronized (lifecycleListeners) {
                    if (gained) {
                        for (LifecycleListener lifecycleListener : lifecycleListeners) {
                            lifecycleListener.resume();
                        }
                        listener.resume();
                    } else {
                        for (LifecycleListener lifecycleListener : lifecycleListeners) {
                            lifecycleListener.pause();
                        }
                        listener.pause();
                    }
                }
            }
        } else if (type == WebHost.CLOSE) {
            if (windowListener == null || windowListener.closeRequested()) {
                shouldClose = true;
            }
        }
    }

    boolean update() {
        if (!listenerInitialized) {
            initializeListener();
        }
        synchronized (runnables) {
            executedRunnables.addAll(runnables);
            runnables.clear();
        }
        for (Runnable runnable : executedRunnables) {
            runnable.run();
        }
        boolean shouldRender = executedRunnables.size > 0 || graphics.isContinuousRendering();
        executedRunnables.clear();

        if (!iconified) {
            input.update();
        }

        synchronized (this) {
            shouldRender |= requestRendering && !iconified;
            requestRendering = false;
        }

        graphics.updateFramebufferInfo();
        int width = graphics.getWidth();
        int height = graphics.getHeight();
        if (width != lastWidth || height != lastHeight) {
            lastWidth = width;
            lastHeight = height;
            Gdx.gl.glViewport(0, 0, graphics.getBackBufferWidth(), graphics.getBackBufferHeight());
            listener.resize(width, height);
            shouldRender = true;
        }

        if (shouldRender) {
            graphics.update();
            listener.render();
        }

        if (!iconified) {
            input.prepareNext();
        }

        return shouldRender;
    }

    void requestRendering() {
        synchronized (this) {
            this.requestRendering = true;
        }
    }

    boolean shouldClose() {
        return shouldClose;
    }

    Lwjgl3ApplicationConfiguration getConfig() {
        return config;
    }

    boolean isListenerInitialized() {
        return listenerInitialized;
    }

    void initializeListener() {
        if (!listenerInitialized) {
            listener.create();
            listener.resize(graphics.getWidth(), graphics.getHeight());
            listenerInitialized = true;
        }
    }

    void makeCurrent() {
        Gdx.graphics = graphics;
        Gdx.gl32 = graphics.getGL32();
        Gdx.gl31 = Gdx.gl32 != null ? Gdx.gl32 : graphics.getGL31();
        Gdx.gl30 = Gdx.gl31 != null ? Gdx.gl31 : graphics.getGL30();
        Gdx.gl20 = Gdx.gl30 != null ? Gdx.gl30 : graphics.getGL20();
        Gdx.gl = Gdx.gl20;
        Gdx.input = input;
    }

    @Override
    public void dispose() {
        listener.pause();
        listener.dispose();
        graphics.dispose();
        input.dispose();
    }

    @Override
    public int hashCode() {
        return 31;
    }

    @Override
    public boolean equals(Object obj) {
        return this == obj;
    }

    public void flash() {
    }
}
