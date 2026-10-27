package com.badlogic.gdx.backends.lwjgl3.audio;

import com.badlogic.gdx.audio.Music;

public class WebMusic implements Music {
    final WebAudio audio;
    final int id;
    private boolean playing;
    private boolean looping;
    private float volume = 1;
    private float pan;
    private boolean started;
    private boolean disposed;
    private OnCompletionListener onCompletionListener;

    WebMusic(WebAudio audio, int id) {
        this.audio = audio;
        this.id = id;
    }

    @Override
    public void play() {
        if (disposed || playing) {
            return;
        }
        if (started) {
            WebAudio.resume(id, 0);
        } else {
            WebAudio.play(id, volume, 1, pan, looping);
            started = true;
        }
        playing = true;
    }

    @Override
    public void pause() {
        if (playing) {
            WebAudio.pause(id, 0);
            playing = false;
        }
    }

    @Override
    public void stop() {
        WebAudio.stop(id, 0);
        playing = false;
        started = false;
    }

    @Override
    public boolean isPlaying() {
        return playing;
    }

    @Override
    public void setLooping(boolean isLooping) {
        looping = isLooping;
        WebAudio.setLooping(id, 0, isLooping);
    }

    @Override
    public boolean isLooping() {
        return looping;
    }

    @Override
    public void setVolume(float volume) {
        this.volume = volume;
        WebAudio.setVolume(id, 0, volume);
    }

    @Override
    public float getVolume() {
        return volume;
    }

    @Override
    public void setPan(float pan, float volume) {
        this.pan = pan;
        this.volume = volume;
        WebAudio.setPan(id, 0, pan);
        WebAudio.setVolume(id, 0, volume);
    }

    @Override
    public void setPosition(float position) {
        WebAudio.setPosition(id, position);
    }

    @Override
    public float getPosition() {
        return WebAudio.getPosition(id);
    }

    @Override
    public void dispose() {
        if (!disposed) {
            disposed = true;
            playing = false;
            WebAudio.unload(id);
            audio.music.remove(id);
        }
    }

    @Override
    public void setOnCompletionListener(OnCompletionListener listener) {
        onCompletionListener = listener;
    }

    void completed() {
        if (looping) {
            return;
        }
        playing = false;
        started = false;
        if (onCompletionListener != null) {
            onCompletionListener.onCompletion(this);
        }
    }
}
