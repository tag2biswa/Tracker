# FastAPI backend for Time Tracker

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
#from typing import Optional

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
    start_time: str
    end_time: str

@app.on_event("startup")
def startup():
    conn = get_db()
    conn.execute('''CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        app_name TEXT,
        window_title TEXT,
        start_time TEXT,
        end_time TEXT
    )''')
    conn.commit()
    conn.close()

@app.post("/activity/")
def add_activity(activity: Activity):
    conn = get_db()
    conn.execute(
        "INSERT INTO activities (user_id, app_name, window_title, start_time, end_time) VALUES (?, ?, ?, ?, ?)",
        (activity.user_id, activity.app_name, activity.window_title, activity.start_time, activity.end_time)
    )
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.get("/activities/", response_model=List[Activity])
def get_activities():
    conn = get_db()
    cursor = conn.execute("SELECT user_id, app_name, window_title, start_time, end_time FROM activities")
    activities = [Activity(**dict(row)) for row in cursor.fetchall()]
    conn.close()
    return activities
