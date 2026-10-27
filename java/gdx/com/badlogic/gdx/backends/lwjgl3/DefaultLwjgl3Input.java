package com.badlogic.gdx.backends.lwjgl3;

import com.badlogic.gdx.AbstractInput;
import com.badlogic.gdx.InputEventQueue;
import com.badlogic.gdx.InputProcessor;
import com.badlogic.gdx.input.NativeInputConfiguration;

public class DefaultLwjgl3Input extends AbstractInput implements Lwjgl3Input {
    final Lwjgl3Window window;
    private InputProcessor inputProcessor;
    final InputEventQueue eventQueue = new InputEventQueue();
    int mouseX;
    int mouseY;
    int mousePressed;
    int deltaX;
    int deltaY;
    boolean justTouched;
    final boolean[] justPressedButtons = new boolean[5];
    private int buttons;
    char lastCharacter;

    public DefaultLwjgl3Input(Lwjgl3Window window) {
        this.window = window;
    }

    void handle(int type, int a, int b, int c) {
        long time = System.nanoTime();
        switch (type) {
            case WebHost.KEY_DOWN:
                if (a >= 0 && a < pressedKeys.length) {
                    if (!pressedKeys[a]) {
                        pressedKeyCount++;
                    }
                    pressedKeys[a] = true;
                    justPressedKeys[a] = true;
                    keyJustPressed = true;
                }
                eventQueue.keyDown(a, time);
                break;
            case WebHost.KEY_UP:
                if (a >= 0 && a < pressedKeys.length) {
                    if (pressedKeys[a]) {
                        pressedKeyCount--;
                    }
                    pressedKeys[a] = false;
                }
                eventQueue.keyUp(a, time);
                break;
            case WebHost.KEY_TYPED:
                lastCharacter = (char) a;
                eventQueue.keyTyped((char) a, time);
                break;
            case WebHost.TOUCH_DOWN:
                moveTo(a, b);
                mousePressed++;
                buttons |= 1 << c;
                justTouched = true;
                if (c >= 0 && c < justPressedButtons.length) {
                    justPressedButtons[c] = true;
                }
                eventQueue.touchDown(a, b, 0, c, time);
                break;
            case WebHost.TOUCH_UP:
                moveTo(a, b);
                mousePressed = Math.max(0, mousePressed - 1);
                buttons &= ~(1 << c);
                eventQueue.touchUp(a, b, 0, c, time);
                break;
            case WebHost.MOUSE_MOVED:
                moveTo(a, b);
                if (mousePressed > 0) {
                    eventQueue.touchDragged(a, b, 0, time);
                } else {
                    eventQueue.mouseMoved(a, b, time);
                }
                break;
            case WebHost.SCROLLED:
                eventQueue.scrolled(Float.intBitsToFloat(a), Float.intBitsToFloat(b), time);
                break;
            default:
                break;
        }
    }

    private void moveTo(int x, int y) {
        deltaX += x - mouseX;
        deltaY += y - mouseY;
        mouseX = x;
        mouseY = y;
    }

    @Override
    public void resetPollingStates() {
        justTouched = false;
        keyJustPressed = false;
        for (int i = 0; i < justPressedKeys.length; i++) {
            justPressedKeys[i] = false;
        }
        for (int i = 0; i < justPressedButtons.length; i++) {
            justPressedButtons[i] = false;
        }
        eventQueue.drain(null);
    }

    @Override
    public void windowHandleChanged(long windowHandle) {
        resetPollingStates();
    }

    @Override
    public void update() {
        eventQueue.drain(inputProcessor);
    }

    @Override
    public void prepareNext() {
        if (justTouched) {
            justTouched = false;
            for (int i = 0; i < justPressedButtons.length; i++) {
                justPressedButtons[i] = false;
            }
        }
        if (keyJustPressed) {
            keyJustPressed = false;
            for (int i = 0; i < justPressedKeys.length; i++) {
                justPressedKeys[i] = false;
            }
        }
        deltaX = 0;
        deltaY = 0;
    }

    @Override
    public int getMaxPointers() {
        return 1;
    }

    @Override
    public int getX() {
        return mouseX;
    }

    @Override
    public int getX(int pointer) {
        return pointer == 0 ? getX() : 0;
    }

    @Override
    public int getDeltaX() {
        return deltaX;
    }

    @Override
    public int getDeltaX(int pointer) {
        return pointer == 0 ? deltaX : 0;
    }

    @Override
    public int getY() {
        return mouseY;
    }

    @Override
    public int getY(int pointer) {
        return pointer == 0 ? getY() : 0;
    }

    @Override
    public int getDeltaY() {
        return deltaY;
    }

    @Override
    public int getDeltaY(int pointer) {
        return pointer == 0 ? deltaY : 0;
    }

    @Override
    public boolean isTouched() {
        return buttons != 0;
    }

    @Override
    public boolean justTouched() {
        return justTouched;
    }

    @Override
    public boolean isTouched(int pointer) {
        return pointer == 0 && isTouched();
    }

    @Override
    public float getPressure() {
        return getPressure(0);
    }

    @Override
    public float getPressure(int pointer) {
        return isTouched(pointer) ? 1 : 0;
    }

    @Override
    public boolean isButtonPressed(int button) {
        return (buttons & (1 << button)) != 0;
    }

    @Override
    public boolean isButtonJustPressed(int button) {
        if (button < 0 || button >= justPressedButtons.length) {
            return false;
        }
        return justPressedButtons[button];
    }

    @Override
    public void getTextInput(TextInputListener listener, String title, String text, String hint) {
        getTextInput(listener, title, text, hint, OnscreenKeyboardType.Default);
    }

    @Override
    public void getTextInput(TextInputListener listener, String title, String text, String hint, OnscreenKeyboardType type) {
        listener.canceled();
    }

    @Override
    public long getCurrentEventTime() {
        return eventQueue.getCurrentEventTime();
    }

    @Override
    public void setInputProcessor(InputProcessor processor) {
        this.inputProcessor = processor;
    }

    @Override
    public InputProcessor getInputProcessor() {
        return inputProcessor;
    }

    @Override
    public void setCursorCatched(boolean catched) {
    }

    @Override
    public boolean isCursorCatched() {
        return false;
    }

    @Override
    public void setCursorPosition(int x, int y) {
    }

    @Override
    public void setOnscreenKeyboardVisible(boolean visible) {
    }

    @Override
    public void setOnscreenKeyboardVisible(boolean visible, OnscreenKeyboardType type) {
    }

    @Override
    public void openTextInputField(NativeInputConfiguration configuration) {
    }

    @Override
    public void closeTextInputField(boolean sendReturn) {
    }

    @Override
    public void setKeyboardHeightObserver(KeyboardHeightObserver observer) {
    }

    @Override
    public float getAccelerometerX() {
        return 0;
    }

    @Override
    public float getAccelerometerY() {
        return 0;
    }

    @Override
    public float getAccelerometerZ() {
        return 0;
    }

    @Override
    public float getGyroscopeX() {
        return 0;
    }

    @Override
    public float getGyroscopeY() {
        return 0;
    }

    @Override
    public float getGyroscopeZ() {
        return 0;
    }

    @Override
    public void vibrate(int milliseconds) {
    }

    @Override
    public void vibrate(int milliseconds, boolean fallback) {
    }

    @Override
    public void vibrate(int milliseconds, int amplitude, boolean fallback) {
    }

    @Override
    public void vibrate(VibrationType vibrationType) {
    }

    @Override
    public float getAzimuth() {
        return 0;
    }

    @Override
    public float getPitch() {
        return 0;
    }

    @Override
    public float getRoll() {
        return 0;
    }

    @Override
    public void getRotationMatrix(float[] matrix) {
    }

    @Override
    public boolean isPeripheralAvailable(Peripheral peripheral) {
        return peripheral == Peripheral.HardwareKeyboard;
    }

    @Override
    public int getRotation() {
        return 0;
    }

    @Override
    public Orientation getNativeOrientation() {
        return Orientation.Landscape;
    }

    @Override
    public void dispose() {
    }
}
