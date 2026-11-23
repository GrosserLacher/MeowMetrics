# MeowMetrics – Android-App (Capacitor)

Android-Hülle für MeowMetrics. Die Oberfläche steckt in der APK (`npm run sync` baut sie aus `app/static`), die Daten kommen vom Server.
Einzelheiten, Server-Einstellung (`CORS_ORIGINS`) und Ablauf: `docs/APP.md`.

- Application ID: `io.github.grosserlacher.meowmetrics`
- Keine Google-Dienste, kein Cleartext-Traffic, Kamera optional
- Eigene Zertifizierungsstellen, die auf dem Gerät installiert sind, werden akzeptiert (`network_security_config.xml`)

## Releases bauen (GitHub Actions)

Workflow: `.github/workflows/android.yml`

| Auslöser | Ergebnis |
|---|---|
| Tag `v1.2.3` | signierte APK `meowmetrics-1.2.3.apk` an einem GitHub Release |
| Push auf `main` (Änderungen in `mobile/`), Pull Request oder manuell | Test-APK (debug) als Artefakt des Workflow-Laufs |

`versionName` kommt aus dem Tag. `versionCode = major*1000000 + minor*1000 + patch`.

### Einmalige Einrichtung: Keystore

Der Keystore signiert jede Version. **Geht er verloren, lassen sich installierte Apps nicht mehr aktualisieren.** Offline sichern (z. B. Passwortmanager) und niemals ins Repo legen.

```bash
# erzeugt meowmetrics.keystore (gültig ca. 27 Jahre); ohne installiertes Java über Docker
docker run --rm -it -v "$PWD":/k -w /k eclipse-temurin:21 \
  keytool -genkeypair -v -keystore meowmetrics.keystore -alias meowmetrics \
  -keyalg RSA -keysize 4096 -validity 10000

# Base64 für das GitHub-Secret
base64 -w0 meowmetrics.keystore        # macOS: base64 -i meowmetrics.keystore
```

GitHub → Repository → *Settings → Secrets and variables → Actions → New repository secret*:

| Secret | Inhalt |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Ausgabe von `base64` |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore-Passwort |
| `ANDROID_KEY_ALIAS` | `meowmetrics` |
| `ANDROID_KEY_PASSWORD` | Passwort des Schlüssels (bei `keytool` meist dasselbe) |

### Release auslösen

```bash
git tag v0.1.0
git push origin v0.1.0
```

## Lokal entwickeln (optional)

Benötigt Node 22, JDK 21 und das Android SDK.

```bash
cd mobile
npm ci
npm run sync
cd android && ./gradlew assembleDebug
```

## App-Symbol
Das Symbol wird aus dem Favicon der Oberfläche (`app/static/favicon.svg`, sonst `icon-512.png`) erzeugt:

```bash
cd mobile
npm ci
npm run icons                      # optional: npm run icons -- --src bild.svg --bg "#c8563a"
git add android/app/src/main/res
```
Das Skript schreibt die Symbole für alle Bildschirmdichten (altes, rundes und adaptives Symbol) und die Hintergrundfarbe.

