"""
vets.py – Zentrales Tierarzt-Adressbuch.
Ablage: app/vets.py

Tabelle vet_clinics (id, name, address, phone, email). Jedes Tier kann eine Praxis (cats.vet_clinic_id) und einen
behandelnden Arzt (cats.attending_doctor) haben. Beides wird in cats.py über /api/animals/{id}/profile gesetzt.

GET    /api/vets
POST   /api/vets        {name, address, phone, email}
PUT    /api/vets/{id}
DELETE /api/vets/{id}   (Tiere, die diese Praxis hatten, verlieren nur die Zuordnung)
"""
import os
import sqlite3

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

DATA_DIR = os.environ.get("DATA_DIR", "/app/data")
DB_PATH = os.path.join(DATA_DIR, "tracker.db")
router = APIRouter(prefix="/api/vets")


def _db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def migrate_vets():
    """Idempotent: Tabelle und neue Spalten in "cats" anlegen."""
    conn = _db()
    conn.execute("""CREATE TABLE IF NOT EXISTS vet_clinics (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, address TEXT DEFAULT '',
        phone TEXT DEFAULT '', email TEXT DEFAULT '')""")
    have = {r["name"] for r in conn.execute("PRAGMA table_info(cats)")}
    if "vet_clinic_id" not in have:
        conn.execute("ALTER TABLE cats ADD COLUMN vet_clinic_id INTEGER")
    if "attending_doctor" not in have:
        conn.execute("ALTER TABLE cats ADD COLUMN attending_doctor TEXT DEFAULT ''")
    conn.commit()
    conn.close()


class VetIn(BaseModel):
    name: str
    address: str = ""
    phone: str = ""
    email: str = ""


def _clean(data: VetIn) -> dict:
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name der Praxis darf nicht leer sein")
    email = data.email.strip()
    if email and ("@" not in email or " " in email or len(email) > 120):
        raise HTTPException(status_code=400, detail="E-Mail-Adresse ungültig")
    return {"name": name[:120], "address": data.address.strip()[:300], "phone": data.phone.strip()[:40], "email": email}


def list_vets():
    conn = _db()
    rows = conn.execute("SELECT id, name, address, phone, email FROM vet_clinics ORDER BY name COLLATE NOCASE").fetchall()
    conn.close()
    return [dict(r) for r in rows]


router.add_api_route("", list_vets, methods=["GET"])


@router.post("")
def add_vet(data: VetIn):
    d = _clean(data)
    conn = _db()
    cur = conn.execute("INSERT INTO vet_clinics (name, address, phone, email) VALUES (?, ?, ?, ?)",
                       (d["name"], d["address"], d["phone"], d["email"]))
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return {"id": new_id, **d}


@router.put("/{vid}")
def edit_vet(vid: int, data: VetIn):
    d = _clean(data)
    conn = _db()
    cur = conn.execute("UPDATE vet_clinics SET name = ?, address = ?, phone = ?, email = ? WHERE id = ?",
                       (d["name"], d["address"], d["phone"], d["email"], vid))
    conn.commit()
    conn.close()
    if not cur.rowcount:
        raise HTTPException(status_code=404, detail="Praxis nicht gefunden")
    return {"status": "ok"}


@router.delete("/{vid}")
def delete_vet(vid: int):
    conn = _db()
    conn.execute("UPDATE cats SET vet_clinic_id = NULL WHERE vet_clinic_id = ?", (vid,))
    conn.execute("DELETE FROM vet_clinics WHERE id = ?", (vid,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}
