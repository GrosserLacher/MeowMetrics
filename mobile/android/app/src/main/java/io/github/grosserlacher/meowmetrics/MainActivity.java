package io.github.grosserlacher.meowmetrics;

import android.content.pm.ApplicationInfo;
import android.graphics.Bitmap;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Bundle;
import android.webkit.SslErrorHandler;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.widget.Toast;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

/**
 * Die Start-Seite der App (lokal, https://localhost) öffnet den vom Benutzer eingegebenen Server direkt im WebView.
 *
 * Capacitor würde dafür allowNavigation brauchen und lädt dann jede HTML-Seite des Servers über einen eigenen
 * Java-Proxy (HttpURLConnection). Das ist fehleranfällig. Stattdessen entscheidet hier eine einfache Regel:
 *  - https-Links von der Start-Seite aus und innerhalb desselben Servers bleiben im WebView,
 *  - alles andere (andere Hosts, tel:, mailto:, Karten-Links) übergibt die App an Android (Standard von Capacitor).
 *
 * Fehlerdiagnose: Ladefehler des Servers werden kurz als Hinweis eingeblendet (Test-APK zusätzlich Start und Ende des Ladens).
 */
public class MainActivity extends BridgeActivity {

    private boolean debuggable() {
        return (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }

    private void note(String msg) {
        Toast.makeText(this, msg, Toast.LENGTH_LONG).show();
    }

    private boolean isRemote(String url) {
        if (url == null) {
            return false;
        }
        String host = Uri.parse(url).getHost();
        return host != null && !host.equalsIgnoreCase(getBridge().getHost());
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getBridge().setWebViewClient(new BridgeWebViewClient(getBridge()) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri target = request.getUrl();
                if ("https".equalsIgnoreCase(target.getScheme()) && target.getHost() != null) {
                    String currentUrl = view.getUrl();
                    String currentHost = currentUrl == null ? null : Uri.parse(currentUrl).getHost();
                    boolean fromLauncher = getBridge().getHost().equalsIgnoreCase(currentHost);
                    boolean sameServer = currentHost != null && currentHost.equalsIgnoreCase(target.getHost());
                    if (fromLauncher || sameServer) {
                        return false;   // im WebView laden
                    }
                }
                return super.shouldOverrideUrlLoading(view, request);
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                if (debuggable() && isRemote(url)) {
                    note("Lädt: " + Uri.parse(url).getHost());
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (debuggable() && isRemote(url)) {
                    note("Seite geladen");
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    note("Ladefehler " + error.getErrorCode() + ": " + error.getDescription());
                }
                super.onReceivedError(view, request, error);
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
                if (request.isForMainFrame()) {
                    note("Server antwortet mit HTTP " + errorResponse.getStatusCode());
                }
                super.onReceivedHttpError(view, request, errorResponse);
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                note("Zertifikatsfehler " + error.getPrimaryError() + " bei " + error.getUrl());
                super.onReceivedSslError(view, handler, error);
            }
        });
    }
}
