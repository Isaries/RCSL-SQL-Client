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
    echo [SYSTEM] Creating virtual environment (this may take a while)...
    python -m venv venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b
    )
)

:: 3. Activate virtual environment
call venv\Scripts\activate

:: 4. Install/Update dependencies
echo [SYSTEM] Checking and installing dependencies...
pip install -r requirements.txt > nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies. Please check your internet connection.
    pause
    exit /b
)

:: 5. Check .env configuration
if not exist ".env" (
    if exist ".env.example" (
        echo [SYSTEM] First run detected. Creating .env file...
        copy .env.example .env > nul
        echo.
        echo [NOTICE] .env file created.
        echo [NOTICE] Please open .env with Notepad and enter your RCSL credentials!
        echo.
        pause
    ) else (
        echo [ERROR] .env.example not found.
    )
)

:: 6. Launch Browser and Application
echo [SYSTEM] Starting application...
echo [TIP] Do not close this window, or the website will stop working.
echo.

start "" "http://127.0.0.1:5000"
python app.py

pause
