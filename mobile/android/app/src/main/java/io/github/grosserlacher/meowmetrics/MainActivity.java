package io.github.grosserlacher.meowmetrics;

import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
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
 * Die Oberfläche steckt in der APK (https://localhost) und startet ohne Server. Daten und Abgleich laufen über den
 * Server, dessen Adresse der Benutzer in der App eingibt. Links auf fremde Adressen, tel: und mailto: öffnet Android
 * in der jeweiligen App (Standardverhalten von Capacitor).
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
                    Toast.makeText(this, "Leisten: oben " + insetTop + " px, unten " + insetBottom + " px", Toast.LENGTH_LONG).show();
                }
            }
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(web);
        web.addJavascriptInterface(new NativeBridge(), "MMNative");

        // Zurück-Taste: erst im WebView zurück (die Oberfläche legt für Dialoge, Detailseiten und Untermenüs Verlaufseinträge
        // an), am Start verlässt die App den Vordergrund wie jede andere Android-App.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView w = getBridge() == null ? null : getBridge().getWebView();
                if (w != null && w.canGoBack()) {
                    w.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });

        getBridge().setWebViewClient(new BridgeWebViewClient(getBridge()) {
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
        });
    }
}
