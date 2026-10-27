package com.badlogic.gdx.backends.lwjgl3;

import com.badlogic.gdx.utils.Clipboard;

public class Lwjgl3Clipboard implements Clipboard {
    @Override
    public boolean hasContents() {
        String contents = getContents();
        return contents != null && !contents.isEmpty();
    }

    @Override
    public String getContents() {
        return WebHost.getClipboard();
    }

    @Override
    public void setContents(String content) {
        WebHost.setClipboard(content);
    }
}
