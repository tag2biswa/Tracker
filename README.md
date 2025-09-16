# Tracker

A full-stack time/activity tracker with a FastAPI backend and a React frontend.

## Project Structure

```
backend/    # FastAPI backend (Python)
frontend/   # React frontend (JS/JSX, Vite)
tracker/    # Tracker agent (Python, PyInstaller)
scripts/    # Utility scripts for setup/install
```

## Features

- **Track app/window usage** and store in a SQLite database.
- **REST API** for activity logs, tracked identifiers, and stats.
- **Modern React frontend** with dashboards, activity overview, and chatbot.
- **Dummy data generation** for development/testing.
- **Cross-platform tracker agent** (packaged with PyInstaller).

## Getting Started

### Backend

1. Install dependencies:
    ```sh
    cd backend
    pip install -r requirements.txt
    ```
2. Run the backend server:
    ```sh
    uvicorn main:app --reload
    ```
   The API will be available at `http://localhost:8000`.

3. (Optional) Insert dummy data:
    ```sh
    python insert_dummy_data.py --db time_tracker.db --days 30 --wipe --verbose
    ```

### Frontend

1. Install dependencies:
    ```sh
    cd frontend
    npm install
    ```
2. Start the frontend dev server:
    ```sh
    npm run dev
    ```
   The app will be available at `http://localhost:5173`.

3. The frontend is configured to proxy API requests to the backend.

### Tracker Agent

- The tracker agent is in [`tracker/tracker.py`](tracker/tracker.py).
- Build with PyInstaller using [`tracker/tracker.spec`](tracker/tracker.spec).

## Key Files

- **Backend API:** [`backend/main.py`](backend/main.py)
- **Frontend entry:** [`frontend/src/main.jsx`](frontend/src/main.jsx)
- **Frontend dashboard:** [`frontend/src/AppTrackerDashboard.jsx`](frontend/src/AppTrackerDashboard.jsx)
- **Activity overview:** [`frontend/src/ActivityOverview.jsx`](frontend/src/ActivityOverview.jsx)
- **Tracked apps manager:** [`frontend/src/TrackedIdentifiersManager.jsx`](frontend/src/TrackedIdentifiersManager.jsx)
- **Chatbot:** [`frontend/src/ChatBot.jsx`](frontend/src/ChatBot.jsx)
- **Dummy data:** [`frontend/src/dummyData.js`](frontend/src/dummyData.js)

## API Endpoints

- `/activity-logs/` — Get activity logs
- `/tracked-identifiers/` — Manage tracked apps
- `/stats/most-used/` — Get most used app and top users
- `/api/chatbot/query` — Chatbot endpoint (NLP queries)

## Configuration

- Frontend uses Vite. Proxy settings are in [`frontend/vite.config.js`](frontend/vite.config.js).
- To use dummy data in the frontend, set `USE_DUMMY_DATA = true` in [`frontend/src/config.js`](frontend/src/config.js).f present).

---

*For more details, see the code and comments in each module.*
