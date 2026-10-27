package com.badlogic.gdx.backends.lwjgl3;

import com.badlogic.gdx.AbstractGraphics;
import com.badlogic.gdx.Application;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.graphics.Cursor;
import com.badlogic.gdx.graphics.Cursor.SystemCursor;
import com.badlogic.gdx.graphics.GL20;
import com.badlogic.gdx.graphics.GL30;
import com.badlogic.gdx.graphics.GL31;
import com.badlogic.gdx.graphics.GL32;
import com.badlogic.gdx.graphics.Pixmap;
import com.badlogic.gdx.graphics.glutils.GLVersion;
import com.badlogic.gdx.utils.Disposable;

public class Lwjgl3Graphics extends AbstractGraphics implements Disposable {
    final Lwjgl3Window window;
    GL20 gl20;
    private GL30 gl30;
    private GL31 gl31;
    private GL32 gl32;
    private GLVersion glVersion;
    private volatile int backBufferWidth;
    private volatile int backBufferHeight;
    private volatile int logicalWidth;
    private volatile int logicalHeight;
    private BufferFormat bufferFormat;
    private long lastFrameTime = -1;
    private float deltaTime;
    private boolean resetDeltaTime = false;
    private long frameId;
    private long frameCounterStart = 0;
    private int frames;
    private int fps;
    private boolean continuous = true;
    private String extensions;
    private static final Lwjgl3Monitor MONITOR = new Lwjgl3Monitor(1, 0, 0, "Browser");

    public Lwjgl3Graphics(Lwjgl3Window window) {
        this.window = window;
        this.gl20 = new WebGL20();
        updateFramebufferInfo();
        initiateGL();
    }

    private void initiateGL() {
        String versionString = gl20.glGetString(GL20.GL_VERSION);
        String vendorString = gl20.glGetString(GL20.GL_VENDOR);
        String rendererString = gl20.glGetString(GL20.GL_RENDERER);
        glVersion = new GLVersion(Application.ApplicationType.Desktop, versionString, vendorString, rendererString);
    }

    public boolean supportsCubeMapSeamless() {
        return false;
    }

    public void enableCubeMapSeamless(boolean enable) {
    }

    public Lwjgl3Window getWindow() {
        return window;
    }

    void updateFramebufferInfo() {
        backBufferWidth = WebHost.getBackBufferWidth();
        backBufferHeight = WebHost.getBackBufferHeight();
        logicalWidth = WebHost.getWidth();
        logicalHeight = WebHost.getHeight();
        bufferFormat = new BufferFormat(8, 8, 8, 8, 16, 8, 0, false);
    }

    void update() {
        long time = System.nanoTime();
        if (lastFrameTime == -1) {
            lastFrameTime = time;
        }
        if (resetDeltaTime) {
            resetDeltaTime = false;
            deltaTime = 0;
        } else {
            deltaTime = (time - lastFrameTime) / 1000000000.0f;
        }
        lastFrameTime = time;

        if (time - frameCounterStart >= 1000000000) {
            fps = frames;
            frames = 0;
            frameCounterStart = time;
        }
        frames++;
        frameId++;
    }

    @Override
    public boolean isGL30Available() {
        return gl30 != null;
    }

    @Override
    public boolean isGL31Available() {
        return gl31 != null;
    }

    @Override
    public boolean isGL32Available() {
        return gl32 != null;
    }

    @Override
    public GL20 getGL20() {
        return gl20;
    }

    @Override
    public GL30 getGL30() {
        return gl30;
    }

    @Override
    public GL31 getGL31() {
        return gl31;
    }

    @Override
    public GL32 getGL32() {
        return gl32;
    }

    @Override
    public void setGL20(GL20 gl20) {
        this.gl20 = gl20;
    }

    @Override
    public void setGL30(GL30 gl30) {
        this.gl30 = gl30;
    }

    @Override
    public void setGL31(GL31 gl31) {
        this.gl31 = gl31;
    }

    @Override
    public void setGL32(GL32 gl32) {
        this.gl32 = gl32;
    }

    @Override
    public int getWidth() {
        if (window.getConfig().hdpiMode == com.badlogic.gdx.graphics.glutils.HdpiMode.Pixels) {
            return backBufferWidth;
        }
        return logicalWidth;
    }

    @Override
    public int getHeight() {
        if (window.getConfig().hdpiMode == com.badlogic.gdx.graphics.glutils.HdpiMode.Pixels) {
            return backBufferHeight;
        }
        return logicalHeight;
    }

    @Override
    public int getBackBufferWidth() {
        return backBufferWidth;
    }

    @Override
    public int getBackBufferHeight() {
        return backBufferHeight;
    }

    public int getLogicalWidth() {
        return logicalWidth;
    }

    public int getLogicalHeight() {
        return logicalHeight;
    }

    @Override
    public long getFrameId() {
        return frameId;
    }

    @Override
    public float getDeltaTime() {
        return deltaTime;
    }

    public void resetDeltaTime() {
        resetDeltaTime = true;
    }

    @Override
    public int getFramesPerSecond() {
        return fps;
    }

    @Override
    public GraphicsType getType() {
        return GraphicsType.LWJGL3;
    }

    @Override
    public GLVersion getGLVersion() {
        return glVersion;
    }

    @Override
    public float getPpiX() {
        return getPpcX() * 2.54f;
    }

    @Override
    public float getPpiY() {
        return getPpcY() * 2.54f;
    }

    @Override
    public float getPpcX() {
        return 96 / 2.54f * WebHost.getDensity();
    }

    @Override
    public float getPpcY() {
        return 96 / 2.54f * WebHost.getDensity();
    }

    @Override
    public boolean supportsDisplayModeChange() {
        return true;
    }

    @Override
    public Monitor getPrimaryMonitor() {
        return MONITOR;
    }

    @Override
    public Monitor getMonitor() {
        return MONITOR;
    }

    @Override
    public Monitor[] getMonitors() {
        return new Monitor[] {MONITOR};
    }

    @Override
    public DisplayMode[] getDisplayModes() {
        return getDisplayModes(MONITOR);
    }

    @Override
    public DisplayMode[] getDisplayModes(Monitor monitor) {
        return new DisplayMode[] {getDisplayMode(monitor)};
    }

    @Override
    public DisplayMode getDisplayMode() {
        return getDisplayMode(MONITOR);
    }

    @Override
    public DisplayMode getDisplayMode(Monitor monitor) {
        return new Lwjgl3DisplayMode(1, WebHost.getScreenWidth(), WebHost.getScreenHeight(), 60, 24);
    }

    @Override
    public int getSafeInsetLeft() {
        return 0;
    }

    @Override
    public int getSafeInsetTop() {
        return 0;
    }

    @Override
    public int getSafeInsetBottom() {
        return 0;
    }

    @Override
    public int getSafeInsetRight() {
        return 0;
    }

    @Override
    public boolean setFullscreenMode(DisplayMode displayMode) {
        WebHost.setFullscreen(true);
        return true;
    }

    @Override
    public boolean setWindowedMode(int width, int height) {
        WebHost.setFullscreen(false);
        WebHost.setWindowSize(width, height);
        return true;
    }

    @Override
    public void setTitle(String title) {
        WebHost.setTitle(title == null ? "" : title);
    }

    @Override
    public void setUndecorated(boolean undecorated) {
    }

    @Override
    public void setResizable(boolean resizable) {
    }

    @Override
    public void setVSync(boolean vsync) {
    }

    public void setForegroundFPS(int fps) {
        window.getConfig().foregroundFPS = fps;
    }

    @Override
    public BufferFormat getBufferFormat() {
        return bufferFormat;
    }

    @Override
    public boolean supportsExtension(String extension) {
        if (extensions == null) {
            extensions = gl20.glGetString(GL20.GL_EXTENSIONS);
        }
        return extensions != null && (" " + extensions + " ").contains(" " + extension + " ");
    }

    @Override
    public void setContinuousRendering(boolean isContinuous) {
        this.continuous = isContinuous;
    }

    @Override
    public boolean isContinuousRendering() {
        return continuous;
    }

    @Override
    public void requestRendering() {
        window.requestRendering();
    }

    @Override
    public boolean isFullscreen() {
        return WebHost.isFullscreen();
    }

    @Override
    public Cursor newCursor(Pixmap pixmap, int xHotspot, int yHotspot) {
        return new Lwjgl3Cursor(pixmap, xHotspot, yHotspot);
    }

    @Override
    public void setCursor(Cursor cursor) {
        ((Lwjgl3Cursor) cursor).apply();
    }

    @Override
    public void setSystemCursor(SystemCursor systemCursor) {
        WebHost.setSystemCursor(systemCursor.ordinal());
    }

    @Override
    public void dispose() {
    }

    public static class Lwjgl3DisplayMode extends DisplayMode {
        final long monitorHandle;

        Lwjgl3DisplayMode(long monitor, int width, int height, int refreshRate, int bitsPerPixel) {
            super(width, height, refreshRate, bitsPerPixel);
            this.monitorHandle = monitor;
        }

        public long getMonitor() {
            return monitorHandle;
        }
    }

    public static class Lwjgl3Monitor extends Monitor {
        final long monitorHandle;

        Lwjgl3Monitor(long monitor, int virtualX, int virtualY, String name) {
            super(virtualX, virtualY, name);
            this.monitorHandle = monitor;
        }

        public long getMonitorHandle() {
            return monitorHandle;
        }
    }
}
