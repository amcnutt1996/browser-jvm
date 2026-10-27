package com.badlogic.gdx.backends.lwjgl3.audio;

import com.badlogic.gdx.audio.AudioDevice;
import com.badlogic.gdx.audio.AudioRecorder;
import com.badlogic.gdx.audio.Music;
import com.badlogic.gdx.audio.Sound;
import com.badlogic.gdx.backends.lwjgl3.audio.mock.MockAudioDevice;
import com.badlogic.gdx.backends.lwjgl3.audio.mock.MockAudioRecorder;
import com.badlogic.gdx.files.FileHandle;
import com.badlogic.gdx.utils.Array;
import com.badlogic.gdx.utils.IntMap;

public class WebAudio implements Lwjgl3Audio {
    final IntMap<WebMusic> music = new IntMap<>();
    private final Array<WebSound> sounds = new Array<>();

    static native int load(byte[] data, String name, boolean stream);

    static native void unload(int id);

    static native long play(int id, float volume, float pitch, float pan, boolean loop);

    static native void stop(int id, long instance);

    static native void pause(int id, long instance);

    static native void resume(int id, long instance);

    static native void setLooping(int id, long instance, boolean loop);

    static native void setPitch(int id, long instance, float pitch);

    static native void setVolume(int id, long instance, float volume);

    static native void setPan(int id, long instance, float pan);

    static native void setPosition(int id, float seconds);

    static native float getPosition(int id);

    static native int[] pollCompleted();

    @Override
    public AudioDevice newAudioDevice(int samplingRate, boolean isMono) {
        return new MockAudioDevice();
    }

    @Override
    public AudioRecorder newAudioRecorder(int samplingRate, boolean isMono) {
        return new MockAudioRecorder();
    }

    @Override
    public Sound newSound(FileHandle file) {
        WebSound sound = new WebSound(load(file.readBytes(), file.name(), false));
        sounds.add(sound);
        return sound;
    }

    @Override
    public Music newMusic(FileHandle file) {
        WebMusic track = new WebMusic(this, load(file.readBytes(), file.name(), true));
        music.put(track.id, track);
        return track;
    }

    @Override
    public boolean switchOutputDevice(String deviceIdentifier) {
        return false;
    }

    @Override
    public String[] getAvailableOutputDevices() {
        return new String[0];
    }

    @Override
    public void update() {
        int[] completed = pollCompleted();
        if (completed == null) {
            return;
        }
        for (int id : completed) {
            WebMusic track = music.get(id);
            if (track != null) {
                track.completed();
            }
        }
    }

    @Override
    public void dispose() {
        for (WebSound sound : sounds) {
            sound.dispose();
        }
        sounds.clear();
        for (WebMusic track : music.values().toArray()) {
            track.dispose();
        }
        music.clear();
    }
}
