# main.py
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import sqlite3
from datetime import datetime, timezone, timedelta
import os

app = FastAPI(title="Time Tracker API - Master/Detail Schema with Stats")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.environ.get("TIME_TRACKER_DB", "time_tracker.db")

def get_db():
    conn = sqlite3.connect(DB_PATH, detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES)
    conn.row_factory = sqlite3.Row
    return conn

# Pydantic models (simplified)
class ActivityIn(BaseModel):
    user_id: str
    app_name: str
    window_title: str
    duration: int
    timestamp: Optional[str] = None

class IdentifierInput(BaseModel):
    identifier: str

# helpers
def iso_now():
    return datetime.now(timezone.utc).isoformat()

def to_date_iso(ts: Optional[str]) -> str:
    if not ts:
        return datetime.now().date().isoformat()
    try:
        d = datetime.fromisoformat(ts)
        return d.date().isoformat()
    except Exception:
        try:
            return datetime.strptime(ts[:10], "%Y-%m-%d").date().isoformat()
        except Exception:
            return datetime.now().date().isoformat()

# Startup: ensure schema (apps, activity_logs, tracked_identifiers)
@app.on_event("startup")
def startup():
    conn = get_db()
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
    cur.execute("""
        CREATE TABLE IF NOT EXISTS tracked_identifiers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            identifier TEXT UNIQUE
        )
    """)
    conn.commit()
    conn.close()

# POST activity (keeps previous behaviour)
@app.post("/activity/")
def add_activity(activity: ActivityIn):
    conn = get_db()
    cur = conn.cursor()
    ts = activity.timestamp or iso_now()
    activity_date = to_date_iso(ts)

    cur.execute("INSERT OR IGNORE INTO apps (user_id, app_name, window_title) VALUES (?, ?, ?)",
                (activity.user_id, activity.app_name, activity.window_title))
    conn.commit()
    app_row = cur.execute("SELECT id FROM apps WHERE user_id = ? AND app_name = ? AND window_title = ?",
                          (activity.user_id, activity.app_name, activity.window_title)).fetchone()
    if not app_row:
        conn.close()
        raise HTTPException(status_code=500, detail="Failed to find/create app")
    app_id = app_row["id"]

    existing = cur.execute("SELECT id, duration FROM activity_logs WHERE app_id = ? AND activity_date = ?",
                           (app_id, activity_date)).fetchone()
    if existing:
        new_duration = existing["duration"] + int(activity.duration)
        cur.execute("UPDATE activity_logs SET duration = ? WHERE id = ?", (new_duration, existing["id"]))
    else:
        cur.execute("INSERT INTO activity_logs (app_id, activity_date, duration) VALUES (?, ?, ?)",
                    (app_id, activity_date, int(activity.duration)))
    conn.commit()
    conn.close()
    return {"status": "success", "app_id": app_id, "activity_date": activity_date}

# Basic list endpoints
@app.get("/apps/")
def get_apps():
    conn = get_db()
    rows = conn.execute("SELECT id, user_id, app_name, window_title FROM apps ORDER BY user_id, app_name").fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/activity-logs/")
def get_activity_logs(app_id: Optional[int] = None, start_date: Optional[str] = None, end_date: Optional[str] = None):
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

# Tracked identifiers endpoints
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

# ----------------------------
# NEW: Stats endpoint - most used app + top users for last N days
# ----------------------------
@app.get("/stats/most-used/")
def stats_most_used(days: int = Query(7, ge=1, le=365)):
    """
    Returns the most-used app (by total duration) for the last `days` days,
    together with the top users for that app (by duration).
    Response:
      {
        "app_id": 123,
        "app_name": "...",
        "window_title": "...",
        "total_duration": 12345,
        "top_users": [
          {"user_id": "...", "duration": 4000},
          ...
        ]
      }
    """
    conn = get_db()
    cur = conn.cursor()
    # date range: from_date inclusive
    today = datetime.now().date()
    from_date = (today - timedelta(days=days-1)).isoformat()
    # 1) compute totals per app_id
    q = """
        SELECT l.app_id, a.app_name, a.window_title, SUM(l.duration) AS total_duration
        FROM activity_logs l
        JOIN apps a ON l.app_id = a.id
        WHERE l.activity_date >= ?
        GROUP BY l.app_id
        ORDER BY total_duration DESC
        LIMIT 1
    """
    row = cur.execute(q, (from_date,)).fetchone()
    if not row:
        conn.close()
        return {"app_id": None, "app_name": None, "window_title": None, "total_duration": 0, "top_users": []}

    app_id = row["app_id"]
    app_name = row["app_name"]
    window_title = row["window_title"]
    total_duration = row["total_duration"] or 0

    # 2) compute top users for that app_id within same date range
    q2 = """
        SELECT a.user_id, SUM(l.duration) AS user_duration
        FROM activity_logs l
        JOIN apps a ON l.app_id = a.id
        WHERE l.app_id = ? AND l.activity_date >= ?
        GROUP BY a.user_id
        ORDER BY user_duration DESC
        LIMIT 10
    """
    users_rows = cur.execute(q2, (app_id, from_date)).fetchall()
    top_users = [{"user_id": ur["user_id"], "duration": ur["user_duration"]} for ur in users_rows]

    conn.close()
    return {
        "app_id": app_id,
        "app_name": app_name,
        "window_title": window_title,
        "total_duration": total_duration,
        "top_users": top_users,
    }
