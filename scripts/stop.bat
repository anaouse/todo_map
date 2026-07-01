@echo off
setlocal

echo Stopping TodoMap services...

for /f %%a in (
    'powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort 11134 -State Listen -ErrorAction SilentlyContinue).OwningProcess"'
) do (
    echo Stopping backend PID %%a
    taskkill /F /T /PID %%a
)

for /f %%a in (
    'powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue).OwningProcess"'
) do (
    echo Stopping frontend PID %%a
    taskkill /F /T /PID %%a
)

echo Done.
if not "%1"=="/nopause" pause
