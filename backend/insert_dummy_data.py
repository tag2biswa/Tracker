#!/usr/bin/env python3
"""
Insert dummy master/detail data into a time-tracker SQLite DB.

Creates tables if missing:
  - apps (id, user_id, app_name, window_title)
  - activity_logs (id, app_id, activity_date, duration)  -- UNIQUE(app_id, activity_date)

Options:
  --db PATH      : path to sqlite DB (default: time_tracker.db)
  --days N       : how many days to generate (default: 30)
  --seed S       : RNG seed (default: 12345)
  --wipe         : delete existing rows from apps and activity_logs before inserting
  --verbose      : print progress

Example:
  python insert_dummy_data.py --db ./time_tracker.db --days 30 --wipe --verbose
"""
import sqlite3
import argparse
import random
from datetime import date, timedelta

# --- Configuration: master apps to insert (user_id, app_name, window_title) ---
DUMMY_APPS = [
    ("Alice", "chrome.exe", "YouTube"),
    ("Bob", "chrome.exe", "YouTube"),
    ("Charlie", "chrome.exe", "YouTube"),
    ("Alice", "Code.exe", "Project Tracker"),
    ("Bob", "Code.exe", "Project Tracker"),
    ("Alice", "slack.exe", "Team Chat"),
    ("Charlie", "slack.exe", "Team Chat"),
    ("Bob", "spotify.exe", "Music"),
    ("Dana", "Figma.exe", "Design"),
    ("Eve", "zoom.exe", "Meetings"),
]

MAX_DAILY_SECONDS = 4 * 3600  # up to 4 hours per app per day

# --- Utilities ---
def to_ymd(d: date) -> str:
    return d.isoformat()

def ensure_tables(conn: sqlite3.Connection, verbose=False):
    cur = conn.cursor()
    cur.execute("""
    CREATE TABLE IF NOT EXISTS apps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        app_name TEXT,
        window_title TEXT,
        UNIQUE(user_id, app_name, window_title)
    )
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_id INTEGER,
        activity_date TEXT,
        duration INTEGER,
        FOREIGN KEY(app_id) REFERENCES apps(id),
        UNIQUE(app_id, activity_date)
    )
    """)
    conn.commit()
    if verbose:
        print("Ensured tables apps and activity_logs exist.")


def wipe_data(conn: sqlite3.Connection, verbose=False):
    cur = conn.cursor()
    cur.execute("DELETE FROM activity_logs")
    cur.execute("DELETE FROM apps")
    conn.commit()
    if verbose:
        print("Wiped existing rows from activity_logs and apps.")


def insert_master_apps(conn: sqlite3.Connection, apps, verbose=False):
    """
    Insert apps into master table with INSERT OR IGNORE, then return a list of rows:
      [{id, user_id, app_name, window_title}, ...]
    """
    cur = conn.cursor()
    for (user_id, app_name, window_title) in apps:
        cur.execute(
            "INSERT OR IGNORE INTO apps (user_id, app_name, window_title) VALUES (?, ?, ?)",
            (user_id, app_name, window_title)
        )
    conn.commit()

    rows = cur.execute("SELECT id, user_id, app_name, window_title FROM apps").fetchall()
    mapped = [dict(id=r[0], user_id=r[1], app_name=r[2], window_title=r[3]) for r in rows]
    if verbose:
        print(f"Inserted/ensured {len(mapped)} master app rows.")
    return mapped


def upsert_activity_log(conn: sqlite3.Connection, app_id: int, activity_date: str, duration: int):
    """
    Add duration to existing activity_logs row if present, otherwise insert.
    """
    cur = conn.cursor()
    existing = cur.execute(
        "SELECT id, duration FROM activity_logs WHERE app_id = ? AND activity_date = ?",
        (app_id, activity_date)
    ).fetchone()
    if existing:
        new_dur = existing[1] + duration
        cur.execute("UPDATE activity_logs SET duration = ? WHERE id = ?", (new_dur, existing[0]))
    else:
        cur.execute("INSERT INTO activity_logs (app_id, activity_date, duration) VALUES (?, ?, ?)",
                    (app_id, activity_date, duration))
    conn.commit()


def generate_and_insert_logs(conn: sqlite3.Connection, master_rows, days=30, seed=12345, verbose=False):
    """
    Generates dummy activity_logs distributed across 'days' and inserts/aggregates into DB.
    The generator:
     - For each date and each unique (app_name, window_title) group, decides if that app is used that day.
     - If used, generates a total seconds for that app and distributes across all master rows with same app_name/window_title.
    """
    rnd = random.Random(seed)
    today = date.today()
    dates = [today - timedelta(days=i) for i in range(days - 1, -1, -1)]  # oldest -> newest

    # build groups by (app_name, window_title)
    groups = {}
    for m in master_rows:
        key = (m['app_name'], m['window_title'])
        groups.setdefault(key, []).append(m)

    count_inserted = 0
    for d in dates:
        ymd = to_ymd(d)
        for key, masters in groups.items():
            app_name, window_title = key
            # base probability that this app is used on this date
            base_prob = 0.3 + rnd.random() * 0.55  # 0.3 .. 0.85

            # weekday effect
            dow = d.weekday()  # 0=Mon .. 6=Sun
            day_factor = 1.0
            if dow >= 5:  # weekend
                if app_name in ("Code.exe", "slack.exe", "zoom.exe", "Figma.exe"):
                    day_factor = 0.4 + rnd.random() * 0.6
                else:
                    day_factor = 0.7 + rnd.random() * 0.6
            else:
                day_factor = 0.9 + rnd.random() * 0.3

            if rnd.random() >= (base_prob * day_factor):
                continue  # not used today

            # total duration for this app on this date
            base_dur = int((0.25 + rnd.random() * 0.75) * MAX_DAILY_SECONDS)  # 25%-100% of max

            # build weights for masters (primary user gets slightly higher weight)
            weights = []
            for m in masters:
                if m['user_id'] == masters[0]['user_id']:
                    # arbitrary bias: primary entry in list gets boost (list isn't ordered; it's ok)
                    weights.append(1.2 + rnd.random() * 0.8)
                else:
                    weights.append(0.6 + rnd.random() * 1.0)
            weight_sum = sum(weights) or 1.0

            # distribute durations and upsert
            for m, w in zip(masters, weights):
                share = w / weight_sum
                noise = 0.6 + rnd.random() * 1.2
                dur = int(base_dur * share * noise)
                if dur <= 0:
                    continue
                upsert_activity_log(conn, m['id'], ymd, dur)
                count_inserted += 1

    if verbose:
        print(f"Inserted/updated {count_inserted} activity_log rows (may be aggregated).")


def main():
    parser = argparse.ArgumentParser(description="Insert dummy apps + activity_logs into sqlite DB")
    parser.add_argument("--db", default="time_tracker.db", help="Path to sqlite DB file")
    parser.add_argument("--days", type=int, default=30, help="How many days of logs to create (default 30)")
    parser.add_argument("--seed", type=int, default=12345, help="RNG seed (default 12345)")
    parser.add_argument("--wipe", action="store_true", help="Wipe existing apps and activity_logs before inserting")
    parser.add_argument("--verbose", action="store_true", help="Verbose output")
    args = parser.parse_args()

    conn = sqlite3.connect(args.db)
    try:
        ensure_tables(conn, verbose=args.verbose)
        if args.wipe:
            wipe_data(conn, verbose=args.verbose)
        master = insert_master_apps(conn, DUMMY_APPS, verbose=args.verbose)
        # refresh to ensure we have id values for inserted rows
        master_rows = conn.execute("SELECT id, user_id, app_name, window_title FROM apps").fetchall()
        master_rows = [dict(id=r[0], user_id=r[1], app_name=r[2], window_title=r[3]) for r in master_rows]

        # generate logs and insert
        generate_and_insert_logs(conn, master_rows, days=args.days, seed=args.seed, verbose=args.verbose)

        if args.verbose:
            total_logs = conn.execute("SELECT COUNT(*) FROM activity_logs").fetchone()[0]
            print(f"Total activity_logs rows in DB now: {total_logs}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
