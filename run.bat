@echo off
rem Starts Mochi Kitchen (http://localhost:3000 unless PORT is set in .env).
setlocal
cd /d "%~dp0"
if not exist node_modules (
  echo Dependencies are missing - running build.bat first...
  call build.bat
  if errorlevel 1 exit /b 1
)
node src/server.js
endlocal
