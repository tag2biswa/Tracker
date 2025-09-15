# main.py
from fastapi import FastAPI, HTTPException, Header, Depends, status, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import sqlite3
from datetime import datetime, timezone, timedelta
import os
import re
import textwrap

app = FastAPI(title="Time Tracker API - with Chatbot")

# CORS for local dev — tighten in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.environ.get("TIME_TRACKER_DB", "time_tracker.db")
CHATBOT_API_KEY = os.environ.get("CHATBOT_API_KEY")  # optional; if set, chat endpoint requires this

def get_db():
    conn = sqlite3.connect(DB_PATH, detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES)
    conn.row_factory = sqlite3.Row
    return conn

# ------------------------
# Models
# ------------------------
class ActivityIn(BaseModel):
    user_id: str
    app_name: str
    window_title: str
    duration: int
    timestamp: Optional[str] = None

class IdentifierInput(BaseModel):
    identifier: str

class ChatQuery(BaseModel):
    query: str
    locale: Optional[str] = None

# ------------------------
# Startup: ensure schema
# ------------------------
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

# ------------------------
# DB helpers (parameterized)
# ------------------------
def run_query(sql: str, params: tuple = ()):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(sql, params)
        rows = cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()

def run_query_one(sql: str, params: tuple = ()):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(sql, params)
        row = cur.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

# ------------------------
# Utilities
# ------------------------
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

def parse_days_from_text(text: str, default=7):
    m = re.search(r"last\s+(\d+)\s+days", text)
    if m:
        try:
            return max(1, int(m.group(1)))
        except:
            return default
    if "today" in text:
        return 1
    if "yesterday" in text:
        return 1
    return default

# ------------------------
# Existing endpoints
# ------------------------
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

# Stats endpoint (keeps previous behaviour)
@app.get("/stats/most-used/")
def stats_most_used(days: int = Query(7, ge=1, le=365)):
    conn = get_db()
    cur = conn.cursor()
    today = datetime.now().date()
    from_date = (today - timedelta(days=days-1)).isoformat()
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

# ------------------------
# Chatbot endpoint (new) - secured (optional) + NLP mapping
# ------------------------
def verify_api_key(authorization: Optional[str] = Header(None), x_api_key: Optional[str] = Header(None)):
    """
    If CHATBOT_API_KEY env var is set, require the same key via:
      - Authorization: Bearer <KEY>
      - or x-api-key: <KEY>
    If CHATBOT_API_KEY is not set, accept requests (dev convenience).
    """
    if not CHATBOT_API_KEY:
        return True
    key = None
    if authorization:
        m = re.match(r"Bearer\s+(.+)", authorization, flags=re.I)
        if m:
            key = m.group(1).strip()
    if not key and x_api_key:
        key = x_api_key.strip()
    if not key or key != CHATBOT_API_KEY:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing API key")
    return True

@app.post("/api/chatbot/query")
def chatbot_query(payload: ChatQuery, auth=Depends(verify_api_key)):
    qtext = (payload.query or "").strip()
    if not qtext:
        raise HTTPException(status_code=400, detail="Empty query")

    qlow = qtext.lower()

    # Intent: top apps / most used
    top_keywords = ["top apps", "most used", "most used apps", "most popular", "top app"]
    if any(kw in qlow for kw in top_keywords) or re.search(r"\btop\s+\d+\b", qlow):
        days = parse_days_from_text(qlow, default=7)
        today = datetime.now().date()
        from_date = (today - timedelta(days=days-1)).isoformat()
        sql = """
            SELECT a.app_name, SUM(l.duration) AS total_duration
            FROM activity_logs l
            JOIN apps a ON l.app_id = a.id
            WHERE l.activity_date >= ?
            GROUP BY a.app_name
            ORDER BY total_duration DESC
            LIMIT 10
        """
        rows = run_query(sql, (from_date,))
        if not rows:
            return {"answer": f"No activity found in the last {days} day(s)."}
        lines = [f"{r['app_name']}: {int(r['total_duration'])}s ({int(r['total_duration'])//60}m)" for r in rows]
        return {"answer": "Top apps (last {} days):\n{}".format(days, "\n".join(lines))}

    # Intent: how many minutes/hours/seconds on <app> [on YYYY-MM-DD]
    m = re.search(r"how (many|much)\s+(minutes|hours|seconds)\s+(?:did|have|have i|have we|was)\s*(?:i|we)?\s*(?:use\s+)?(?:on\s+)?([a-zA-Z0-9\.\-\_\s]+?)(?:\s+on\s+(\d{4}-\d{2}-\d{2}))?$", qlow)
    if m:
        unit = m.group(2)
        app_frag = (m.group(3) or "").strip()
        date_str = m.group(4)
        if not app_frag:
            return {"answer": "Please specify the application, e.g. 'how many minutes on Chrome'."}
        params = [f"%{app_frag}%"]
        date_clause = ""
        if date_str:
            date_clause = "AND l.activity_date = ?"
            params.append(date_str)
        sql = f"""
            SELECT SUM(l.duration) as total_duration
            FROM activity_logs l
            JOIN apps a ON l.app_id = a.id
            WHERE lower(a.app_name) LIKE lower(?)
            {date_clause}
        """
        row = run_query_one(sql, tuple(params))
        total = int(row["total_duration"] or 0) if row else 0
        if unit.startswith("minutes"):
            return {"answer": f"{total/60:.1f} minutes on '{app_frag}'{(' on ' + date_str) if date_str else ''} (raw: {total} seconds)."}
        if unit.startswith("hours"):
            return {"answer": f"{total/3600:.2f} hours on '{app_frag}'{(' on ' + date_str) if date_str else ''} (raw: {total} seconds)."}
        return {"answer": f"{total} seconds on '{app_frag}'{(' on ' + date_str) if date_str else ''}."}

    # Intent: top users for an app in last N days
    m = re.search(r"top users for\s+([a-zA-Z0-9\.\-\_\s]+)(?:\s+last\s+(\d+)\s+days)?", qlow)
    if m:
        app_frag = (m.group(1) or "").strip()
        days = int(m.group(2)) if m.group(2) else 7
        if not app_frag:
            return {"answer": "Please specify the app for which you want top users, e.g. 'top users for Slack'."}
        today = datetime.now().date()
        from_date = (today - timedelta(days=days-1)).isoformat()
        sql = """
            SELECT a.user_id, SUM(l.duration) AS user_duration
            FROM activity_logs l
            JOIN apps a ON l.app_id = a.id
            WHERE lower(a.app_name) LIKE lower(?)
              AND l.activity_date >= ?
            GROUP BY a.user_id
            ORDER BY user_duration DESC
            LIMIT 10
        """
        rows = run_query(sql, (f"%{app_frag}%", from_date))
        if not rows:
            return {"answer": f"No users found for '{app_frag}' in the last {days} day(s)."}
        lines = [f"{r['user_id']}: {int(r['user_duration'])}s ({int(r['user_duration'])//60}m)" for r in rows]
        return {"answer": f"Top users for '{app_frag}' (last {days} days):\n" + "\n".join(lines)}

    # Free text fallback search (app or window title)
    terms = re.findall(r"[a-zA-Z0-9\.\-\_]{2,}", qlow)
    if terms:
        term = terms[0]
        sql = """
            SELECT a.app_name, a.window_title, l.duration, l.activity_date
            FROM activity_logs l
            JOIN apps a ON l.app_id = a.id
            WHERE lower(a.app_name) LIKE lower(?)
               OR lower(a.window_title) LIKE lower(?)
            ORDER BY l.activity_date DESC
            LIMIT 8
        """
        rows = run_query(sql, (f"%{term}%", f"%{term}%"))
        if not rows:
            return {"answer": f"No matches found for '{term}'."}
        lines = [f"{r['activity_date']} — {r['app_name']} — {r['window_title']} — {int(r['duration'])}s" for r in rows]
        return {"answer": "Recent matches:\n" + "\n".join(lines)}

    # Help fallback
    return {"answer": textwrap.dedent(
        "I couldn't parse that. Try examples:\n"
        "- \"top apps\" or \"most used apps last 7 days\"\n"
        "- \"how many minutes on Chrome on 2025-09-12\"\n"
        "- \"top users for Slack last 14 days\"\n"
        "- \"search Chrome\""
    )}
