@echo off
setlocal

set MODE=%1
set STOP_BACKEND=0
set STOP_FRONTEND=0

if "%MODE%"=="" (
    set STOP_BACKEND=1
    set STOP_FRONTEND=1
) else if /i "%MODE%"=="backend" (
    set STOP_BACKEND=1
) else if /i "%MODE%"=="frontend" (
    set STOP_FRONTEND=1
) else if /i "%MODE%"=="/nopause" (
    set STOP_BACKEND=1
    set STOP_FRONTEND=1
) else (
    echo Usage: stop.bat [frontend^|backend]
    echo   ^(no arg^)  : stop both frontend and backend
    echo   frontend   : stop frontend only ^(port 3000^)
    echo   backend    : stop backend only  ^(port 11134^)
    exit /b 1
)

echo Stopping TodoMap services...

if "%STOP_BACKEND%"=="1" (
    for /f %%a in ('powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort 11134 -State Listen -ErrorAction SilentlyContinue).OwningProcess"') do (
        echo Stopping backend PID %%a
        taskkill /F /T /PID %%a
    )
)

if "%STOP_FRONTEND%"=="1" (
    for /f %%a in ('powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue).OwningProcess"') do (
        echo Stopping frontend PID %%a
        taskkill /F /T /PID %%a
    )
)

echo Done.
if not "%MODE%"=="/nopause" pause
