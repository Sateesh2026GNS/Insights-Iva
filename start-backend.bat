@echo off
cd /d "%~dp0backend"
if exist "venv\Scripts\python.exe" (
    venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
) else if exist "..\.venv\Scripts\python.exe" (
    ..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
) else (
    py -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
)

