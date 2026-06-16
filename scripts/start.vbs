Option Explicit

Dim WshShell, fso, strScriptDir, strProjectDir
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get directories: scripts/ -> project root
strScriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
strProjectDir = fso.GetParentFolderName(strScriptDir)

' ── Backend (FastAPI on port 11134) ─────────────────────────────────────
WshShell.Run _
    "cmd /c cd /d """ & strProjectDir & "\backend"" && uv run uvicorn main:app --host 0.0.0.0 --port 11134", _
    0, False

WScript.Sleep 1500

' ── Frontend build + Vite preview on port 3000 ──────────────────────────
WshShell.Run _
    "cmd /c cd /d """ & strProjectDir & """ && npm run build && npx vite preview --port 3000 --strictPort", _
    0, False

MsgBox "Backend:  http://localhost:11134" & vbCrLf & _
       "Frontend: http://localhost:3000" & vbCrLf & vbCrLf & _
       "请在任务管理器中结束 uvicorn / node 进程来停止服务。", _
       vbInformation, "TodoMap 已启动"
