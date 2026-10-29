@echo off
rem Installs dependencies, creates a local .env if there is none, and sets up the database.
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required. Install it from https://nodejs.org and run this file again.
  exit /b 1
)

if not exist .env (
  copy /y .env.example .env >nul
  echo Created .env from .env.example - open it and paste your own GEMINI_API_KEY to switch the AI on.
)

call npm install
if errorlevel 1 exit /b 1

call npm run setup
if errorlevel 1 exit /b 1

echo.
echo Build finished. Start the app with run.bat
endlocal
