package io.github.grosserlacher.meowmetrics;

import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.SslErrorHandler;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

/**
 * Die Start-Seite der App (lokal, https://localhost) öffnet den vom Benutzer eingegebenen Server direkt im WebView.
 *
<<<<<<< HEAD
 * Capacitor würde dafür allowNavigation brauchen und lädt dann jede HTML-Seite des Servers über einen eigenen
 * Java-Proxy (HttpURLConnection). Das ist fehleranfällig. Stattdessen entscheidet hier eine einfache Regel:
 *  - https-Links von der Start-Seite aus, innerhalb desselben Servers und zurück zur Start-Seite der App
 *    ("Server wechseln") bleiben im WebView,
 *  - alles andere (andere Hosts, tel:, mailto:, Karten-Links) übergibt die App an Android (Standard von Capacitor).
=======
 * Navigation: Capacitor würde dafür allowNavigation brauchen und lädt dann jede HTML-Seite des Servers über einen
 * eigenen Java-Proxy. Das ist fehleranfällig. Stattdessen gilt hier eine einfache Regel:
 *  - https-Links von der Start-Seite aus, innerhalb desselben Servers und zurück zur Start-Seite ("Server wechseln")
 *    bleiben im WebView,
 *  - alles andere (andere Hosts, tel:, mailto:, Karten-Links) übergibt die App an Android.
>>>>>>> main
 *
 * Darstellung: Die App zeichnet randlos unter Status- und Navigationsleiste (beide transparent). Die Höhe der Leisten
 * wird der Seite als CSS-Variablen --sat und --sab übergeben, die Symbolfarbe stellt die Seite über MMNative.setBars ein.
 * Bei geöffneter Tastatur wird der WebView von unten verkleinert.
 */
public class MainActivity extends BridgeActivity {

    private int insetTop = 0;
    private int insetBottom = 0;
    private boolean insetsReported = false;

    private boolean debuggable() {
        return (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }

    /** Wird von der Seite aufgerufen: dunkles Design -> helle Symbole in den Leisten, helles Design -> dunkle Symbole. */
    public class NativeBridge {
        @JavascriptInterface
        public void setBars(final boolean dark) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Window w = getWindow();
                    WindowInsetsControllerCompat c = WindowCompat.getInsetsController(w, w.getDecorView());
                    c.setAppearanceLightStatusBars(!dark);
                    c.setAppearanceLightNavigationBars(!dark);
                }
            });
        }
    }

    private void note(String msg) {
        Toast.makeText(this, msg, Toast.LENGTH_LONG).show();
    }

    private void pushInsets() {
        WebView web = getBridge() == null ? null : getBridge().getWebView();
        if (web == null) {
            return;
        }
        float density = getResources().getDisplayMetrics().density;
        String js = "document.documentElement.style.setProperty('--sat','" + Math.round(insetTop / density) + "px');"
            + "document.documentElement.style.setProperty('--sab','" + Math.round(insetBottom / density) + "px');";
        web.evaluateJavascript(js, null);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Randlos unter den Systemleisten, beide transparent
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 29) {
            window.setNavigationBarContrastEnforced(false);
        }
        // Abstände: Der Listener hängt (wie bei Capacitor selbst) am WebView. Die Höhe der Leisten geht als CSS-Variablen
        // an die Seite, die Tastatur verkleinert den WebView von unten.
        final WebView web = getBridge().getWebView();
        ViewCompat.setOnApplyWindowInsetsListener(web, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            ViewGroup.MarginLayoutParams lp = (ViewGroup.MarginLayoutParams) v.getLayoutParams();
            if (lp.bottomMargin != ime.bottom) {
                lp.bottomMargin = ime.bottom;
                v.setLayoutParams(lp);
            }
            insetTop = bars.top;
            insetBottom = ime.bottom > 0 ? 0 : bars.bottom;   // über der Tastatur gibt es keinen Navigationsbereich
            pushInsets();
            if (!insetsReported) {
                insetsReported = true;
                if (debuggable()) {
                    note("Leisten: oben " + insetTop + " px, unten " + insetBottom + " px");   // nur Test-APK
                }
            }
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(web);
        getBridge().getWebView().addJavascriptInterface(new NativeBridge(), "MMNative");

        // Zurück-Taste: erst im WebView zurück (die PWA legt für Dialoge, Detailseiten und Untermenüs Verlaufseinträge an),
        // am Start verlässt die App den Vordergrund wie jede andere Android-App.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView web = getBridge() == null ? null : getBridge().getWebView();
                if (web != null && web.canGoBack()) {
                    web.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });

        getBridge().setWebViewClient(new BridgeWebViewClient(getBridge()) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri target = request.getUrl();
                if ("https".equalsIgnoreCase(target.getScheme()) && target.getHost() != null) {
                    String currentUrl = view.getUrl();
                    String currentHost = currentUrl == null ? null : Uri.parse(currentUrl).getHost();
                    boolean fromLauncher = getBridge().getHost().equalsIgnoreCase(currentHost);
                    boolean sameServer = currentHost != null && currentHost.equalsIgnoreCase(target.getHost());
                    boolean toLauncher = getBridge().getHost().equalsIgnoreCase(target.getHost());
                    if (fromLauncher || sameServer || toLauncher) {
                        return false;   // im WebView laden
                    }
                }
                return super.shouldOverrideUrlLoading(view, request);
            }

            @Override
            public void onPageCommitVisible(WebView view, String url) {
                super.onPageCommitVisible(view, url);
                pushInsets();
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                pushInsets();
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
