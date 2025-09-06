# FastAPI backend for Time Tracker

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import sqlite3

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "E:/Tracker/backend/time_tracker.db"

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

class Activity(BaseModel):
    user_id: str
    app_name: str
    window_title: str
    duration: int

class IdentifierInput(BaseModel):
    identifier: str

@app.on_event("startup")
def startup():
    conn = get_db()
    conn.execute('''CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        app_name TEXT,
        window_title TEXT,
        duration INTEGER
    )''')

    conn.execute('''CREATE TABLE IF NOT EXISTS tracked_identifiers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        identifier TEXT UNIQUE
    )''')

    conn.commit()
    conn.close()

@app.post("/activity/")
def add_activity(activity: Activity):
    conn = get_db()
    cursor = conn.execute(
        "SELECT id, duration FROM activities WHERE user_id = ? AND app_name = ? AND window_title = ?",
        (activity.user_id, activity.app_name, activity.window_title)
    )
    row = cursor.fetchone()

    if row:
        # Update existing duration
        new_duration = row["duration"] + activity.duration
        conn.execute(
            "UPDATE activities SET duration = ? WHERE id = ?",
            (new_duration, row["id"])
        )
    else:
        # Insert new activity
        conn.execute(
            "INSERT INTO activities (user_id, app_name, window_title, duration) VALUES (?, ?, ?, ?)",
            (activity.user_id, activity.app_name, activity.window_title, activity.duration)
        )
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.get("/activities/", response_model=List[Activity])
def get_activities():
    conn = get_db()
    cursor = conn.execute("SELECT user_id, app_name, window_title, duration FROM activities")
    activities = [Activity(**dict(row)) for row in cursor.fetchall()]
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
def add_identifier(identifier: str):
    conn = get_db()
    try:
        conn.execute("INSERT INTO tracked_identifiers (identifier) VALUES (?)", (identifier,))
        conn.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Identifier already exists")
    finally:
        conn.close()
    return {"status": "added"}

@app.delete("/tracked-identifiers/")
def remove_identifier(data: IdentifierInput):
    conn = get_db()
    cursor = conn.execute("DELETE FROM tracked_identifiers WHERE identifier = ?", (data.identifier,))
    conn.commit()
    conn.close()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Identifier not found")
    return {"status": "removed", "identifier": data.identifier}
