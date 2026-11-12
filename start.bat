@echo off
chcp 65001 >nul
title Hongzhu Space
color 0B
echo =========================================
echo      Hongzhu Space - Backend Launcher
echo =========================================
echo.
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found.
    pause
    exit /b
)
echo Starting server...
node server.js
pause
