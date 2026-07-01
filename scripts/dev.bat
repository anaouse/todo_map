@echo off
echo Stopping any existing deploy services...
call "%~dp0stop.bat" /nopause
echo.
set ROOT=%~dp0..
echo Starting Frontend (npm run dev)...
start "Frontend Dev" powershell -NoExit -Command "cd '%ROOT%'; npm run dev"
echo Starting Backend (uvicorn)...
start "Backend Dev" powershell -NoExit -Command "cd '%ROOT%\backend'; uv run uvicorn main:app --host 0.0.0.0 --port 11134 --reload"
echo Both started.
exit
