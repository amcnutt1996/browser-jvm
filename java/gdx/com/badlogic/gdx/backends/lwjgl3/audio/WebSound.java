package com.badlogic.gdx.backends.lwjgl3.audio;

import com.badlogic.gdx.audio.Sound;

public class WebSound implements Sound {
    final int id;
    private boolean disposed;

    WebSound(int id) {
        this.id = id;
    }

    @Override
    public long play() {
        return play(1);
    }

    @Override
    public long play(float volume) {
        return play(volume, 1, 0);
    }

    @Override
    public long play(float volume, float pitch, float pan) {
        return disposed ? -1 : WebAudio.play(id, volume, pitch, pan, false);
    }

    @Override
    public long loop() {
        return loop(1);
    }

    @Override
    public long loop(float volume) {
        return loop(volume, 1, 0);
    }

    @Override
    public long loop(float volume, float pitch, float pan) {
        return disposed ? -1 : WebAudio.play(id, volume, pitch, pan, true);
    }

    @Override
    public void stop() {
        WebAudio.stop(id, -1);
    }

    @Override
    public void pause() {
        WebAudio.pause(id, -1);
    }

    @Override
    public void resume() {
        WebAudio.resume(id, -1);
    }

    @Override
    public void dispose() {
        if (!disposed) {
            disposed = true;
            WebAudio.unload(id);
        }
    }

    @Override
    public void stop(long soundId) {
        WebAudio.stop(id, soundId);
    }

    @Override
    public void pause(long soundId) {
        WebAudio.pause(id, soundId);
    }

    @Override
    public void resume(long soundId) {
        WebAudio.resume(id, soundId);
    }

    @Override
    public void setLooping(long soundId, boolean looping) {
        WebAudio.setLooping(id, soundId, looping);
    }

    @Override
    public void setPitch(long soundId, float pitch) {
        WebAudio.setPitch(id, soundId, pitch);
    }

    @Override
    public void setVolume(long soundId, float volume) {
        WebAudio.setVolume(id, soundId, volume);
    }

    @Override
    public void setPan(long soundId, float pan, float volume) {
        WebAudio.setPan(id, soundId, pan);
        WebAudio.setVolume(id, soundId, volume);
    }
}
