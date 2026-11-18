# Sync-Fundament (Server)

Kurzreferenz zu `app/sync.py`. Das Konzept steht im Konzeptpapier (Abschnitte 2 bis 9).

## Was beim Start passiert
`migrate_sync()` läuft nach allen anderen Migrationen und ist idempotent:

1. Legt `sync_clock`, `sync_ctx`, `sync_log`, `sync_tomb`, `sync_pending` an.
2. Ergänzt je synchronisierter Tabelle die Spalten `uid` und `fts` (bei `feedings`, `vomits`, `findings` zusätzlich `cat_uid`).
3. Vergibt `uid` und Ausgangsstempel für Bestandsdaten und trägt sie ins Protokoll ein. Nichts wird gelöscht oder umgeschrieben.
4. Erzeugt die Trigger neu (3 je Tabelle). Sie erfassen jede Änderung, auch die der PWA.

Die Integer-IDs bleiben unverändert. Ein älteres Image läuft auf der migrierten Datenbank weiter.

## Feste Kennungen
Beispieldaten und Standardwerte haben feste `uid`s, damit sie sich zwischen Geräten nicht verdoppeln:
`vt:<key>` (Spuck-Kategorien), `rl:<score>` (Bewertungsstufen), `hf:<name>` und `vac:<name>` (Standardfelder und -impfarten),
`man:drink:Standard`, `man:seed:<name>` und `food:<hersteller-uid>:<name>` (Beispielhersteller und Standardgetränk),
`set:default_drink`. Ist eine feste Kennung schon belegt, wird eine zufällige vergeben.

## Protokoll
`POST /api/sync` mit `{node, cursor, changes, limit}`. Jede Änderung ist `{tbl, uid, f: {Feld: [Wert, HLC]}}` oder `{tbl, uid, d: HLC}` (gelöscht).
Verweise (z. B. `cat_id`) laufen als `uid` des Ziels. Die Antwort enthält die Änderungen anderer Knoten seit `cursor`
(`cursor = 0`: gesamter Bestand), den neuen `cursor`, `has_more` sowie `applied`, `ignored`, `pending`.
Eigene Änderungen kommen nicht zurück. Wiederholtes Senden ist unschädlich.

Fotos: `POST /api/media/missing`, `PUT /api/media/{name}` (unveränderlich), `GET /api/media/{name}`.

## Anmeldung für die App
`POST /api/login` mit `{"username", "password", "token": true}` liefert zusätzlich `token`. Danach `Authorization: Bearer <token>`.
`CORS_ORIGINS=https://localhost` (kommagetrennt) schaltet CORS für die App mit gebündeltem Frontend ein. Standard: aus.

## Konfliktregeln
Pro Feld gewinnt der spätere Stempel (HLC). Löschen gewinnt gegen frühere Bearbeitung, eine spätere Bearbeitung belebt die Zeile
mit vollständigem Stand wieder. Namensduplikate (Tiere, Hersteller, Sorten) bleiben als `Name (2)` sichtbar. Fehlt ein Verweis,
wird die Änderung zurückgestellt (`sync_pending`) und beim nächsten Abgleich erneut versucht.

## Tests
```bash
pip install -r requirements.txt -r requirements-dev.txt
python -m pytest -q
```
Die Tests prüfen Migration, Trigger, Konfliktregeln, Konvergenz von drei Geräten (Zufallstest) und die HTTP-Endpunkte.
