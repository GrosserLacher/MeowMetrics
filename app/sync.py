"""
sync.py – Sync-Fundament: stabile Identitäten (uid), Feld-Zeitstempel (HLC), Änderungsprotokoll, Tombstones.
Ablage: app/sync.py

Das Modul ändert keine bestehenden Endpunkte. Alle Schreibzugriffe der PWA werden von SQLite-Triggern erfasst
(die Trigger werden beim Start aus der Tabellenregistrierung REGISTRY erzeugt). Konzept: siehe Konzeptpapier,
Abschnitte 2 bis 9.

Neue Spalten je synchronisierter Tabelle:   uid TEXT (eindeutig), fts TEXT (JSON: Feld -> HLC der letzten Änderung)
Zusätzlich bei feedings/vomits/findings:    cat_uid TEXT (Tier per uid; cat_name bleibt als Kopie bestehen)
Neue Tabellen: sync_clock, sync_ctx, sync_log, sync_tomb, sync_pending

Endpunkte
  POST /api/sync              {node, cursor, changes[], limit}  ->  {cursor, changes[], has_more, applied, pending}
  GET  /api/sync/status       Knoten-ID des Servers und höchster Cursor
  POST /api/media/missing     {names[]}  ->  {missing[]}
  PUT  /api/media/{name}      Rohdaten (JPG/PNG/WebP/GIF), unveränderlich
  GET  /api/media/{name}
"""
import json
import os
import re
import secrets
import sqlite3
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel

try:
    from app.findings import _ext_from_bytes
except ImportError:  # Start ohne Paketstruktur
    from findings import _ext_from_bytes

DATA_DIR = os.environ.get("DATA_DIR", "/app/data")
DB_PATH = os.path.join(DATA_DIR, "tracker.db")
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
router = APIRouter(prefix="/api")

MAX_FUTURE_MS = 5 * 60 * 1000          # Zeitstempel weiter in der Zukunft werden vom Server neu gestempelt
ZERO_HLC = "0000000000000-0000-0"       # Ausgangsstempel für Bestandsdaten (jede echte Änderung gewinnt)
HLC_RE = re.compile(r"^\d{13}-\d{4}-[A-Za-z0-9_-]{1,40}$")
MAX_MEDIA = 12 * 1024 * 1024
MEDIA_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,120}$")


# ---------------------------------------------------------------------------------------------
#  Tabellenregistrierung
# ---------------------------------------------------------------------------------------------

@dataclass
class Spec:
    name: str
    cols: List[str]                                   # synchronisierte Datenspalten
    refs: Dict[str, str] = field(default_factory=dict)  # Spalte -> Zieltabelle (lokale Integer-ID <-> uid)
    uid_expr: str = ""                                # optional: deterministische uid, {n} = NEW. bzw. leer
    where: str = ""                                   # optional: nur Zeilen, auf die das zutrifft ({n}-Präfix)
    catname: bool = False                             # hat cat_name + cat_uid
    hooks: List[Tuple[str, str]] = field(default_factory=list)


# Reihenfolge = Abhängigkeitsreihenfolge (Ziele vor Verweisen)
REGISTRY: List[Spec] = [
    Spec("vet_clinics", ["name", "address", "phone", "email"]),
    Spec("cats", ["name", "species", "sort", "birthday", "breed", "gender_fixed", "color", "chip_number", "chip_date",
                  "chip_location", "markings", "allergies", "conditions", "permanent_meds", "attending_doctor",
                  "lifestyle", "photo", "vet_clinic_id"], refs={"vet_clinic_id": "vet_clinics"}),
    Spec("manufacturers", ["name", "kind"],
         uid_expr="CASE WHEN {n}name = 'Standard' AND {n}kind = 'drink' THEN 'man:drink:Standard' "
                  "WHEN {n}kind = 'food' AND {n}name IN ('MAC''s', 'Mjamjam', 'Catz Finefood', 'Animonda Carny') "
                  "THEN 'man:seed:' || {n}name END"),
    # Beispieldaten (Hersteller, Sorten) und das Standardgetränk haben feste Kennungen, damit sie sich zwischen Geräten
    # nicht verdoppeln. Wird eine solche Kennung schon benutzt, vergibt der Trigger eine zufällige.
    Spec("foods", ["manufacturer_id", "name"], refs={"manufacturer_id": "manufacturers"},
         uid_expr="CASE WHEN (SELECT uid FROM manufacturers WHERE id = {n}manufacturer_id) LIKE 'man:%' "
                  "THEN 'food:' || (SELECT uid FROM manufacturers WHERE id = {n}manufacturer_id) || ':' || {n}name END"),
    Spec("meds", ["name", "dose", "unit", "hidden", "sort"]),
    Spec("vomit_types", ["key", "label", "emoji", "relevant", "hidden", "sort"], uid_expr="'vt:' || {n}key"),
    Spec("rating_levels", ["score", "label", "emoji"], uid_expr="'rl:' || {n}score"),
    Spec("health_fields", ["name", "unit", "builtin", "hidden", "sort"],
         uid_expr="CASE WHEN {n}builtin = 1 THEN 'hf:' || {n}name END"),
    Spec("vaccine_types", ["name", "builtin", "hidden", "sort"],
         uid_expr="CASE WHEN {n}builtin = 1 THEN 'vac:' || {n}name END"),
    Spec("settings", ["key", "value"], uid_expr="'set:' || {n}key", where="{n}key = 'default_drink'"),
    Spec("feedings", ["batch_id", "cat_name", "manufacturer_id", "food_id", "manufacturer_name", "food_name", "rating",
                      "notes", "timestamp", "kind", "created_by_name"],
         refs={"manufacturer_id": "manufacturers", "food_id": "foods"}, catname=True),
    Spec("vomits", ["cat_name", "vomit_type", "timestamp", "notes", "image_path", "created_by_name"], catname=True),
    Spec("findings", ["cat_name", "kind", "bristol", "details", "location", "timestamp", "notes", "images",
                      "created_by_name"], catname=True),
    Spec("med_logs", ["batch_id", "cat_id", "cat_name", "med_id", "med_name", "dose", "with_food", "timestamp",
                      "notes", "created_by_name"], refs={"cat_id": "cats", "med_id": "meds"}),
    Spec("health_values", ["cat_id", "field_id", "value", "ts", "note", "created_by_name"],
         refs={"cat_id": "cats", "field_id": "health_fields"}),
    Spec("vaccinations", ["cat_id", "vaccine_name", "date_given", "valid_until", "no_expiry", "planned_date",
                          "created_by_name"], refs={"cat_id": "cats"}),
    Spec("treatments", ["cat_id", "title", "start_timestamp", "end_timestamp", "interval_hours", "notes", "is_active",
                        "created_by_name"], refs={"cat_id": "cats"}),
    Spec("treatment_logs", ["treatment_id", "timestamp", "log_type", "value_comment", "created_by_name"],
         refs={"treatment_id": "treatments"}),
]
SPEC: Dict[str, Spec] = {s.name: s for s in REGISTRY}
ORDER = {s.name: i for i, s in enumerate(REGISTRY)}
NAME_UNIQUE = {"cats", "manufacturers", "foods"}   # Tabellen mit UNIQUE auf dem Namen: Duplikate bekommen " (2)"


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=30, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout = 30000")
    return conn


def _columns(conn, table: str) -> List[str]:
    return [r["name"] for r in conn.execute(f"PRAGMA table_info({table})")]


def _exists(conn, table: str) -> bool:
    return bool(conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone())


def wire_cols(conn, spec: Spec) -> List[str]:
    have = set(_columns(conn, spec.name))
    cols = [c for c in spec.cols if c in have]
    if spec.catname and "cat_uid" in have:
        cols.append("cat_uid")
    return cols


# ---------------------------------------------------------------------------------------------
#  Hybrid Logical Clock
# ---------------------------------------------------------------------------------------------

NOW_SQL = "CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)"
TICK_SQL = (f"UPDATE sync_clock SET counter = CASE WHEN {NOW_SQL} > last_ms THEN 0 ELSE counter + 1 END, "
            f"last_ms = CASE WHEN {NOW_SQL} > last_ms THEN {NOW_SQL} ELSE last_ms END;")
HLC_SQL = "(SELECT printf('%013d-%04d-%s', last_ms, counter, node) FROM sync_clock)"
NODE_SQL = "(SELECT node FROM sync_clock)"


def _fmt(ms: int, counter: int, node: str) -> str:
    return f"{ms:013d}-{counter:04d}-{node}"


def hlc_parts(h: str) -> Tuple[int, int]:
    ms, c, _ = h.split("-", 2)
    return int(ms), int(c)


def tick(conn) -> str:
    """Neuer lokaler Stempel (gleiche Logik wie in den Triggern)."""
    row = conn.execute("SELECT last_ms, counter, node FROM sync_clock").fetchone()
    now = int(time.time() * 1000)
    if now > row["last_ms"]:
        last, counter = now, 0
    else:
        last, counter = row["last_ms"], row["counter"] + 1
    conn.execute("UPDATE sync_clock SET last_ms = ?, counter = ?", (last, counter))
    return _fmt(last, counter, row["node"])


def observe(conn, h: str):
    """Empfangenen Stempel in die lokale Uhr aufnehmen, damit spätere lokale Änderungen danach einsortiert werden."""
    ms, c = hlc_parts(h)
    row = conn.execute("SELECT last_ms, counter FROM sync_clock").fetchone()
    if ms > row["last_ms"]:
        conn.execute("UPDATE sync_clock SET last_ms = ?, counter = ?", (ms, c))
    elif ms == row["last_ms"] and c > row["counter"]:
        conn.execute("UPDATE sync_clock SET counter = ?", (c,))


def sane(conn, h) -> Optional[str]:
    """Prüft einen eingehenden Stempel. Ungültig -> None. Zu weit in der Zukunft -> vom Server neu gestempelt."""
    if not isinstance(h, str) or not HLC_RE.match(h):
        return None
    if hlc_parts(h)[0] > int(time.time() * 1000) + MAX_FUTURE_MS:
        return tick(conn)
    return h


# ---------------------------------------------------------------------------------------------
#  Migration und Trigger
# ---------------------------------------------------------------------------------------------

def _prefix(expr: str, n: str) -> str:
    return expr.replace("{n}", n)


def _q(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def _guarded(spec: Spec, n: str) -> str:
    """Feste Kennung nur verwenden, wenn sie noch frei ist (sonst NULL -> zufällige Kennung)."""
    if not spec.uid_expr:
        return "NULL"
    e = _prefix(spec.uid_expr, n)
    return f"(SELECT x FROM (SELECT {e} AS x) WHERE x IS NOT NULL AND NOT EXISTS (SELECT 1 FROM {spec.name} WHERE uid = x))"


def _build_triggers(conn, spec: Spec):
    t = spec.name
    cols = [c for c in spec.cols if c in _columns(conn, t)]
    has_cat = spec.catname and "cat_uid" in _columns(conn, t)
    stamp_cols = cols + (["cat_uid"] if has_cat else [])
    where_new = f" AND ({_prefix(spec.where, 'NEW.')})" if spec.where else ""
    where_old = f" AND ({_prefix(spec.where, 'OLD.')})" if spec.where else ""
    uid_expr = _guarded(spec, "NEW.")
    ctx = "(SELECT active FROM sync_ctx) = 0"
    fts_new = "json_object(" + ", ".join(f"{_q(c)}, {HLC_SQL}" for c in stamp_cols) + ")"
    cat_set = ", cat_uid = (SELECT uid FROM cats WHERE name = NEW.cat_name)" if has_cat else ""
    # beim Ändern nur nachführen, wenn sich der Tiername geändert hat (sonst bleibt die Kennung, auch wenn das Tier gelöscht ist)
    cat_upd = (", cat_uid = CASE WHEN OLD.cat_name IS NOT NEW.cat_name THEN (SELECT uid FROM cats WHERE name = NEW.cat_name) "
               "ELSE cat_uid END") if has_cat else ""

    for suffix in ("ai", "au", "ad"):
        conn.execute(f"DROP TRIGGER IF EXISTS sync_{t}_{suffix}")

    conn.execute(f"""CREATE TRIGGER sync_{t}_ai AFTER INSERT ON {t}
        WHEN {ctx}{where_new}
        BEGIN
          {TICK_SQL}
          UPDATE {t} SET uid = COALESCE(NULLIF(uid, ''), {uid_expr}, lower(hex(randomblob(16)))),
                         fts = {fts_new}{cat_set}
            WHERE rowid = NEW.rowid;
          DELETE FROM sync_tomb WHERE tbl = {_q(t)} AND uid = (SELECT uid FROM {t} WHERE rowid = NEW.rowid);
          INSERT INTO sync_log (tbl, uid, node) SELECT {_q(t)}, uid, {NODE_SQL} FROM {t} WHERE rowid = NEW.rowid;
        END""")

    changed = " OR ".join(f"OLD.{c} IS NOT NEW.{c}" for c in cols)
    sets = []
    for c in stamp_cols:
        if c == "cat_uid":
            cond = "OLD.cat_name IS NOT NEW.cat_name"
        else:
            cond = f"OLD.{c} IS NOT NEW.{c}"
        sets.append(f"{_q('$.' + c)}, CASE WHEN {cond} THEN {HLC_SQL} "
                    f"ELSE json_extract(COALESCE(fts, '{{}}'), {_q('$.' + c)}) END")
    conn.execute(f"""CREATE TRIGGER sync_{t}_au AFTER UPDATE OF {", ".join(cols)} ON {t}
        WHEN {ctx}{where_new} AND ({changed}) AND NEW.uid IS NOT NULL
        BEGIN
          {TICK_SQL}
          UPDATE {t} SET fts = json_set(COALESCE(fts, '{{}}'), {", ".join(sets)}){cat_upd}
            WHERE rowid = NEW.rowid;
          INSERT INTO sync_log (tbl, uid, node) VALUES ({_q(t)}, NEW.uid, {NODE_SQL});
        END""")

    conn.execute(f"""CREATE TRIGGER sync_{t}_ad AFTER DELETE ON {t}
        WHEN {ctx}{where_old} AND OLD.uid IS NOT NULL
        BEGIN
          {TICK_SQL}
          INSERT OR REPLACE INTO sync_tomb (tbl, uid, hlc) VALUES ({_q(t)}, OLD.uid, {HLC_SQL});
          INSERT INTO sync_log (tbl, uid, node) VALUES ({_q(t)}, OLD.uid, {NODE_SQL});
        END""")


def migrate_sync():
    """Idempotent: legt Metadaten an, ergänzt Spalten, vergibt uids für Bestandsdaten, erzeugt die Trigger neu."""
    conn = _connect()
    try:
        conn.execute("BEGIN IMMEDIATE")
        conn.execute("CREATE TABLE IF NOT EXISTS sync_clock (last_ms INTEGER NOT NULL, counter INTEGER NOT NULL, node TEXT NOT NULL)")
        if not conn.execute("SELECT 1 FROM sync_clock").fetchone():
            conn.execute("INSERT INTO sync_clock (last_ms, counter, node) VALUES (0, 0, ?)",
                         ("srv-" + secrets.token_hex(4),))
        conn.execute("CREATE TABLE IF NOT EXISTS sync_ctx (active INTEGER NOT NULL)")
        if not conn.execute("SELECT 1 FROM sync_ctx").fetchone():
            conn.execute("INSERT INTO sync_ctx (active) VALUES (0)")
        conn.execute("UPDATE sync_ctx SET active = 0")
        conn.execute("CREATE TABLE IF NOT EXISTS sync_log (seq INTEGER PRIMARY KEY AUTOINCREMENT, tbl TEXT NOT NULL, uid TEXT NOT NULL, node TEXT NOT NULL)")
        conn.execute("CREATE INDEX IF NOT EXISTS ix_sync_log_key ON sync_log (tbl, uid)")
        conn.execute("CREATE TABLE IF NOT EXISTS sync_tomb (tbl TEXT NOT NULL, uid TEXT NOT NULL, hlc TEXT NOT NULL, PRIMARY KEY (tbl, uid))")
        conn.execute("CREATE TABLE IF NOT EXISTS sync_pending (tbl TEXT NOT NULL, uid TEXT NOT NULL, payload TEXT NOT NULL, created REAL, PRIMARY KEY (tbl, uid))")
        node = conn.execute("SELECT node FROM sync_clock").fetchone()["node"]

        for spec in REGISTRY:
            t = spec.name
            if not _exists(conn, t):
                continue
            have = set(_columns(conn, t))
            for col in ("uid", "fts") + (("cat_uid",) if spec.catname else ()):
                if col not in have:
                    conn.execute(f"ALTER TABLE {t} ADD COLUMN {col} TEXT")
            conn.execute(f"CREATE UNIQUE INDEX IF NOT EXISTS ux_{t}_uid ON {t} (uid)")
            _backfill(conn, spec, node)
        for spec in REGISTRY:
            if _exists(conn, spec.name):
                _build_triggers(conn, spec)
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    finally:
        conn.close()


def _backfill(conn, spec: Spec, node: str):
    """uid, fts und cat_uid für Zeilen ohne Kennung (Bestandsdaten) setzen und ins Protokoll eintragen."""
    t = spec.name
    cols = [c for c in spec.cols if c in _columns(conn, t)]
    where = f" AND ({_prefix(spec.where, '')})" if spec.where else ""
    rows = conn.execute(f"SELECT rowid AS rid FROM {t} WHERE (uid IS NULL OR uid = ''){where}").fetchall()
    base = json.dumps({c: ZERO_HLC for c in cols + (["cat_uid"] if spec.catname else [])})
    for r in rows:
        uid = None
        if spec.uid_expr:
            uid = conn.execute(f"SELECT {_guarded(spec, '')} FROM {t} WHERE rowid = ?", (r["rid"],)).fetchone()[0]
        uid = uid or secrets.token_hex(16)
        conn.execute(f"UPDATE {t} SET uid = ?, fts = ? WHERE rowid = ?", (uid, base, r["rid"]))
        conn.execute("INSERT INTO sync_log (tbl, uid, node) VALUES (?, ?, ?)", (t, uid, node))
    if spec.catname and "cat_uid" in _columns(conn, t):
        conn.execute(f"UPDATE {t} SET cat_uid = (SELECT uid FROM cats WHERE cats.name = {t}.cat_name) "
                     f"WHERE cat_uid IS NULL AND cat_name IS NOT NULL")


# ---------------------------------------------------------------------------------------------
#  Änderungen erzeugen
# ---------------------------------------------------------------------------------------------

def _uid_of(conn, table: str, local_id) -> Optional[str]:
    if local_id is None or not _exists(conn, table):
        return None
    r = conn.execute(f"SELECT uid FROM {table} WHERE id = ?", (local_id,)).fetchone()
    return r["uid"] if r else None


def _state(conn, spec: Spec, uid: str) -> Optional[dict]:
    r = conn.execute(f"SELECT * FROM {spec.name} WHERE uid = ?", (uid,)).fetchone()
    if r is not None:
        try:
            fts = json.loads(r["fts"] or "{}")
        except ValueError:
            fts = {}
        fields = {}
        for c in wire_cols(conn, spec):
            v = r[c]
            if c in spec.refs:
                v = _uid_of(conn, spec.refs[c], v)
            fields[c] = [v, fts.get(c) or ZERO_HLC]
        return {"tbl": spec.name, "uid": uid, "f": fields}
    tomb = conn.execute("SELECT hlc FROM sync_tomb WHERE tbl = ? AND uid = ?", (spec.name, uid)).fetchone()
    if tomb:
        return {"tbl": spec.name, "uid": uid, "d": tomb["hlc"]}
    return None


def collect(conn, node: str, cursor: int, limit: int = 500) -> dict:
    """Änderungen anderer Knoten seit cursor. Bei cursor = 0 kommt der gesamte Bestand (auch eigene Änderungen)."""
    conn.execute("BEGIN")   # konsistenter Lesestand, damit zwischen Lesen und Cursor nichts durchrutscht
    try:
        return _collect(conn, node, cursor, limit)
    finally:
        conn.execute("COMMIT")


def _collect(conn, node: str, cursor: int, limit: int) -> dict:
    limit = max(1, min(int(limit), 2000))
    if cursor <= 0:
        rows = conn.execute("SELECT seq, tbl, uid FROM sync_log WHERE seq > ? ORDER BY seq LIMIT ?",
                            (0, limit)).fetchall()
    else:
        rows = conn.execute("SELECT seq, tbl, uid FROM sync_log WHERE seq > ? AND node != ? ORDER BY seq LIMIT ?",
                            (cursor, node, limit)).fetchall()
    if not rows:
        head = conn.execute("SELECT COALESCE(MAX(seq), 0) AS m FROM sync_log").fetchone()["m"]
        return {"cursor": max(cursor, head) if cursor > 0 else head, "changes": [], "has_more": False}
    new_cursor = rows[-1]["seq"]
    seen, items = set(), []
    for r in rows:
        key = (r["tbl"], r["uid"])
        if key in seen or r["tbl"] not in SPEC:
            continue
        seen.add(key)
        st = _state(conn, SPEC[r["tbl"]], r["uid"])
        if st:
            items.append(st)
    items.sort(key=lambda c: ORDER[c["tbl"]])
    has_more = len(rows) == limit
    if not has_more:   # alles bis zum Ende gelesen: Cursor auf den aktuellen Kopf setzen (überspringt nur eigene Einträge)
        new_cursor = conn.execute("SELECT COALESCE(MAX(seq), 0) AS m FROM sync_log").fetchone()["m"]
    return {"cursor": new_cursor, "changes": items, "has_more": has_more}


# ---------------------------------------------------------------------------------------------
#  Änderungen anwenden
# ---------------------------------------------------------------------------------------------

class Pending(Exception):
    """Die Änderung verweist auf eine Zeile, die noch nicht angekommen ist."""


def _resolve_ref(conn, table: str, uid) -> Optional[int]:
    if uid is None:
        return None
    r = conn.execute(f"SELECT id FROM {table} WHERE uid = ?", (uid,)).fetchone()
    if r:
        return r["id"]
    if conn.execute("SELECT 1 FROM sync_tomb WHERE tbl = ? AND uid = ?", (table, uid)).fetchone():
        return None   # Ziel wurde gelöscht: Verweis leeren statt ewig zu warten
    raise Pending(f"{table}:{uid}")


def _log(conn, tbl: str, uid: str, node: str):
    conn.execute("INSERT INTO sync_log (tbl, uid, node) VALUES (?, ?, ?)", (tbl, uid, node))


def _unique_name(conn, spec: Spec, values: dict, rid: Optional[int]) -> str:
    base = values["name"]
    n, name = 1, base
    while True:
        q = f"SELECT 1 FROM {spec.name} WHERE name = ?"
        params: list = [name]
        if "kind" in values and spec.name == "manufacturers":
            q += " AND kind = ?"
            params.append(values["kind"])
        if spec.name == "foods":
            q += " AND manufacturer_id IS ?"
            params.append(values.get("manufacturer_id"))
        if rid is not None:
            q += " AND rowid != ?"
            params.append(rid)
        if not conn.execute(q, params).fetchone():
            return name
        n += 1
        name = f"{base} ({n})"


def _after_write(conn, spec: Spec, rid: int, changed: set):
    """Kopien (Namen) in anderen Tabellen nachziehen. Läuft im Sync-Kontext, daher ohne Trigger."""
    t = spec.name
    row = conn.execute(f"SELECT * FROM {t} WHERE rowid = ?", (rid,)).fetchone()
    if row is None:
        return
    if t == "cats" and "name" in changed:
        for tb in ("feedings", "vomits", "findings"):
            conn.execute(f"UPDATE {tb} SET cat_name = ? WHERE cat_uid = ?", (row["name"], row["uid"]))
        conn.execute("UPDATE med_logs SET cat_name = ? WHERE cat_id = ?", (row["name"], row["id"]))
    if spec.catname and ("cat_uid" in changed or "cat_name" in changed):
        conn.execute(f"UPDATE {t} SET cat_name = (SELECT name FROM cats WHERE uid = {t}.cat_uid) "
                     f"WHERE rowid = ? AND cat_uid IN (SELECT uid FROM cats)", (rid,))
    if t == "med_logs" and "cat_id" in changed:
        conn.execute("UPDATE med_logs SET cat_name = (SELECT name FROM cats WHERE id = med_logs.cat_id) "
                     "WHERE rowid = ? AND cat_id IN (SELECT id FROM cats)", (rid,))
    if t == "manufacturers" and "name" in changed:
        conn.execute("UPDATE feedings SET manufacturer_name = ? WHERE manufacturer_id = ?", (row["name"], row["id"]))
    if t == "foods" and "name" in changed:
        conn.execute("UPDATE feedings SET food_name = ? WHERE food_id = ?", (row["name"], row["id"]))
    if t == "meds" and "name" in changed:
        conn.execute("UPDATE med_logs SET med_name = ? WHERE med_id = ?", (row["name"], row["id"]))


def _apply_one(conn, node: str, ch: dict) -> str:
    """Wendet eine Änderung an. Rückgabe: applied | ignored. Wirft Pending, wenn ein Verweis noch fehlt."""
    tbl, uid = ch.get("tbl"), ch.get("uid")
    spec = SPEC.get(tbl)
    if spec is None or not isinstance(uid, str) or not uid or len(uid) > 80 or not _exists(conn, tbl):
        return "ignored"
    t = tbl
    row = conn.execute(f"SELECT rowid AS rid, * FROM {t} WHERE uid = ?", (uid,)).fetchone()
    tomb = conn.execute("SELECT hlc FROM sync_tomb WHERE tbl = ? AND uid = ?", (t, uid)).fetchone()
    tomb_h = tomb["hlc"] if tomb else None

    # --- Löschen ------------------------------------------------------------------------------
    if "d" in ch:
        d = sane(conn, ch["d"])
        if d is None:
            return "ignored"
        observe(conn, d)
        if row is not None:
            try:
                fts = json.loads(row["fts"] or "{}")
            except ValueError:
                fts = {}
            newest = max([h for h in fts.values() if isinstance(h, str)] or [ZERO_HLC])
            if d <= newest:
                return "ignored"       # eine spätere Bearbeitung gewinnt gegen das Löschen
            conn.execute(f"DELETE FROM {t} WHERE rowid = ?", (row["rid"],))
        elif tomb_h is not None and tomb_h >= d:
            return "ignored"
        conn.execute("INSERT OR REPLACE INTO sync_tomb (tbl, uid, hlc) VALUES (?, ?, ?)", (t, uid, d))
        _log(conn, t, uid, node)
        return "applied"

    # --- Felder -------------------------------------------------------------------------------
    allowed = set(wire_cols(conn, spec))
    incoming: Dict[str, Tuple[object, str]] = {}
    for col, pair in (ch.get("f") or {}).items():
        if col not in allowed or not isinstance(pair, (list, tuple)) or len(pair) != 2:
            continue
        h = sane(conn, pair[1])
        if h is None:
            continue
        incoming[col] = (pair[0], h)
    if not incoming:
        return "ignored"
    for _, h in incoming.values():
        observe(conn, h)

    if row is None and tomb_h is not None:
        # Gelöscht und anderswo später bearbeitet: die Zeile wird mit ihrem vollständigen Stand wiederhergestellt.
        # Sind alle Felder älter als das Löschen, bleibt sie gelöscht.
        if not any(h > tomb_h for _, h in incoming.values()):
            return "ignored"

    # Verweise (uid -> lokale ID); wirft Pending
    values: Dict[str, object] = {}
    required = {r["name"] for r in conn.execute(f"PRAGMA table_info({t})") if r["notnull"]}
    for col, (val, h) in incoming.items():
        if col in spec.refs:
            val = _resolve_ref(conn, spec.refs[col], val)
            if val is None and col in required:
                val = 0   # Ziel wurde gelöscht, die Spalte darf nicht leer sein: ins Leere zeigen wie bei lokalem Löschen
        values[col] = val

    if row is not None:
        try:
            fts = json.loads(row["fts"] or "{}")
        except ValueError:
            fts = {}
        take = {c: v for c, v in values.items() if incoming[c][1] > (fts.get(c) or "")}
        if not take:
            return "ignored"
        for c in take:
            fts[c] = incoming[c][1]
        if "name" in take and t in NAME_UNIQUE:
            merged = {**{k: row[k] for k in row.keys()}, **take}
            take["name"] = _unique_name(conn, spec, merged, row["rid"])
        sets = ", ".join(f"{c} = ?" for c in take)
        conn.execute(f"UPDATE {t} SET {sets}, fts = ? WHERE rowid = ?", (*take.values(), json.dumps(fts), row["rid"]))
        _after_write(conn, spec, row["rid"], set(take))
        _log(conn, t, uid, node)
        return "applied"

    # neue Zeile
    fts = {c: incoming[c][1] for c in values}
    if "name" in values and t in NAME_UNIQUE:
        values["name"] = _unique_name(conn, spec, values, None)
    cols = list(values)
    try:
        cur = conn.execute(
            f"INSERT INTO {t} ({', '.join(cols + ['uid', 'fts'])}) VALUES ({', '.join('?' * (len(cols) + 2))})",
            (*values.values(), uid, json.dumps(fts)))
    except sqlite3.IntegrityError as e:
        if "NOT NULL" in str(e):
            raise Pending(f"{t}:{uid}:unvollständig")
        raise
    conn.execute("DELETE FROM sync_tomb WHERE tbl = ? AND uid = ?", (t, uid))
    _after_write(conn, spec, cur.lastrowid, set(values))
    _log(conn, t, uid, node)
    return "applied"


def apply_changes(conn, node: str, changes: List[dict]) -> dict:
    """Alle Änderungen in einer Transaktion anwenden. Fehlende Verweise werden zurückgestellt und erneut versucht."""
    stats = {"applied": 0, "ignored": 0, "pending": 0}
    conn.execute("BEGIN IMMEDIATE")
    try:
        conn.execute("UPDATE sync_ctx SET active = 1")
        queue: List[dict] = []
        for r in conn.execute("SELECT payload FROM sync_pending").fetchall():
            try:
                queue.append(json.loads(r["payload"]))
            except ValueError:
                pass
        conn.execute("DELETE FROM sync_pending")
        queue.extend(c for c in changes if isinstance(c, dict))
        queue.sort(key=lambda c: ORDER.get(c.get("tbl"), 99))
        while True:
            left, progress = [], False
            for ch in queue:
                conn.execute("SAVEPOINT one")
                try:
                    res = _apply_one(conn, node, ch)
                    conn.execute("RELEASE one")
                    stats["applied" if res == "applied" else "ignored"] += 1
                    progress = progress or res == "applied"
                except Pending:
                    conn.execute("ROLLBACK TO one")
                    conn.execute("RELEASE one")
                    left.append(ch)
            queue = left
            if not queue or not progress:
                break
        for ch in queue:
            conn.execute("INSERT OR REPLACE INTO sync_pending (tbl, uid, payload, created) VALUES (?, ?, ?, ?)",
                         (ch.get("tbl", ""), ch.get("uid", ""), json.dumps(ch), time.time()))
        stats["pending"] = len(queue)
        conn.execute("UPDATE sync_ctx SET active = 0")
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    return stats


# ---------------------------------------------------------------------------------------------
#  HTTP
# ---------------------------------------------------------------------------------------------

class SyncIn(BaseModel):
    node: str
    cursor: int = 0
    changes: List[dict] = []
    limit: int = 500


@router.post("/sync")
def sync_endpoint(data: SyncIn):
    if not re.fullmatch(r"[A-Za-z0-9_-]{4,40}", data.node):
        raise HTTPException(status_code=400, detail="Ungültige Knoten-ID")
    if len(data.changes) > 5000:
        raise HTTPException(status_code=413, detail="Zu viele Änderungen auf einmal (max. 5000)")
    conn = _connect()
    try:
        if data.node == conn.execute("SELECT node FROM sync_clock").fetchone()["node"]:
            raise HTTPException(status_code=400, detail="Knoten-ID gehört dem Server")
        stats = apply_changes(conn, data.node, data.changes)   # auch ohne neue Änderungen: stellt Zurückgestelltes erneut zu
        out = collect(conn, data.node, data.cursor, data.limit)
    finally:
        conn.close()
    return {**out, **stats}


@router.get("/sync/status")
def sync_status():
    conn = _connect()
    try:
        node = conn.execute("SELECT node FROM sync_clock").fetchone()["node"]
        head = conn.execute("SELECT COALESCE(MAX(seq), 0) AS m FROM sync_log").fetchone()["m"]
        pend = conn.execute("SELECT COUNT(*) AS n FROM sync_pending").fetchone()["n"]
    finally:
        conn.close()
    return {"node": node, "cursor": head, "pending": pend}


class MissingIn(BaseModel):
    names: List[str]


@router.post("/media/missing")
def media_missing(data: MissingIn):
    out = []
    for n in data.names[:2000]:
        if MEDIA_NAME_RE.match(n or "") and not os.path.exists(os.path.join(UPLOAD_DIR, n)):
            out.append(n)
    return {"missing": out}


@router.put("/media/{name}")
async def media_put(name: str, request: Request):
    if not MEDIA_NAME_RE.match(name):
        raise HTTPException(status_code=400, detail="Ungültiger Dateiname")
    path = os.path.join(UPLOAD_DIR, name)
    if os.path.exists(path):
        return {"status": "exists"}
    chunks, size = [], 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > MAX_MEDIA:
            raise HTTPException(status_code=413, detail="Foto zu groß (max. 12 MB)")
        chunks.append(chunk)
    data = b"".join(chunks)
    ext = _ext_from_bytes(data[:16])
    endings = {".jpg": (".jpg", ".jpeg"), ".png": (".png",), ".webp": (".webp",), ".gif": (".gif",)}
    if not ext or not name.lower().endswith(endings[ext]):
        raise HTTPException(status_code=400, detail="Nur Fotos im Format JPG, PNG, WebP oder GIF erlaubt, die Endung muss passen")
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    tmp = path + ".part"
    with open(tmp, "wb") as f:
        f.write(data)
    os.replace(tmp, path)
    return {"status": "stored", "size": size}


@router.get("/media/{name}")
def media_get(name: str):
    if not MEDIA_NAME_RE.match(name):
        raise HTTPException(status_code=400, detail="Ungültiger Dateiname")
    path = os.path.join(UPLOAD_DIR, name)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Datei nicht gefunden")
    return FileResponse(path, headers={"Cache-Control": "private, max-age=86400"})
