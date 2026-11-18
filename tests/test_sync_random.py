"""Zufallstest: Mehrere Geräte ändern gleichzeitig, am Ende müssen alle denselben Stand haben."""
import random
import time

import pytest

import app.sync as sync
from helpers import Link, connect, diff, dump, make_db, settle


def ops(rng, conn, tag, step):
    cats = [r["name"] for r in conn.execute("SELECT name FROM cats")]
    feeds = [r["id"] for r in conn.execute("SELECT id FROM feedings")]
    k = rng.choice(["cat", "cat", "feed", "feed", "feed", "edit", "rename", "del_feed", "del_cat", "vac", "treat"])
    if k == "cat":
        conn.execute("INSERT INTO cats (name, species, sort) VALUES (?, 'cat', 1)", (f"{tag}-cat{step}",))
    elif k == "feed" and cats:
        conn.execute("INSERT INTO feedings (batch_id, cat_name, manufacturer_name, food_name, rating, notes, timestamp, kind) "
                     "VALUES (?,?,?,?,?,?,?, 'food')", (f"{tag}{step}", rng.choice(cats), "M", "S", rng.randint(1, 3), "", "2026-11-01T08:00"))
    elif k == "edit" and feeds:
        conn.execute("UPDATE feedings SET notes = ?, rating = ? WHERE id = ?", (f"{tag}-{step}", rng.randint(1, 3), rng.choice(feeds)))
    elif k == "rename" and cats:
        old = rng.choice(cats)
        new = f"{tag}-r{step}"
        conn.execute("UPDATE cats SET name = ? WHERE name = ?", (new, old))
        conn.execute("UPDATE feedings SET cat_name = ? WHERE cat_name = ?", (new, old))
    elif k == "del_feed" and feeds:
        conn.execute("DELETE FROM feedings WHERE id = ?", (rng.choice(feeds),))
    elif k == "del_cat" and cats and rng.random() < 0.3:
        conn.execute("DELETE FROM cats WHERE name = ?", (rng.choice(cats),))
    elif k == "vac" and cats:
        cid = conn.execute("SELECT id FROM cats WHERE name = ?", (rng.choice(cats),)).fetchone()[0]
        conn.execute("INSERT INTO vaccinations (cat_id, vaccine_name) VALUES (?, ?)", (cid, f"V{tag}{step}"))
    elif k == "treat" and cats:
        cid = conn.execute("SELECT id FROM cats WHERE name = ?", (rng.choice(cats),)).fetchone()[0]
        conn.execute("INSERT INTO treatments (cat_id, title, start_timestamp, is_active) VALUES (?, ?, '2026-11-01T08:00', 1)",
                     (cid, f"T{tag}{step}"))


@pytest.mark.parametrize("seed", range(8))
def test_three_devices_converge(tmp_path, seed):
    rng = random.Random(seed)
    server = connect(make_db(str(tmp_path / "s")))
    d1 = connect(make_db(str(tmp_path / "d1")))
    d2 = connect(make_db(str(tmp_path / "d2")))
    l1, l2 = Link(sync, d1, server), Link(sync, d2, server)
    for step in range(60):
        who = rng.choice([("a", d1), ("b", d2), ("s", server)])
        ops(rng, who[1], who[0], step)
        if rng.random() < 0.25:
            time.sleep(0.002)
            rng.choice([l1, l2]).run()
    settle(sync, l1, l2, rounds=5)
    s, a, b = dump(sync, server), dump(sync, d1), dump(sync, d2)
    assert s == a, diff(s, a)
    assert s == b, diff(s, b)
