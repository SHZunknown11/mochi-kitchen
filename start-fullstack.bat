@echo off
echo ========================================================
echo   Starting Mochi Kitchen Full-Stack (Node.js + Java)
echo ========================================================
start "Mochi Kitchen - Java Microservice" cmd /k "npm run java:start"
npm start
