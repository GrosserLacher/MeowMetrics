package io.github.grosserlacher.meowmetrics;

import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

/**
 * Die Start-Seite der App (lokal, https://localhost) öffnet den vom Benutzer eingegebenen Server direkt im WebView.
 *
 * Capacitor würde dafür allowNavigation brauchen und lädt dann jede HTML-Seite des Servers über einen eigenen
 * Java-Proxy (HttpURLConnection). Das ist fehleranfällig. Stattdessen entscheidet hier eine einfache Regel:
 *  - https-Links von der Start-Seite aus und innerhalb desselben Servers bleiben im WebView,
 *  - alles andere (andere Hosts, tel:, mailto:, Karten-Links) übergibt die App an Android (Standard von Capacitor).
 */
public class MainActivity extends BridgeActivity {

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
        });
    }
}
