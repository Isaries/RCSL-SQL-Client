@echo off
setlocal
chcp 65001 > nul

echo ===================================================
echo   RCSL SQL Client - Auto Launcher
echo ===================================================

:: 1. Check Python installation
python --version > nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found!
    echo Please install Python first (Make sure to check "Add Python to PATH")
    echo Download: https://www.python.org/downloads/
    pause
    exit /b
)

:: 2. Check/Create virtual environment
if not exist "venv" (
    echo [SYSTEM] Creating virtual environment...
    python -m venv venv
)

:: 3. Activate virtual environment
call venv\Scripts\activate

:: 4. Install/Update dependencies (Silent)
echo [SYSTEM] Checking dependencies...
pip install -r requirements.txt > nul 2>&1

:: 5. Launch
echo [SYSTEM] Starting application...
start "" "http://127.0.0.1:5000"
python app.py
