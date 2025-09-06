import psutil
import time
import requests
import win32gui
import win32process
import getpass
from collections import defaultdict
from datetime import timedelta, datetime


API_URL = "http://localhost:3000/activity/"

last_app = None
last_title = None
start_time = None

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

TRACKED_IDENTIFIERS = [
    "chrome.exe", "msedge.exe", "notepad.exe", "Code.exe", "excel.exe", "winword.exe",
    "Google Chrome", "Microsoft Edge", "Notepad", "Visual Studio Code", "Excel", "Word"
]
BROWSERS = ["chrome.exe", "msedge.exe"]

def is_tracked(app_name, window_title):
    if not TRACKED_IDENTIFIERS:
        return True
    app_name = app_name.lower()
    window_title = window_title.lower()
    return any(identifier.lower() in app_name or identifier.lower() in window_title for identifier in TRACKED_IDENTIFIERS)

def extract_tab_title(app_name, window_title):
    if app_name.lower() in BROWSERS:
        # Chrome/Edge format: "Tab Name - Browser"
        if " - " in window_title:
            return window_title.split(" - ")[0]
    return window_title

def extract_clean_title(app_name, window_title):
    if app_name.lower() in BROWSERS:
        # For browsers, extract tab name
        if " - " in window_title:
            return window_title.split(" - ")[0]
        return window_title
    else:
        # For other apps, extract last segment (usually app name)
        if " - " in window_title:
            return window_title.split(" - ")[-1].strip()
        return window_title

usage_summary = defaultdict(timedelta)

while True:
    app_name, window_title = get_active_window()
    now = datetime.now().isoformat()

    if not is_tracked(app_name, window_title):
        time.sleep(2)
        continue

    enriched_title = extract_clean_title(app_name, window_title)

    if (app_name, enriched_title) != (last_app, last_title):
        if last_app and start_time:
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

        last_app, last_title = app_name, enriched_title
        start_time = now
        last_url = None
    time.sleep(2)
