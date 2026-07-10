Option Explicit

Dim WshShell, fso, strScriptDir, strProjectDir
Dim strMode

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get directories: scripts/ -> project root
strScriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
strProjectDir = fso.GetParentFolderName(strScriptDir)

' Determine mode from argument (case-insensitive)
If WScript.Arguments.Count > 0 Then
    strMode = LCase(WScript.Arguments(0))
Else
    strMode = "both"
End If

' ── Backend (FastAPI on port 11134) ─────────────────────────────────────
If strMode = "both" Or strMode = "backend" Or strMode = "be" Or strMode = "back" Then
    WshShell.Run _
        "cmd /c cd /d """ & strProjectDir & "\backend"" && uv run uvicorn main:app --host 0.0.0.0 --port 11134", _
        0, False
    WScript.Sleep 1500
End If

' ── Frontend build + Vite preview on port 3000 ──────────────────────────
If strMode = "both" Or strMode = "frontend" Or strMode = "fe" Or strMode = "front" Then
    WshShell.Run _
        "cmd /c cd /d """ & strProjectDir & """ && npm run build && npx vite preview --port 3000 --strictPort", _
        0, False
End If

' ── Build message ──────────────────────────────────────────────────────
Dim msg
msg = ""
If strMode = "both" Or strMode = "backend" Or strMode = "be" Or strMode = "back" Then
    msg = msg & "Backend:  http://localhost:11134" & vbCrLf
End If
If strMode = "both" Or strMode = "frontend" Or strMode = "fe" Or strMode = "front" Then
    msg = msg & "Frontend: http://localhost:3000" & vbCrLf
End If
msg = msg & vbCrLf & "请在任务管理器中结束 uvicorn / node 进程来停止服务。"

MsgBox msg, vbInformation, "TodoMap 已启动"