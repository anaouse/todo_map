@echo off
chcp 65001 >nul
echo 正在停止 TodoMap 服务...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":11134.*LISTENING"') do (
    echo 停止端口 11134 (PID: %%a)
    taskkill /f /pid %%a 2>nul
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING"') do (
    echo 停止端口 3000 (PID: %%a)
    taskkill /f /pid %%a 2>nul
)

echo 已停止。
pause
