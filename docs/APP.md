# Android-App

Die App enthält die Oberfläche selbst (Ordner `app/static`, gebaut nach `mobile/www`) und startet deshalb ohne Server.
Daten und Abgleich laufen über den Server, dessen Adresse der Benutzer beim ersten Start eingibt.

## Server einrichten
In der `docker-compose.yml` des Servers eintragen und neu starten:

```yaml
    environment:
      - TZ=Europe/Berlin
      - CORS_ORIGINS=https://localhost
```

Ohne diese Einstellung blockiert Android die Anfragen der App (Meldung "Der Server ist nicht erreichbar ... CORS_ORIGINS").
Der Server braucht HTTPS (auch mit eigener Zertifizierungsstelle, die auf dem Handy installiert ist).

## Ablauf
- **Erster Start:** Wahl Server oder lokal (lokal folgt), Server-Adresse, Anmeldung. Die App speichert Adresse und ein Token.
- **Jeder weitere Start:** Die Oberfläche kommt aus der APK, die Daten aus dem Zwischenspeicher (IndexedDB). Der Abgleich läuft unsichtbar
  im Hintergrund. Ohne Netz zeigt die App ihren letzten Stand und nimmt neue Einträge in einer Warteschlange auf, die später gesendet wird.
- **Fotos:** Sie werden mit einem Foto-Schlüssel vom Server geladen (nur lesend, gilt nur für Fotos, verfällt bei Passwortänderung).
- **Dateien** (Bericht als PDF, CSV, Datenbank-Sicherung) öffnen den Android-Teilen-Dialog. Direkt drucken gibt es in der App noch nicht.
- **Server wechseln:** *Mehr → Konto & Benutzer*.

## Bauen
```bash
cd mobile
npm ci
npm run sync          # baut mobile/www aus app/static und kopiert es in das Android-Projekt
```
`mobile/www` wird erzeugt und nicht eingecheckt. Der Workflow `.github/workflows/android.yml` macht dasselbe.

## Tests
`bash tests/frontend/run.sh` startet einen Server, lädt die Oberfläche in jsdom und prüft die Browser-Ansicht und die App (Erststart,
Anmeldung per Token, Start ohne Netz aus dem Zwischenspeicher, Eintrag ohne Netz, Abgleich nach dem Wiederverbinden).
