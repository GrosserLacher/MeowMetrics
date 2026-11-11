"""
cats.py – Erweiterte Tier-Stammdaten (Identifikation, Medizin) und numerische Sortierung.
Ablage: app/cats.py

Neue Spalten in der Tabelle "cats" (additiv, bestehende Daten bleiben erhalten):
  breed, gender_fixed, color, chip_number, chip_date, chip_location, markings,
  allergies, conditions, permanent_meds

Endpunkte
  GET  /api/animals/profiles          alle Tiere mit allen Stammdaten (sortiert)
  PUT  /api/animals/{id}/profile      Stammdaten ändern (nur gesendete Felder werden geändert)
  PUT  /api/animals/{id}/sort         {"position": n}  -> Tier auf Position n setzen, andere rücken nach
Anlegen (POST /api/animals), Umbenennen (PUT /api/cats/{id}) und Entfernen (DELETE /api/cats/{id})
laufen weiter über extras.py bzw. main.py.
"""
import os
import re
import sqlite3
from datetime import datetime
from typing import Optional, Union

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

try:
    from app.health import clean_birthday
except ImportError:  # Start ohne Paketstruktur
    from health import clean_birthday
try:
    from app.findings import _ext_from_bytes
except ImportError:
    from findings import _ext_from_bytes

DATA_DIR = os.environ.get("DATA_DIR", "/app/data")
DB_PATH = os.path.join(DATA_DIR, "tracker.db")
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
MAX_PHOTO = 8 * 1024 * 1024
router = APIRouter(prefix="/api/animals")

TEXT_FIELDS = {"breed": 80, "color": 80, "chip_number": 40, "chip_location": 80, "markings": 300,
               "allergies": 2000, "conditions": 2000, "permanent_meds": 2000, "attending_doctor": 120}
GENDERS = ("", "female", "female_spayed", "male", "male_neutered")
LIFESTYLES = ("", "indoor", "outdoor")   # Hauskatze / Freigänger (nur Katzen)
COLUMNS = list(TEXT_FIELDS) + ["gender_fixed", "chip_date", "lifestyle", "photo"]


def _db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def migrate_cats():
    """Idempotent: ergänzt fehlende Spalten."""
    conn = _db()
    have = {r["name"] for r in conn.execute("PRAGMA table_info(cats)")}
    for col in COLUMNS:
        if col not in have:
            conn.execute(f"ALTER TABLE cats ADD COLUMN {col} TEXT DEFAULT ''")
    conn.commit()
    conn.close()


class Profile(BaseModel):
    species: Optional[str] = None
    birthday: Optional[str] = None
    breed: Optional[str] = None
    gender_fixed: Optional[str] = None
    lifestyle: Optional[str] = None
    color: Optional[str] = None
    chip_number: Optional[str] = None
    chip_date: Optional[str] = None
    chip_location: Optional[str] = None
    markings: Optional[str] = None
    allergies: Optional[str] = None
    conditions: Optional[str] = None
    permanent_meds: Optional[str] = None
    attending_doctor: Optional[str] = None
    vet_clinic_id: Optional[Union[int, str]] = None   # Praxis aus dem Adressbuch (leer = keine)


class SortIn(BaseModel):
    position: int


def _sent(data: BaseModel) -> dict:
    return data.model_dump(exclude_unset=True) if hasattr(data, "model_dump") else data.dict(exclude_unset=True)


@router.get("/profiles")
def profiles():
    conn = _db()
    rows = conn.execute("SELECT * FROM cats ORDER BY sort, id").fetchall()
    conn.close()
    out = []
    for r in rows:
        d = {"id": r["id"], "name": r["name"], "species": r["species"] or "cat", "sort": r["sort"],
             "birthday": r["birthday"] or ""}
        for col in COLUMNS:
            d[col] = r[col] or ""
        d["vet_clinic_id"] = r["vet_clinic_id"] if "vet_clinic_id" in r.keys() else None
        d["attending_doctor"] = (r["attending_doctor"] or "") if "attending_doctor" in r.keys() else ""
        out.append(d)
    return out


@router.put("/{aid}/profile")
def update_profile(aid: int, data: Profile):
    sent = _sent(data)
    updates = {}
    conn0 = None
    for key, val in sent.items():
        val = str(val).strip() if val is not None else ""
        if key == "vet_clinic_id":
            if val:
                if not val.isdigit():
                    raise HTTPException(status_code=400, detail="Praxis ungültig")
                conn0 = conn0 or _db()
                ok = conn0.execute("SELECT 1 FROM vet_clinics WHERE id = ?", (int(val),)).fetchone()
                if not ok:
                    conn0.close()
                    raise HTTPException(status_code=400, detail="Praxis nicht gefunden")
            updates[key] = int(val) if val else None
            continue
        if key == "species":
            if val not in ("cat", "dog"):
                raise HTTPException(status_code=400, detail="species muss 'cat' oder 'dog' sein")
        elif key == "birthday":
            val = clean_birthday(val) or None
        elif key == "gender_fixed":
            if val not in GENDERS:
                raise HTTPException(status_code=400, detail="Geschlecht ungültig")
        elif key == "lifestyle":
            if val not in LIFESTYLES:
                raise HTTPException(status_code=400, detail="Lebensart ungültig")
        elif key == "chip_date":
            if val:
                if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", val):
                    raise HTTPException(status_code=400, detail="Datum ungültig")
                try:
                    if datetime.strptime(val, "%Y-%m-%d") > datetime.now():
                        raise HTTPException(status_code=400, detail="Datum liegt in der Zukunft")
                except ValueError:
                    raise HTTPException(status_code=400, detail="Datum ungültig")
        else:
            val = val[:TEXT_FIELDS[key]]
        updates[key] = val
    if conn0:
        conn0.close()
    conn = _db()
    if not conn.execute("SELECT 1 FROM cats WHERE id = ?", (aid,)).fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Tier nicht gefunden")
    if updates:
        cols = ", ".join(f"{k} = ?" for k in updates)   # Spaltennamen stammen aus dem Modell, nicht vom Client
        conn.execute(f"UPDATE cats SET {cols} WHERE id = ?", (*updates.values(), aid))
        conn.commit()
    conn.close()
    return {"status": "ok"}


@router.put("/{aid}/sort")
def set_position(aid: int, data: SortIn):
    """Tier auf Position n (1..Anzahl) setzen; die übrigen Tiere werden lückenlos neu durchnummeriert."""
    conn = _db()
    ids = [r["id"] for r in conn.execute("SELECT id FROM cats ORDER BY sort, id")]
    if aid not in ids:
        conn.close()
        raise HTTPException(status_code=404, detail="Tier nicht gefunden")
    ids.remove(aid)
    ids.insert(max(0, min(len(ids), data.position - 1)), aid)
    for pos, i in enumerate(ids, start=1):
        conn.execute("UPDATE cats SET sort = ? WHERE id = ?", (pos, i))
    conn.commit()
    conn.close()
    return {"status": "ok", "order": ids}


@router.post("/{aid}/photo")
async def set_photo(aid: int, image: UploadFile = File(...)):
    """Foto statt Avatar-Initiale (wird nur in der Tierliste und der Tier-Akte angezeigt)."""
    data = await image.read(MAX_PHOTO + 1)
    if len(data) > MAX_PHOTO:
        raise HTTPException(status_code=413, detail="Foto zu groß (max. 8 MB)")
    ext = _ext_from_bytes(data[:16])
    if not ext:
        raise HTTPException(status_code=400, detail="Nur Fotos im Format JPG, PNG, WebP oder GIF erlaubt")
    conn = _db()
    row = conn.execute("SELECT photo FROM cats WHERE id = ?", (aid,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Tier nicht gefunden")
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    name = f"pet_{aid}_{datetime.now().strftime('%Y%m%d_%H%M%S')}{ext}"
    with open(os.path.join(UPLOAD_DIR, name), "wb") as out:
        out.write(data)
    _remove_photo(row["photo"])
    conn.execute("UPDATE cats SET photo = ? WHERE id = ?", (f"/uploads/{name}", aid))
    conn.commit()
    conn.close()
    return {"photo": f"/uploads/{name}"}


@router.delete("/{aid}/photo")
def delete_photo(aid: int):
    conn = _db()
    row = conn.execute("SELECT photo FROM cats WHERE id = ?", (aid,)).fetchone()
    if row:
        _remove_photo(row["photo"])
        conn.execute("UPDATE cats SET photo = '' WHERE id = ?", (aid,))
        conn.commit()
    conn.close()
    return {"status": "deleted"}


def _remove_photo(rel):
    if rel:
        p = os.path.join(UPLOAD_DIR, os.path.basename(rel))
        if os.path.exists(p):
            try:
                os.remove(p)
            except OSError:
                pass
