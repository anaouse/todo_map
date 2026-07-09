@echo off
setlocal

set MODE=%1
set START_BACKEND=0
set START_FRONTEND=0

if "%MODE%"=="" (
    set START_BACKEND=1
    set START_FRONTEND=1
) else if /i "%MODE%"=="backend" (
    set START_BACKEND=1
) else if /i "%MODE%"=="frontend" (
    set START_FRONTEND=1
) else (
    echo Usage: dev.bat [frontend^|backend]
    echo   ^(no arg^)  : start both frontend and backend
    echo   frontend   : start frontend only ^(port 3000^)
    echo   backend    : start backend only  ^(port 11134^)
    exit /b 1
)

echo Stopping any existing services...
call "%~dp0stop.bat" %MODE%
echo.

set ROOT=%~dp0..

if "%START_BACKEND%"=="1" (
    echo Starting Backend ^(uvicorn^)...
    start "Backend Dev" powershell -NoExit -Command "cd '%ROOT%\backend'; uv run uvicorn main:app --host 0.0.0.0 --port 11134 --reload"
)

if "%START_FRONTEND%"=="1" (
    echo Starting Frontend ^(npm run dev^)...
    start "Frontend Dev" powershell -NoExit -Command "cd '%ROOT%'; npm run dev"
)

echo Done.
