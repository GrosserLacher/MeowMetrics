"""Integrationstest über HTTP: bestehende Endpunkte arbeiten unverändert, der Sync-Weg und der Token-Login funktionieren."""
import sqlite3

import pytest
from fastapi.testclient import TestClient

import app.main as main
import app.sync as sync

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 32


@pytest.fixture(scope="module")
def client():
    c = TestClient(main.app)
    r = c.post("/api/setup-admin", json={"username": "admin", "password": "geheim1234"})
    assert r.status_code == 200
    return c


def db():
    conn = sqlite3.connect(main.DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def test_login_token_and_bearer(client):
    anon = TestClient(main.app)
    assert anon.get("/api/prefs").status_code == 401
    r = anon.post("/api/login", json={"username": "admin", "password": "geheim1234", "token": True})
    assert r.status_code == 200 and len(r.json()["token"]) > 20
    h = {"Authorization": "Bearer " + r.json()["token"]}
    other = TestClient(main.app)
    assert other.get("/api/prefs", headers=h).status_code == 200
    assert other.get("/api/prefs", headers={"Authorization": "Bearer falsch"}).status_code == 401
    # ohne token=true bleibt die Antwort wie bisher
    r2 = TestClient(main.app).post("/api/login", json={"username": "admin", "password": "geheim1234"})
    assert r2.json() == {"status": "ok"}
    # Abmelden mit Bearer beendet genau diese Sitzung
    assert other.post("/api/logout", headers=h).status_code == 200
    assert other.get("/api/prefs", headers=h).status_code == 401


def test_legacy_endpoints_still_work(client):
    assert client.post("/api/animals", json={"name": "Mia", "species": "cat"}).status_code == 200
    assert client.post("/api/animals", json={"name": "Rex", "species": "dog", "birthday": "2020-05-01"}).status_code == 200
    m = client.post("/api/catalog/manufacturers", json={"name": "Testfutter", "kind": "food"}).json()
    f = client.post("/api/foods", json={"manufacturer_id": m["id"], "name": "Huhn"}).json()
    r = client.post("/api/feedings", json={"cat_ratings": {"Mia": 3, "Rex": 2}, "manufacturer_id": m["id"],
                                           "food_id": f["id"], "notes": "x", "timestamp": "2026-11-01T08:00"})
    assert r.status_code == 200
    assert client.put("/api/rating-levels", json=[{"score": 3, "label": "A", "emoji": ""}, {"score": 2, "label": "B", "emoji": ""},
                                                 {"score": 1, "label": "C", "emoji": ""}]).status_code == 200
    assert client.put("/api/default-drink", json={"name": "Wasser"}).status_code == 200
    assert client.post("/api/vomits", data={"cat_name": "Mia", "vomit_type": "food", "timestamp": "2026-11-01T09:00",
                                            "notes": "n"}).status_code == 200
    cid = [c for c in client.get("/api/cats").json() if c["name"] == "Rex"][0]["id"]
    assert client.put(f"/api/cats/{cid}", json={"name": "Rexi"}).status_code == 200
    assert client.get("/api/bootstrap").status_code == 200
    conn = db()
    assert conn.execute("SELECT COUNT(*) FROM feedings WHERE cat_name = 'Rexi'").fetchone()[0] == 1
    assert conn.execute("SELECT cat_uid FROM feedings WHERE cat_name = 'Rexi'").fetchone()[0] == \
        conn.execute("SELECT uid FROM cats WHERE name = 'Rexi'").fetchone()[0]


def test_edit_feeding_round_keeps_uids(client):
    conn = db()
    batch = conn.execute("SELECT batch_id FROM feedings WHERE cat_name = 'Mia' AND notes = 'x'").fetchone()[0]
    mia = conn.execute("SELECT id, uid FROM feedings WHERE cat_name = 'Mia' AND batch_id = ?", (batch,)).fetchone()
    rex = conn.execute("SELECT uid FROM feedings WHERE cat_name = 'Rexi' AND batch_id = ?", (batch,)).fetchone()
    m = client.get("/api/catalog?kind=food").json()[0]
    fid = m["foods"][0]["id"]
    # Rexi entfernen, Neues Tier ergänzen, Mia bearbeiten
    assert client.post("/api/animals", json={"name": "Nala", "species": "cat"}).status_code == 200
    r = client.put(f"/api/feedings/batch/{batch}", json={"cat_ratings": {"Mia": 1, "Nala": 3}, "manufacturer_id": m["id"],
                                                         "food_id": fid, "notes": "geändert", "timestamp": "2026-11-01T08:30"})
    assert r.status_code == 200
    conn = db()
    rows = {r["cat_name"]: r for r in conn.execute("SELECT * FROM feedings WHERE batch_id = ?", (batch,))}
    assert set(rows) == {"Mia", "Nala"}
    assert rows["Mia"]["uid"] == mia["uid"] and rows["Mia"]["id"] == mia["id"]          # gleiche Zeile, gleiche Kennung
    assert rows["Mia"]["rating"] == 1 and rows["Mia"]["notes"] == "geändert" and rows["Nala"]["uid"]
    assert conn.execute("SELECT 1 FROM sync_tomb WHERE tbl = 'feedings' AND uid = ?", (rex["uid"],)).fetchone()


def test_sync_endpoint(client):
    r = client.post("/api/sync", json={"node": "testnode1", "cursor": 0, "changes": []})
    assert r.status_code == 200
    body = r.json()
    tbls = {c["tbl"] for c in body["changes"]}
    assert {"cats", "feedings", "manufacturers", "foods", "vomits"} <= tbls
    cur = body["cursor"]
    # neues Tier von einem anderen Gerät
    h = "9999999999999-0000-testnode1"
    h = f"{int(__import__('time').time() * 1000):013d}-0000-testnode1"
    ch = {"tbl": "cats", "uid": "ffff0000ffff0000ffff0000ffff0000",
          "f": {"name": ["Fremdkatze", h], "species": ["cat", h], "sort": [9, h]}}
    r = client.post("/api/sync", json={"node": "testnode1", "cursor": cur, "changes": [ch]})
    assert r.json()["applied"] == 1
    assert "Fremdkatze" in [c["name"] for c in client.get("/api/cats").json()]
    # ein zweites Gerät sieht sie, das erste bekommt die eigene Änderung nicht zurück
    r2 = client.post("/api/sync", json={"node": "testnode2", "cursor": 0, "changes": []}).json()
    assert any(c["uid"] == ch["uid"] for c in r2["changes"])
    r1 = client.post("/api/sync", json={"node": "testnode1", "cursor": r.json()["cursor"], "changes": []}).json()
    assert not any(c["uid"] == ch["uid"] for c in r1["changes"])
    # Änderung über die PWA wird beim nächsten Abruf geliefert
    client.post("/api/animals", json={"name": "Spaetling", "species": "cat"})
    r1 = client.post("/api/sync", json={"node": "testnode1", "cursor": r1["cursor"], "changes": []}).json()
    assert any(c["tbl"] == "cats" and c["f"]["name"][0] == "Spaetling" for c in r1["changes"])
    st = client.get("/api/sync/status").json()
    assert st["node"].startswith("srv-") and st["cursor"] >= r1["cursor"]


def test_sync_rejects_bad_requests(client):
    assert client.post("/api/sync", json={"node": "x", "cursor": 0, "changes": []}).status_code == 400
    node = client.get("/api/sync/status").json()["node"]
    assert client.post("/api/sync", json={"node": node, "cursor": 0, "changes": []}).status_code == 400
    assert TestClient(main.app).post("/api/sync", json={"node": "testnode9", "cursor": 0}).status_code == 401


def test_media(client):
    assert client.post("/api/media/missing", json={"names": ["a_1.png", "../x"]}).json() == {"missing": ["a_1.png"]}
    assert client.put("/api/media/a_1.png", content=PNG).json()["status"] == "stored"
    assert client.put("/api/media/a_1.png", content=PNG).json()["status"] == "exists"
    assert client.get("/api/media/a_1.png").content == PNG
    assert client.get("/uploads/a_1.png").content == PNG          # auch über den bestehenden Weg erreichbar
    assert client.put("/api/media/b.png", content=b"kein Bild").status_code == 400
    assert client.put("/api/media/c.jpg", content=PNG).status_code == 400   # Endung passt nicht zum Inhalt
    assert client.put("/api/media/..evil", content=PNG).status_code in (400, 404, 405)
    assert client.get("/api/media/fehlt.png").status_code == 404
    assert client.post("/api/media/missing", json={"names": ["a_1.png", "z.png"]}).json() == {"missing": ["z.png"]}


# --- Android-App mit gebündelter Oberfläche: Foto-Schlüssel und CORS -------------------------------------

def test_media_key_gives_read_access_to_photos(client):
    client.put("/api/media/key_test.png", content=PNG)
    anon = TestClient(main.app)
    assert anon.get("/uploads/key_test.png").status_code == 401
    key = client.get("/api/auth/media-key").json()["key"]
    assert len(key) >= 20 and client.get("/api/auth/media-key").json()["key"] == key   # stabil
    assert anon.get(f"/uploads/key_test.png?k={key}").content == PNG
    assert anon.get(f"/api/media/key_test.png?k={key}").content == PNG
    assert anon.get("/uploads/key_test.png?k=falsch-falsch-falsch-falsch").status_code == 401
    # der Schlüssel gilt nur für Fotos und nur lesend
    assert anon.get(f"/api/cats?k={key}").status_code == 401
    assert anon.put(f"/api/media/zzz.png?k={key}", content=PNG).status_code == 401
    assert anon.get(f"/api/export/db?k={key}").status_code == 401
    # Passwortänderung macht ihn ungültig
    assert client.put("/api/me/password", json={"current": "geheim1234", "new": "neuespasswort99"}).status_code == 200
    assert anon.get(f"/uploads/key_test.png?k={key}").status_code == 401
    client.put("/api/me/password", json={"current": "neuespasswort99", "new": "geheim1234"})


def test_cors_is_off_by_default_and_works_when_enabled(tmp_path):
    import os
    import subprocess
    import sys
    code = ("import app.main as m\nfrom fastapi.testclient import TestClient\nc = TestClient(m.app)\n"
            "r = c.options('/api/login', headers={'Origin': 'https://localhost', 'Access-Control-Request-Method': 'POST',"
            " 'Access-Control-Request-Headers': 'authorization,content-type'})\n"
            "print(r.status_code, r.headers.get('access-control-allow-origin'), r.headers.get('access-control-allow-headers'))\n"
            "r = c.get('/api/auth/status', headers={'Origin': 'https://localhost'})\n"
            "print(r.status_code, r.headers.get('access-control-allow-origin'))\n")
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    def run(cors):
        env = dict(os.environ, DATA_DIR=str(tmp_path / ("c" + str(bool(cors)))), PYTHONPATH=root)
        os.makedirs(env["DATA_DIR"], exist_ok=True)
        if cors:
            env["CORS_ORIGINS"] = cors
        return subprocess.run([sys.executable, "-c", code], cwd=root, env=env, capture_output=True, text=True, check=True).stdout.split("\n")
    off = run("")
    assert off[0].startswith("400") or "None" in off[0], off
    assert off[1].endswith("None")
    on = run("https://localhost")
    assert on[0].startswith("200 https://localhost"), on
    assert "authorization" in on[0].lower()
    assert on[1] == "200 https://localhost", on
