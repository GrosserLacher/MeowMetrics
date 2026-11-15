"""Hilfen für die Sync-Tests: mehrere Datenbanken ("Geräte"), Austausch nach dem Sync-Protokoll, Vergleich."""
import os
import random
import sqlite3
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def make_db(path_dir: str) -> str:
    """Legt in einem frischen Datenverzeichnis eine komplette, migrierte Datenbank an (wie ein Serverstart)."""
    os.makedirs(path_dir, exist_ok=True)
    env = dict(os.environ, DATA_DIR=path_dir, PYTHONPATH=ROOT)
    subprocess.run([sys.executable, "-c", "import app.main"], cwd=ROOT, env=env, check=True, capture_output=True)
    return os.path.join(path_dir, "tracker.db")


def connect(path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(path, timeout=30, isolation_level=None)
    conn.row_factory = sqlite3.Row
    return conn


def node(conn) -> str:
    return conn.execute("SELECT node FROM sync_clock").fetchone()[0]


class Link:
    """Verbindung zweier Datenbanken: a ist der Client, b der Server (beide sprechen dasselbe Protokoll)."""

    def __init__(self, sync, a, b):
        self.sync, self.a, self.b = sync, a, b
        self.sent = 0       # Position im Protokoll von a (bereits an b gesendet)
        self.cursor = 0     # Cursor in das Protokoll von b

    def run(self):
        s = self.sync
        while True:   # a -> b
            out = s.collect(self.a, node(self.b), self.sent, 200)
            s.apply_changes(self.b, node(self.a), out["changes"])
            self.sent = out["cursor"]
            if not out["has_more"]:
                break
        while True:   # b -> a
            out = s.collect(self.b, node(self.a), self.cursor, 200)
            s.apply_changes(self.a, node(self.b), out["changes"])
            self.cursor = out["cursor"]
            if not out["has_more"]:
                break


def dump(sync, conn) -> dict:
    """Alle synchronisierten Daten je Tabelle als {uid: Werte}, Verweise als uid. Vergleichbar zwischen Geräten."""
    out = {}
    for spec in sync.REGISTRY:
        if not sync._exists(conn, spec.name):
            continue
        cols = [c for c in sync.wire_cols(conn, spec)]
        rows = {}
        for r in conn.execute(f"SELECT * FROM {spec.name} WHERE uid IS NOT NULL"):
            vals = {}
            for c in cols:
                v = r[c]
                if c in spec.refs:
                    v = sync._uid_of(conn, spec.refs[c], v)
                vals[c] = v
            rows[r["uid"]] = vals
        out[spec.name] = rows
    return out


def settle(sync, *links, rounds=4):
    for _ in range(rounds):
        for l in links:
            l.run()


def diff(x: dict, y: dict) -> str:
    out = []
    for t in x:
        for u in set(x[t]) | set(y[t]):
            if x[t].get(u) != y[t].get(u):
                out.append(f"{t} {u[:8]}: {x[t].get(u)} != {y[t].get(u)}")
    return "\n".join(out[:12])
