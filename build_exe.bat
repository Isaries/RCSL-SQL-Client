@echo off
echo Building RCSL SQL Client EXE...

:: Ensure strict mode
setlocal

:: Check if PyInstaller is installed
pip show pyinstaller > nul 2>&1
if %errorlevel% neq 0 (
    echo Installing PyInstaller...
    pip install pyinstaller
)

:: Check if Pillow is installed (for icon conversion)
pip show Pillow > nul 2>&1
if %errorlevel% neq 0 (
    echo Installing Pillow...
    pip install Pillow
)

:: Clean previous build
if exist "dist" rmdir /s /q "dist"
if exist "build" rmdir /s /q "build"
if exist "RCSL-SQL-Client.spec" del "RCSL-SQL-Client.spec"

:: Build
:: --windowed: No console window
:: --onefile: Single exe
:: --add-data: Include static/templates
echo Packaging...
pyinstaller --noconfirm --onefile --windowed --name "RCSL-SQL-Client" ^
    --add-data "templates;templates" ^
    --add-data "static;static" ^
    --icon "static/favicon.png" ^
    app.py

echo.
echo Build Complete! 
echo The executable is located in the "dist" folder.
pause
