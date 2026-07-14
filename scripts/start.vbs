Option Explicit

Dim WshShell, fso, strScriptDir, strProjectDir
Dim strMode
Dim backendAlreadyRunning, frontendAlreadyRunning

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

Function IsPortListening(port)
    Dim exec, output
    Set exec = WshShell.Exec("powershell -NoProfile -Command ""if (Get-NetTCPConnection -LocalPort " & port & " -State Listen -ErrorAction SilentlyContinue) { '1' }""")
    output = Trim(exec.StdOut.ReadAll)
    IsPortListening = (output = "1")
End Function

' ── Backend (FastAPI on port 11134) ─────────────────────────────────────
If strMode = "both" Or strMode = "backend" Or strMode = "be" Or strMode = "back" Then
    backendAlreadyRunning = IsPortListening(11134)
    If Not backendAlreadyRunning Then
        WshShell.Run _
            "cmd /c cd /d """ & strProjectDir & "\backend"" && uv run uvicorn main:app --host 0.0.0.0 --port 11134", _
            0, False
        WScript.Sleep 1500
    End If
End If

' ── Frontend build + Vite preview on port 3000 ──────────────────────────
If strMode = "both" Or strMode = "frontend" Or strMode = "fe" Or strMode = "front" Then
    frontendAlreadyRunning = IsPortListening(3000)
    If Not frontendAlreadyRunning Then
        WshShell.Run _
            "cmd /c cd /d """ & strProjectDir & """ && npm run build && npx vite preview --port 3000 --strictPort", _
            0, False
    End If
End If

' ── Build message ──────────────────────────────────────────────────────
Dim msg
msg = ""
If strMode = "both" Or strMode = "backend" Or strMode = "be" Or strMode = "back" Then
    If backendAlreadyRunning Then
        msg = msg & "Backend:  http://localhost:11134 (already running)" & vbCrLf
    Else
        msg = msg & "Backend:  http://localhost:11134" & vbCrLf
    End If
End If
If strMode = "both" Or strMode = "frontend" Or strMode = "fe" Or strMode = "front" Then
    If frontendAlreadyRunning Then
        msg = msg & "Frontend: http://localhost:3000 (already running)" & vbCrLf
    Else
        msg = msg & "Frontend: http://localhost:3000" & vbCrLf
    End If
End If
msg = msg & vbCrLf & "请运行 scripts\stop.bat 来停止服务。"

MsgBox msg, vbInformation, "TodoMap 已启动"