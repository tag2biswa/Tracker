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

usage_summary = defaultdict(timedelta)

while True:
    app_name, window_title = get_active_window()
    now = datetime.now().isoformat()

    if (app_name, window_title) != (last_app, last_title):
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

        last_app, last_title = app_name, window_title
        start_time = now
        last_url = None  # Extend for browser tracking
    time.sleep(2)
