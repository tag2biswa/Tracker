# main.py
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import sqlite3
from datetime import datetime, timezone
import os

app = FastAPI(title="Time Tracker API - Master/Detail Schema")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Configuration ----
# Use an absolute path if your DB sits elsewhere. This assumes the DB file sits in the same folder.
DB_PATH = os.environ.get("TIME_TRACKER_DB", "time_tracker.db")

def get_db():
    conn = sqlite3.connect(DB_PATH, detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES)
    conn.row_factory = sqlite3.Row
    return conn

# ---- Pydantic models ----
class ActivityIn(BaseModel):
    user_id: str
    app_name: str
    window_title: str
    duration: int
    timestamp: Optional[str] = None  # ISO datetime optional

class ActivityOut(BaseModel):
    user_id: str
    app_name: str
    window_title: str
    activity_date: str  # YYYY-MM-DD
    duration: int

class AppOut(BaseModel):
    id: int
    user_id: str
    app_name: str
    window_title: str

class IdentifierInput(BaseModel):
    identifier: str

# helper
def iso_now():
    return datetime.now(timezone.utc).isoformat()

def to_date_iso(ts: Optional[str]) -> str:
    """
    Convert an ISO timestamp string to YYYY-MM-DD. If invalid or None, returns today's date.
    """
    if not ts:
        return datetime.now().date().isoformat()
    try:
        # Python 3.11+ supports fromisoformat with timezone; fromisoformat handles many ISO variants
        d = datetime.fromisoformat(ts)
        return d.date().isoformat()
    except Exception:
        try:
            # fallback parse loosely
            return datetime.strptime(ts[:10], "%Y-%m-%d").date().isoformat()
        except Exception:
            return datetime.now().date().isoformat()

# ---- Startup: create tables and migrate old schema if present ----
@app.on_event("startup")
def startup():
    conn = get_db()
    cur = conn.cursor()

    # Create master (apps) and detail (activity_logs) tables
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
            activity_date TEXT,         -- YYYY-MM-DD
            duration INTEGER,
            FOREIGN KEY(app_id) REFERENCES apps(id),
            UNIQUE(app_id, activity_date)
        )
    """)

    # tracked_identifiers table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS tracked_identifiers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            identifier TEXT UNIQUE
        )
    """)

    conn.commit()

    # If old 'activities' table exists with columns (id,user_id,app_name,window_title,duration,timestamp)
    # then migrate its data into the new schema.
    # We will only perform migration if table 'activities' exists and the backup has not yet been made.
    try:
        rows = cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='activities'").fetchall()
        if rows:
            # Check whether we already migrated (presence of activities_migrated_backup prevents re-migration)
            already_backed_up = cur.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='activities_migrated_backup'"
            ).fetchone()
            if not already_backed_up:
                print("Old 'activities' table found — starting migration into apps + activity_logs ...")
                # Read everything from old activities
                old_rows = cur.execute("SELECT user_id, app_name, window_title, duration, timestamp FROM activities").fetchall()
                # We'll aggregate totals per (user_id, app_name, window_title, date)
                aggregates = {}  # key: (user,app,win,date) -> total_duration
                for r in old_rows:
                    user_id = r["user_id"]
                    app_name = r["app_name"]
                    window_title = r["window_title"]
                    duration = int(r["duration"]) if r["duration"] is not None else 0
                    ts = r["timestamp"] if "timestamp" in r.keys() else None
                    activity_date = to_date_iso(ts)
                    key = (user_id, app_name, window_title, activity_date)
                    aggregates[key] = aggregates.get(key, 0) + duration

                # Insert into apps and activity_logs
                for (user_id, app_name, window_title, activity_date), total_dur in aggregates.items():
                    # insert or ignore into apps
                    cur.execute("""
                        INSERT OR IGNORE INTO apps (user_id, app_name, window_title) VALUES (?, ?, ?)
                    """, (user_id, app_name, window_title))
                    conn.commit()
                    # get app id
                    app_row = cur.execute("""
                        SELECT id FROM apps WHERE user_id = ? AND app_name = ? AND window_title = ?
                    """, (user_id, app_name, window_title)).fetchone()
                    if not app_row:
                        # should not happen
                        continue
                    app_id = app_row["id"]
                    # insert or update activity_logs
                    existing = cur.execute("""
                        SELECT id, duration FROM activity_logs WHERE app_id = ? AND activity_date = ?
                    """, (app_id, activity_date)).fetchone()
                    if existing:
                        new_dur = existing["duration"] + total_dur
                        cur.execute("UPDATE activity_logs SET duration = ? WHERE id = ?", (new_dur, existing["id"]))
                    else:
                        cur.execute("INSERT INTO activity_logs (app_id, activity_date, duration) VALUES (?, ?, ?)",
                                    (app_id, activity_date, total_dur))
                conn.commit()

                # rename old table to a backup name so migration won't run again and data is preserved
                cur.execute("ALTER TABLE activities RENAME TO activities_migrated_backup")
                conn.commit()
                print("Migration complete. Old table renamed to 'activities_migrated_backup'.")
            else:
                print("Found 'activities' but migration backup already exists — skipping migration.")
    except Exception as e:
        print("Migration check failed:", e)
    finally:
        conn.close()

# ---- API endpoints ----

@app.post("/activity/")
def add_activity(activity: ActivityIn):
    """
    Add activity duration. It will:
    - ensure the (user, app, window) exists in 'apps' master table (INSERT OR IGNORE)
    - convert timestamp -> activity_date (YYYY-MM-DD)
    - upsert into activity_logs (sum duration for same app_id & activity_date)
    """
    conn = get_db()
    cur = conn.cursor()
    ts = activity.timestamp or iso_now()
    activity_date = to_date_iso(ts)

    # ensure app exists
    cur.execute("""
        INSERT OR IGNORE INTO apps (user_id, app_name, window_title) VALUES (?, ?, ?)
    """, (activity.user_id, activity.app_name, activity.window_title))
    conn.commit()

    # fetch app id
    app_row = cur.execute("""
        SELECT id FROM apps WHERE user_id = ? AND app_name = ? AND window_title = ?
    """, (activity.user_id, activity.app_name, activity.window_title)).fetchone()
    if not app_row:
        conn.close()
        raise HTTPException(status_code=500, detail="Failed to find or create app record")
    app_id = app_row["id"]

    # upsert into activity_logs (sum durations)
    existing = cur.execute("""
        SELECT id, duration FROM activity_logs WHERE app_id = ? AND activity_date = ?
    """, (app_id, activity_date)).fetchone()
    if existing:
        new_duration = existing["duration"] + int(activity.duration)
        cur.execute("UPDATE activity_logs SET duration = ? WHERE id = ?", (new_duration, existing["id"]))
    else:
        cur.execute("INSERT INTO activity_logs (app_id, activity_date, duration) VALUES (?, ?, ?)",
                    (app_id, activity_date, int(activity.duration)))
    conn.commit()
    conn.close()
    return {"status": "success", "app_id": app_id, "activity_date": activity_date}

@app.get("/activities/", response_model=List[ActivityOut])
def get_activities(limit: Optional[int] = Query(None, ge=1)):
    """
    Returns joined activity logs with master app info.
    Optionally limit number of rows returned (useful for quick testing).
    """
    conn = get_db()
    q = """
        SELECT a.user_id, a.app_name, a.window_title,
               l.activity_date, l.duration
        FROM activity_logs l
        JOIN apps a ON l.app_id = a.id
        ORDER BY l.activity_date DESC, l.duration DESC
    """
    if limit:
        q += f" LIMIT {int(limit)}"
    cursor = conn.execute(q)
    rows = cursor.fetchall()
    conn.close()
    return [ActivityOut(**dict(r)) for r in rows]

@app.get("/apps/", response_model=List[AppOut])
def get_apps():
    conn = get_db()
    rows = conn.execute("SELECT id, user_id, app_name, window_title FROM apps ORDER BY user_id, app_name").fetchall()
    conn.close()
    return [AppOut(**dict(r)) for r in rows]

@app.get("/activity-logs/")
def get_activity_logs(app_id: Optional[int] = None, start_date: Optional[str] = None, end_date: Optional[str] = None):
    """
    Returns activity_logs joined with app info.
    Optional filters:
      - app_id (int)
      - start_date (YYYY-MM-DD) inclusive
      - end_date (YYYY-MM-DD) inclusive
    """
    conn = get_db()
    params = []
    where = []
    if app_id is not None:
        where.append("l.app_id = ?")
        params.append(int(app_id))
    if start_date:
        where.append("l.activity_date >= ?")
        params.append(start_date)
    if end_date:
        where.append("l.activity_date <= ?")
        params.append(end_date)

    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    q = f"""
        SELECT l.id, l.app_id, l.activity_date, l.duration,
               a.user_id, a.app_name, a.window_title
        FROM activity_logs l
        JOIN apps a ON l.app_id = a.id
        {where_sql}
        ORDER BY l.activity_date DESC, l.duration DESC
    """
    cursor = conn.execute(q, params)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

# Tracked identifiers endpoints (unchanged)
@app.get("/tracked-identifiers/")
def get_tracked_identifiers():
    conn = get_db()
    cursor = conn.execute("SELECT identifier FROM tracked_identifiers")
    identifiers = [row["identifier"] for row in cursor.fetchall()]
    conn.close()
    return identifiers

@app.post("/tracked-identifiers/")
def add_identifier(data: IdentifierInput):
    conn = get_db()
    try:
        conn.execute("INSERT INTO tracked_identifiers (identifier) VALUES (?)", (data.identifier,))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Identifier already exists")
    conn.close()
    return {"status": "added", "identifier": data.identifier}

@app.delete("/tracked-identifiers/{identifier}")
def remove_identifier(identifier: str):
    conn = get_db()
    cursor = conn.execute("DELETE FROM tracked_identifiers WHERE identifier = ?", (identifier,))
    conn.commit()
    conn.close()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Identifier not found")
    return {"status": "removed", "identifier": identifier}
