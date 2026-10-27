package com.badlogic.gdx.backends.lwjgl3;

final class WebHost {
    static final int KEY_DOWN = 0;
    static final int KEY_UP = 1;
    static final int KEY_TYPED = 2;
    static final int TOUCH_DOWN = 3;
    static final int TOUCH_UP = 4;
    static final int MOUSE_MOVED = 5;
    static final int SCROLLED = 6;
    static final int FOCUS = 7;
    static final int CLOSE = 8;
    static final int EVENT_SIZE = 5;

    private WebHost() {
    }

    static native boolean waitForFrame();

    static native int[] pollEvents();

    static native int getWidth();

    static native int getHeight();

    static native int getBackBufferWidth();

    static native int getBackBufferHeight();

    static native float getDensity();

    static native int getScreenWidth();

    static native int getScreenHeight();

    static native void setTitle(String title);

    static native void setWindowSize(int width, int height);

    static native void setFullscreen(boolean fullscreen);

    static native boolean isFullscreen();

    static native void setSystemCursor(int cursor);

    static native void setCustomCursor(int[] pixels, int width, int height, int xHotspot, int yHotspot);

    static native boolean openURI(String uri);

    static native String getClipboard();

    static native void setClipboard(String contents);
}
