package com.badlogic.gdx.backends.lwjgl3;

import com.badlogic.gdx.graphics.Cursor;
import com.badlogic.gdx.graphics.Pixmap;

public class Lwjgl3Cursor implements Cursor {
    final int[] pixels;
    final int width;
    final int height;
    final int xHotspot;
    final int yHotspot;

    Lwjgl3Cursor(Pixmap pixmap, int xHotspot, int yHotspot) {
        width = pixmap.getWidth();
        height = pixmap.getHeight();
        pixels = new int[width * height];
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                pixels[y * width + x] = pixmap.getPixel(x, y);
            }
        }
        this.xHotspot = xHotspot;
        this.yHotspot = yHotspot;
    }

    void apply() {
        WebHost.setCustomCursor(pixels, width, height, xHotspot, yHotspot);
    }

    @Override
    public void dispose() {
    }
}
