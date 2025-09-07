# main.py
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import sqlite3
from datetime import datetime, timezone

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# update to your DB path if different
DB_PATH = "E:/Tracker/backend/time_tracker.db"

def get_db():
    conn = sqlite3.connect(DB_PATH, detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES)
    conn.row_factory = sqlite3.Row
    return conn

class Activity(BaseModel):
    user_id: str
    app_name: str
    window_title: str
    duration: int
    timestamp: Optional[str] = None  # ISO datetime string, optional on POST

class IdentifierInput(BaseModel):
    identifier: str

def iso_now():
    return datetime.now(timezone.utc).isoformat()

@app.on_event("startup")
def startup():
    conn = get_db()
    # create table if not exists (without timestamp first if older schema)
    conn.execute('''CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        app_name TEXT,
        window_title TEXT,
        duration INTEGER,
        timestamp TEXT
    )''')

    conn.execute('''CREATE TABLE IF NOT EXISTS tracked_identifiers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        identifier TEXT UNIQUE
    )''')

    # migration: add timestamp column if missing (safe)
    cur = conn.execute("PRAGMA table_info(activities)")
    cols = [row["name"] for row in cur.fetchall()]
    if "timestamp" not in cols:
        conn.execute("ALTER TABLE activities ADD COLUMN timestamp TEXT")
    conn.commit()
    conn.close()

@app.post("/activity/")
def add_activity(activity: Activity):
    """
    Adds duration for an app/window/user. If an activity row exists for the same
    user/app/window AND same calendar date (YYYY-MM-DD), update its duration;
    otherwise insert a new activity row with provided or current timestamp.
    """
    conn = get_db()
    ts = activity.timestamp or iso_now()

    # Normalize date (YYYY-MM-DD) for comparison
    try:
        date_only = datetime.fromisoformat(ts).date().isoformat()
    except Exception:
        # fallback: use current date if parsing fails
        date_only = datetime.now().date().isoformat()

    # Find existing row with same user/app/window on same date
    cursor = conn.execute(
        """
        SELECT id, duration FROM activities
        WHERE user_id = ? AND app_name = ? AND window_title = ?
          AND date(timestamp) = date(?)
        """,
        (activity.user_id, activity.app_name, activity.window_title, ts)
    )
    row = cursor.fetchone()

    if row:
        # Update existing duration and keep timestamp as the latest (or keep earlier — here we keep existing timestamp)
        new_duration = row["duration"] + activity.duration
        conn.execute(
            "UPDATE activities SET duration = ? WHERE id = ?",
            (new_duration, row["id"])
        )
    else:
        # Insert new activity with timestamp
        conn.execute(
            "INSERT INTO activities (user_id, app_name, window_title, duration, timestamp) VALUES (?, ?, ?, ?, ?)",
            (activity.user_id, activity.app_name, activity.window_title, activity.duration, ts)
        )

    conn.commit()
    conn.close()
    return {"status": "success"}

@app.get("/activities/", response_model=List[Activity])
def get_activities():
    conn = get_db()
    cursor = conn.execute("SELECT user_id, app_name, window_title, duration, timestamp FROM activities")
    activities = []
    for row in cursor.fetchall():
        d = dict(row)
        # ensure timestamp is string (or set to None)
        activities.append(Activity(**d))
    conn.close()
    return activities

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
        conn.execute(
            "INSERT INTO tracked_identifiers (identifier) VALUES (?)",
            (data.identifier,)
        )
        conn.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Identifier already exists")
    finally:
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
