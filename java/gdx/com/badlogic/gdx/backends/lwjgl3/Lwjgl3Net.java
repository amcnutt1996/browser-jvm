package com.badlogic.gdx.backends.lwjgl3;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Net;
import com.badlogic.gdx.net.ServerSocket;
import com.badlogic.gdx.net.ServerSocketHints;
import com.badlogic.gdx.net.Socket;
import com.badlogic.gdx.net.SocketHints;
import com.badlogic.gdx.utils.GdxRuntimeException;
import java.io.IOException;

public class Lwjgl3Net implements Net {
    public Lwjgl3Net(Lwjgl3ApplicationConfiguration configuration) {
    }

    @Override
    public void sendHttpRequest(HttpRequest httpRequest, HttpResponseListener httpResponseListener) {
        if (httpResponseListener == null) {
            return;
        }
        Gdx.app.postRunnable(() -> httpResponseListener.failed(
            new IOException("Network requests are not available: " + httpRequest.getUrl())));
    }

    @Override
    public void cancelHttpRequest(HttpRequest httpRequest) {
    }

    @Override
    public boolean isHttpRequestPending(HttpRequest httpRequest) {
        return false;
    }

    @Override
    public ServerSocket newServerSocket(Protocol protocol, String hostname, int port, ServerSocketHints hints) {
        throw new GdxRuntimeException("Sockets are not available");
    }

    @Override
    public ServerSocket newServerSocket(Protocol protocol, int port, ServerSocketHints hints) {
        throw new GdxRuntimeException("Sockets are not available");
    }

    @Override
    public Socket newClientSocket(Protocol protocol, String host, int port, SocketHints hints) {
        throw new GdxRuntimeException("Sockets are not available");
    }

    @Override
    public boolean openURI(String URI) {
        return WebHost.openURI(URI);
    }
}
