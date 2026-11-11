"""
features.py – Funktionen der App ein- und ausschalten, pro Benutzer (nur Anzeige; Daten bleiben immer erhalten).
Ablage: app/features.py

Jeder Benutzer hat seine eigene Ansicht. Gespeichert in der Tabelle "user_features":
  features    JSON, z. B. {"stool": false}   (fehlende Schlüssel = aktiv)
  setup_done  1, sobald der Benutzer seine Erst-Auswahl (Wizard) bestätigt hat

Migration (einmalig): Gab es früher eine gemeinsame Auswahl (Tabelle "settings"), wird sie für alle
bestehenden Benutzer übernommen. Neue Benutzer starten ohne Eintrag und bekommen beim ersten Login den Wizard.

GET /api/features   -> {"features": {...}, "setup_done": bool, "users": Anzahl Benutzer}
PUT /api/features   {"features": {...}, "setup_done": true}   (immer nur die eigene Ansicht)
"""
import json
import os
import sqlite3
from typing import Dict, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

DATA_DIR = os.environ.get("DATA_DIR", "/app/data")
DB_PATH = os.path.join(DATA_DIR, "tracker.db")
router = APIRouter(prefix="/api")

# Alle schaltbaren Funktionen (Schlüssel). Gruppen und Texte stehen im Frontend.
FEATURE_KEYS = (
    "food", "snack", "drink", "meds",                 # Füttern
    "vomit", "stool", "finding",                      # Vorfall
    "medical", "vaccination", "values", "treatment",  # Gesundheit
    "petinfo",                                        # Tier-Schnellinfo im Eintragen-Menü (nur lesend)
    "stats", "report",                                # Auswertung & Berichte
    "push",                                           # Push-Erinnerungen
)


def _db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def migrate_features():
    """Tabelle anlegen und eine frühere gemeinsame Auswahl einmalig auf alle bestehenden Benutzer übertragen."""
    conn = _db()
    conn.execute("""CREATE TABLE IF NOT EXISTS user_features (
        user_id INTEGER PRIMARY KEY, features TEXT DEFAULT '{}', setup_done INTEGER DEFAULT 0)""")
    done = conn.execute("SELECT 1 FROM settings WHERE key = 'features_migrated'").fetchone()
    if not done:
        old = conn.execute("SELECT value FROM settings WHERE key = 'features'").fetchone()
        old_done = conn.execute("SELECT value FROM settings WHERE key = 'features_setup_done'").fetchone()
        if old or (old_done and old_done["value"] == "1"):
            for u in conn.execute("SELECT id FROM users").fetchall():
                conn.execute("INSERT OR IGNORE INTO user_features (user_id, features, setup_done) VALUES (?, ?, ?)",
                             (u["id"], old["value"] if old else "{}", 1 if old_done and old_done["value"] == "1" else 0))
        conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('features_migrated', '1')")
    conn.commit()
    conn.close()


def get_features(user_id: Optional[int]) -> Dict[str, bool]:
    """Alle Schlüssel mit True/False für diesen Benutzer; fehlende Werte gelten als aktiv."""
    out = {k: True for k in FEATURE_KEYS}
    if user_id is None:
        return out
    try:
        conn = _db()
        row = conn.execute("SELECT features FROM user_features WHERE user_id = ?", (user_id,)).fetchone()
        conn.close()
        stored = json.loads(row["features"]) if row else {}
        for k in FEATURE_KEYS:
            if isinstance(stored, dict) and k in stored:
                out[k] = bool(stored[k])
    except (sqlite3.Error, ValueError):
        pass
    return out


def setup_done(user_id: int) -> bool:
    try:
        conn = _db()
        row = conn.execute("SELECT setup_done FROM user_features WHERE user_id = ?", (user_id,)).fetchone()
        conn.close()
        return bool(row and row["setup_done"])
    except sqlite3.Error:
        return False


class FeaturesIn(BaseModel):
    features: Optional[Dict[str, bool]] = None
    setup_done: Optional[bool] = None


@router.get("/features")
def read_features(request: Request):
    uid = request.state.user["id"]
    conn = _db()
    n = conn.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"]
    conn.close()
    return {"features": get_features(uid), "setup_done": setup_done(uid), "users": n}


@router.put("/features")
def write_features(data: FeaturesIn, request: Request):
    uid = request.state.user["id"]
    conn = _db()
    if data.features is not None:
        unknown = [k for k in data.features if k not in FEATURE_KEYS]
        if unknown:
            conn.close()
            raise HTTPException(status_code=400, detail="Unbekannte Funktion: " + ", ".join(unknown))
    current = get_features(uid)
    if data.features is not None:
        current.update(data.features)
    conn.execute("INSERT INTO user_features (user_id, features, setup_done) VALUES (?, ?, 0) "
                 "ON CONFLICT(user_id) DO UPDATE SET features = excluded.features",
                 (uid, json.dumps(current)))
    if data.setup_done is not None:
        conn.execute("UPDATE user_features SET setup_done = ? WHERE user_id = ?", (1 if data.setup_done else 0, uid))
    conn.commit()
    conn.close()
    return {"features": get_features(uid), "setup_done": setup_done(uid)}
