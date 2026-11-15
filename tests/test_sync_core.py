import json
import os
import sqlite3
import time

import pytest

import app.sync as sync
from helpers import Link, connect, dump, make_db, node, settle


@pytest.fixture()
def dbs(tmp_path):
    a = connect(make_db(str(tmp_path / "a")))
    b = connect(make_db(str(tmp_path / "b")))
    return a, b


def add_cat(conn, name, **kw):
    cols = {"name": name, "species": "cat", "sort": 1, **kw}
    cur = conn.execute(f"INSERT INTO cats ({','.join(cols)}) VALUES ({','.join('?' * len(cols))})", tuple(cols.values()))
    return cur.lastrowid


def add_feeding(conn, cat, note="", rating=3, ts="2026-11-01T08:00", batch="b1"):
    return conn.execute(
        "INSERT INTO feedings (batch_id, cat_name, manufacturer_name, food_name, rating, notes, timestamp, kind) "
        "VALUES (?,?,?,?,?,?,?, 'food')", (batch, cat, "Test", "Sorte", rating, note, ts)).lastrowid


def uid(conn, table, where, *p):
    return conn.execute(f"SELECT uid FROM {table} WHERE {where}", p).fetchone()[0]


# --- Migration -------------------------------------------------------------------------------------

def test_migration_is_idempotent_and_backfills(tmp_path):
    path = make_db(str(tmp_path / "m"))
    conn = connect(path)
    add_cat(conn, "Mia")
    add_feeding(conn, "Mia", "alt")
    # Altbestand simulieren: Kennungen, Protokoll und Trigger entfernen
    for spec in sync.REGISTRY:
        conn.execute(f"UPDATE {spec.name} SET uid = NULL, fts = NULL" + (", cat_uid = NULL" if spec.catname else ""))
    conn.execute("DELETE FROM sync_log")
    conn.execute("DELETE FROM sync_tomb")
    conn.close()
    os.environ["DATA_DIR"] = str(tmp_path / "m")
    old = sync.DB_PATH
    sync.DB_PATH = path
    try:
        sync.migrate_sync()
        c = connect(path)
        counts = {s.name: c.execute(f"SELECT COUNT(*) FROM {s.name}").fetchone()[0] for s in sync.REGISTRY}
        for spec in sync.REGISTRY:
            if spec.name == "settings":
                continue
            assert c.execute(f"SELECT COUNT(*) FROM {spec.name} WHERE uid IS NULL OR uid = '' OR fts IS NULL").fetchone()[0] == 0, spec.name
        f = c.execute("SELECT cat_uid FROM feedings WHERE notes = 'alt'").fetchone()
        assert f["cat_uid"] == uid(c, "cats", "name = 'Mia'")
        # Standardwerte haben feste, geräteübergreifende Kennungen
        assert uid(c, "vomit_types", "key = 'food'") == "vt:food"
        assert uid(c, "rating_levels", "score = 3") == "rl:3"
        assert uid(c, "health_fields", "name = 'Gewicht'") == "hf:Gewicht"
        log1 = c.execute("SELECT COUNT(*) FROM sync_log").fetchone()[0]
        assert log1 == sum(v for k, v in counts.items() if k != 'settings') + 1   # + Einstellung default_drink
        c.close()
        sync.migrate_sync()      # zweiter Lauf ändert nichts
        c = connect(path)
        assert c.execute("SELECT COUNT(*) FROM sync_log").fetchone()[0] == log1
        assert {s.name: c.execute(f"SELECT COUNT(*) FROM {s.name}").fetchone()[0] for s in sync.REGISTRY} == counts
        n = c.execute("SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'sync_%'").fetchone()[0]
        assert n == 3 * len(sync.REGISTRY)
    finally:
        sync.DB_PATH = old


# --- Trigger ---------------------------------------------------------------------------------------

def test_triggers_insert_update_delete(dbs):
    a, _ = dbs
    cid = add_cat(a, "Luna")
    row = a.execute("SELECT * FROM cats WHERE id = ?", (cid,)).fetchone()
    assert row["uid"] and json.loads(row["fts"])["name"]
    log0 = a.execute("SELECT COUNT(*) FROM sync_log").fetchone()[0]
    before = json.loads(row["fts"])
    time.sleep(0.003)
    a.execute("UPDATE cats SET breed = 'Maine Coon' WHERE id = ?", (cid,))
    after = json.loads(a.execute("SELECT fts FROM cats WHERE id = ?", (cid,)).fetchone()[0])
    assert after["breed"] > before["breed"] and after["name"] == before["name"]      # nur das geänderte Feld
    assert a.execute("SELECT COUNT(*) FROM sync_log").fetchone()[0] == log0 + 1
    a.execute("UPDATE cats SET breed = 'Maine Coon' WHERE id = ?", (cid,))            # gleicher Wert: kein Eintrag
    assert a.execute("SELECT COUNT(*) FROM sync_log").fetchone()[0] == log0 + 1
    u = row["uid"]
    a.execute("DELETE FROM cats WHERE id = ?", (cid,))
    assert a.execute("SELECT hlc FROM sync_tomb WHERE tbl='cats' AND uid = ?", (u,)).fetchone()


def test_replace_and_rating_levels_keep_stable_uids(dbs):
    a, _ = dbs
    a.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('default_drink', 'Milch')")
    assert uid(a, "settings", "key = 'default_drink'") == "set:default_drink"
    a.execute("DELETE FROM rating_levels")
    for s, l in ((3, "Top"), (2, "Mittel"), (1, "Schlecht")):
        a.execute("INSERT INTO rating_levels (score, label, emoji) VALUES (?,?,'')", (s, l))
    assert uid(a, "rating_levels", "score = 3") == "rl:3"
    assert not a.execute("SELECT 1 FROM sync_tomb WHERE tbl = 'rating_levels' AND uid = 'rl:3'").fetchone()


def test_unsynced_settings_are_ignored(dbs):
    a, _ = dbs
    n = a.execute("SELECT COUNT(*) FROM sync_log").fetchone()[0]
    a.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('language', 'en')")
    assert a.execute("SELECT COUNT(*) FROM sync_log").fetchone()[0] == n


def test_cat_uid_follows_cat_name(dbs):
    a, _ = dbs
    add_cat(a, "Mia")
    add_feeding(a, "Mia")
    f = a.execute("SELECT * FROM feedings").fetchone()
    assert f["cat_uid"] == uid(a, "cats", "name = 'Mia'")


# --- Austausch -------------------------------------------------------------------------------------

def test_basic_exchange_and_refs(dbs):
    a, b = dbs
    add_cat(a, "Mia")
    mid = a.execute("INSERT INTO manufacturers (name, kind) VALUES ('Testfutter', 'food')").lastrowid
    fid = a.execute("INSERT INTO foods (manufacturer_id, name) VALUES (?, 'Lachs')", (mid,)).lastrowid
    a.execute("INSERT INTO feedings (batch_id, cat_name, manufacturer_id, food_id, manufacturer_name, food_name, rating, timestamp, kind)"
              " VALUES ('x','Mia',?,?,'MAC''s','Lachs',3,'2026-11-01T08:00','food')", (mid, fid))
    cid = a.execute("SELECT id FROM cats WHERE name='Mia'").fetchone()[0]
    a.execute("INSERT INTO vaccinations (cat_id, vaccine_name, date_given) VALUES (?, 'Tollwut', '2026-01-01')", (cid,))
    link = Link(sync, a, b)
    settle(sync, link)
    assert dump(sync, a) == dump(sync, b)
    # Verweise zeigen auf die lokale ID des Ziels auf Gerät b
    f = b.execute("SELECT * FROM feedings").fetchone()
    assert b.execute("SELECT name FROM foods WHERE id = ?", (f["food_id"],)).fetchone()[0] == "Lachs"
    v = b.execute("SELECT cat_id FROM vaccinations").fetchone()
    assert b.execute("SELECT name FROM cats WHERE id = ?", (v["cat_id"],)).fetchone()[0] == "Mia"


def test_apply_is_idempotent(dbs):
    a, b = dbs
    add_cat(a, "Mia")
    out = sync.collect(a, node(b), 0, 500)
    sync.apply_changes(b, node(a), out["changes"])
    snap = dump(sync, b)
    log = b.execute("SELECT COUNT(*) FROM sync_log").fetchone()[0]
    stats = sync.apply_changes(b, node(a), out["changes"])
    assert stats["applied"] == 0 and dump(sync, b) == snap
    assert b.execute("SELECT COUNT(*) FROM sync_log").fetchone()[0] == log


def test_different_fields_both_kept(dbs):
    a, b = dbs
    cid = add_cat(a, "Mia")
    link = Link(sync, a, b)
    settle(sync, link)
    bid = b.execute("SELECT id FROM cats WHERE name = 'Mia'").fetchone()[0]
    a.execute("UPDATE cats SET breed = 'Siam' WHERE id = ?", (cid,))
    b.execute("UPDATE cats SET color = 'grau' WHERE id = ?", (bid,))
    settle(sync, link)
    for c in (a, b):
        r = c.execute("SELECT breed, color FROM cats WHERE name = 'Mia'").fetchone()
        assert (r["breed"], r["color"]) == ("Siam", "grau")
    assert dump(sync, a) == dump(sync, b)


def test_same_field_later_change_wins(dbs):
    a, b = dbs
    cid = add_cat(a, "Mia")
    link = Link(sync, a, b)
    settle(sync, link)
    bid = b.execute("SELECT id FROM cats WHERE name = 'Mia'").fetchone()[0]
    b.execute("UPDATE cats SET breed = 'früher' WHERE id = ?", (bid,))
    time.sleep(0.01)
    a.execute("UPDATE cats SET breed = 'später' WHERE id = ?", (cid,))
    settle(sync, link)
    assert a.execute("SELECT breed FROM cats").fetchone()[0] == "später"
    assert b.execute("SELECT breed FROM cats").fetchone()[0] == "später"


def test_delete_vs_edit(dbs):
    a, b = dbs
    for name in ("Gelöscht", "Bearbeitet"):
        add_cat(a, name)
    link = Link(sync, a, b)
    settle(sync, link)
    # Fall 1: Bearbeitung zuerst, Löschen später -> Löschen gewinnt
    b.execute("UPDATE cats SET breed = 'x' WHERE name = 'Gelöscht'")
    time.sleep(0.01)
    a.execute("DELETE FROM cats WHERE name = 'Gelöscht'")
    # Fall 2: Löschen zuerst, Bearbeitung später -> Bearbeitung gewinnt, Zeile wird wiederhergestellt
    a.execute("DELETE FROM cats WHERE name = 'Bearbeitet'")
    time.sleep(0.01)
    b.execute("UPDATE cats SET breed = 'y' WHERE name = 'Bearbeitet'")
    settle(sync, link)
    for c in (a, b):
        names = {r[0] for r in c.execute("SELECT name FROM cats")}
        assert "Gelöscht" not in names and "Bearbeitet" in names
    assert b.execute("SELECT breed FROM cats WHERE name='Bearbeitet'").fetchone()[0] == "y"
    assert dump(sync, a) == dump(sync, b)


def test_rename_propagates_to_copies(dbs):
    a, b = dbs
    cid = add_cat(a, "Mia")
    add_feeding(a, "Mia")
    link = Link(sync, a, b)
    settle(sync, link)
    # Umbenennen so wie der bestehende Endpunkt: Tier und Kopien in den Einträgen
    a.execute("UPDATE cats SET name = 'Mimi' WHERE id = ?", (cid,))
    a.execute("UPDATE feedings SET cat_name = 'Mimi' WHERE cat_name = 'Mia'")
    settle(sync, link)
    assert b.execute("SELECT name FROM cats").fetchone()[0] == "Mimi"
    assert b.execute("SELECT cat_name FROM feedings").fetchone()[0] == "Mimi"
    assert dump(sync, a) == dump(sync, b)


def test_rename_on_b_updates_copies_synced_from_a(dbs):
    """b benennt um, nachdem a bereits Einträge geschickt hat; Kopien auf a ziehen nach, auch ohne Eintrags-Änderung."""
    a, b = dbs
    add_cat(a, "Mia")
    link = Link(sync, a, b)
    settle(sync, link)
    bid = b.execute("SELECT id FROM cats").fetchone()[0]
    add_feeding(a, "Mia", "von a")
    settle(sync, link)
    time.sleep(0.01)
    b.execute("UPDATE cats SET name = 'Mimi' WHERE id = ?", (bid,))   # nur das Tier, ohne Kopien (Sync-Sicht)
    settle(sync, link)
    assert a.execute("SELECT cat_name FROM feedings").fetchone()[0] == "Mimi"


def test_duplicate_names_become_visible_duplicates(dbs):
    a, b = dbs
    add_cat(a, "Mia")
    add_cat(b, "Mia")
    settle(sync, Link(sync, a, b))
    for c in (a, b):
        names = sorted(r[0] for r in c.execute("SELECT name FROM cats"))
        assert len(names) == 2 and names[0] == "Mia" and names[1].startswith("Mia (")


def test_missing_reference_is_parked_and_resolved(dbs):
    a, b = dbs
    cid = add_cat(a, "Mia")
    a.execute("INSERT INTO vaccinations (cat_id, vaccine_name) VALUES (?, 'Tollwut')", (cid,))
    out = sync.collect(a, node(b), 0, 500)
    changes = out["changes"]
    vacc = [c for c in changes if c["tbl"] == "vaccinations"]
    rest = [c for c in changes if c["tbl"] != "vaccinations"]
    stats = sync.apply_changes(b, node(a), vacc)                # Verweis fehlt noch
    assert stats["pending"] == 1 and b.execute("SELECT COUNT(*) FROM vaccinations").fetchone()[0] == 0
    stats = sync.apply_changes(b, node(a), rest)                 # Tier kommt, Zurückgestelltes wird nachgezogen
    assert stats["pending"] == 0 and b.execute("SELECT COUNT(*) FROM vaccinations").fetchone()[0] == 1
    assert b.execute("SELECT COUNT(*) FROM sync_pending").fetchone()[0] == 0


def test_deleted_target_clears_reference(dbs):
    a, b = dbs
    cid = add_cat(a, "Mia")
    a.execute("INSERT INTO vaccinations (cat_id, vaccine_name) VALUES (?, 'Tollwut')", (cid,))
    link = Link(sync, a, b)
    settle(sync, link)
    a.execute("DELETE FROM cats WHERE id = ?", (cid,))
    settle(sync, link)
    assert b.execute("SELECT COUNT(*) FROM cats").fetchone()[0] == 0
    assert b.execute("SELECT COUNT(*) FROM vaccinations").fetchone()[0] == 1       # Historie bleibt wie heute


def test_future_timestamps_are_restamped(dbs):
    a, b = dbs
    cid = add_cat(a, "Mia")
    out = sync.collect(a, node(b), 0, 500)
    far = f"{int(time.time() * 1000) + 3600 * 1000 * 24:013d}-0000-evil"
    for ch in out["changes"]:
        if ch["tbl"] == "cats":
            ch["f"]["breed"] = ["Hacker", far]
    sync.apply_changes(b, node(a), out["changes"])
    fts = json.loads(b.execute("SELECT fts FROM cats WHERE name='Mia'").fetchone()[0])
    assert sync.hlc_parts(fts["breed"])[0] < int(time.time() * 1000) + sync.MAX_FUTURE_MS


def test_unknown_tables_and_columns_are_ignored(dbs):
    a, b = dbs
    stats = sync.apply_changes(b, "evil-node", [
        {"tbl": "users", "uid": "x", "f": {"username": ["root", "0000000000001-0000-x"]}},
        {"tbl": "cats", "uid": "c1", "f": {"name": ["Ok", "0000000000001-0000-x"],
                                          "id; DROP TABLE cats": ["1", "0000000000001-0000-x"]}},
    ])
    assert b.execute("SELECT COUNT(*) FROM cats").fetchone()[0] == 1
    assert b.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0


def test_local_edit_after_receive_sorts_after(dbs):
    a, b = dbs
    cid = add_cat(a, "Mia")
    a.execute("UPDATE cats SET breed = 'a1' WHERE id = ?", (cid,))
    link = Link(sync, a, b)
    settle(sync, link)
    bid = b.execute("SELECT id FROM cats").fetchone()[0]
    b.execute("UPDATE cats SET breed = 'b1' WHERE id = ?", (bid,))
    settle(sync, link)
    assert a.execute("SELECT breed FROM cats").fetchone()[0] == "b1"


def test_edit_feeding_batch_keeps_uids(dbs):
    """Die Runde wird in main.py aktualisiert statt neu angelegt (siehe test_api)."""
    a, _ = dbs
    add_cat(a, "Mia")
    fid = add_feeding(a, "Mia")
    u = a.execute("SELECT uid FROM feedings WHERE id = ?", (fid,)).fetchone()[0]
    a.execute("UPDATE feedings SET notes = 'neu' WHERE id = ?", (fid,))
    assert a.execute("SELECT uid FROM feedings WHERE id = ?", (fid,)).fetchone()[0] == u
