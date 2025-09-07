@echo off
echo Starting all scripts...

:: Start each batch file in a new window (parallel execution)
start "" "E:\Tracker\scripts\start_backend_server.bat"
start "" "E:\Tracker\scripts\start_frontend_server.bat"
start "" "E:\Tracker\scripts\start_tracker.bat"

echo All scripts launched.
pause