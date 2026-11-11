"""
audit.py – Wer hat etwas eingetragen?
Ablage: app/audit.py

Die Anmelde-Middleware (main.py) merkt sich den aktuellen Benutzer in einer ContextVar. Beim Anlegen eines
Eintrags liefert who() dessen ID und Namen. Gespeichert wird beides (Name zusätzlich als Kopie), damit
der Name auch dann erhalten bleibt, wenn ein Benutzer später gelöscht wird.

Spalten (additiv, bestehende Einträge behalten NULL = "unbekannt"):
  created_by (INTEGER), created_by_name (TEXT)  in: feedings, vomits, med_logs, findings, treatments,
  treatment_logs, health_values, vaccinations
"""
import os
import sqlite3
from contextvars import ContextVar
from typing import Optional, Tuple

DATA_DIR = os.environ.get("DATA_DIR", "/app/data")
DB_PATH = os.path.join(DATA_DIR, "tracker.db")
TABLES = ("feedings", "vomits", "med_logs", "findings", "treatments", "treatment_logs", "health_values", "vaccinations")

_current: ContextVar = ContextVar("audit_user", default=None)


def set_user(user: Optional[dict]):
    _current.set(user)


def who() -> Tuple[Optional[int], Optional[str]]:
    u = _current.get()
    return (u["id"], u["username"]) if u else (None, None)


def migrate():
    conn = sqlite3.connect(DB_PATH)
    for t in TABLES:
        cols = {r[1] for r in conn.execute(f"PRAGMA table_info({t})")}
        if not cols:   # Tabelle existiert (noch) nicht
            continue
        for col, ddl in (("created_by", "INTEGER"), ("created_by_name", "TEXT")):
            if col not in cols:
                conn.execute(f"ALTER TABLE {t} ADD COLUMN {col} {ddl}")
    conn.commit()
    conn.close()
