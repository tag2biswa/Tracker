import psutil
import time
import requests
import win32gui
import win32process
import getpass
from collections import defaultdict
from datetime import timedelta, datetime


API_URL = "http://localhost:8000/activity/"

last_app = None
last_title = None
start_time = None

def fetch_tracked_identifiers():
    try:
        response = requests.get("http://localhost:8000/tracked-identifiers/")
        if response.status_code == 200:
            identifiers = [item.lower() for item in response.json()]
            print("Fetched tracked identifiers:", identifiers)
            return identifiers
    except Exception as e:
        print("Failed to fetch tracked identifiers:", e)
    return []

# Helper to get active window info
def get_active_window():
    hwnd = win32gui.GetForegroundWindow()
    _, pid = win32process.GetWindowThreadProcessId(hwnd)
    for proc in psutil.process_iter(['pid', 'name']):
        if proc.info['pid'] == pid:
            app_name = proc.info['name']
            window_title = win32gui.GetWindowText(hwnd)
            return app_name, window_title
    return None, None

def is_tracked(app_name, window_title):
    if not TRACKED_IDENTIFIERS:
        return True
    app_name = app_name.lower()
    window_title = window_title.lower()
    return any(identifier in app_name or identifier in window_title for identifier in TRACKED_IDENTIFIERS)

def extract_tab_title(app_name, window_title):
    if app_name.lower() in BROWSERS:
        # Chrome/Edge format: "Tab Name - Browser"
        if " - " in window_title:
            return window_title.split(" - ")[0]
    return window_title

def extract_clean_title(app_name, window_title):
    if not app_name or not window_title:
        return "Unknown"
    if app_name.lower() in BROWSERS:
        if " - " in window_title:
            return window_title.split(" - ")[0]
        return window_title
    else:
        if " - " in window_title:
            return window_title.split(" - ")[-1].strip()
        return window_title

TRACKED_IDENTIFIERS = fetch_tracked_identifiers()
last_refresh_date = None
BROWSERS = ["chrome.exe", "msedge.exe"]
usage_summary = defaultdict(timedelta)

while True:
    # Refresh tracked identifiers daily
    ''' now_dt = datetime.now()
    now_iso = now_dt.isoformat()

    if now_dt.hour == 12 and (last_refresh_date != now_dt.date()):
        TRACKED_IDENTIFIERS = fetch_tracked_identifiers()
        last_refresh_date = now_dt.date()
        print("🔄 Refreshed tracked identifiers at 12 PM:", TRACKED_IDENTIFIERS) '''

    app_name, window_title = get_active_window()
    now = datetime.now().isoformat()

    if not app_name or not window_title:
        time.sleep(2)
        continue

    enriched_title = extract_clean_title(app_name, window_title)

    # Always send payload if previous app was tracked
    if (app_name, enriched_title) != (last_app, last_title):
        if last_app and start_time and is_tracked(last_app, last_title):
            duration = datetime.fromisoformat(now) - datetime.fromisoformat(start_time)
            key = f"{last_app} | {last_title}"
            usage_summary[key] += duration

            payload = {
                "user_id": getpass.getuser(),
                "app_name": last_app,
                "window_title": last_title,
                "duration": int(duration.total_seconds())
            }

            try:
                print("post data:", payload)
                requests.post(API_URL, json=payload)
            except Exception as e:
                print("Failed to send data:", e)

        # Update current app only if it's tracked
        if is_tracked(app_name, enriched_title):
            last_app, last_title = app_name, enriched_title
            start_time = now
            last_url = None
        else:
            last_app = None
            last_title = None
            start_time = None
    time.sleep(2)
