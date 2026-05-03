@echo off
setlocal

cd /d "%~dp0"

set "APP_PORT=8765"
set "DEFAULT_SET_ID=grade3_mixed_priority_50"
set "APP_URL=http://127.0.0.1:%APP_PORT%/?v=20260429-db&set_id=%DEFAULT_SET_ID%"
set "TSC_CMD=%~dp0node_modules\.bin\tsc.cmd"
set "SERVER_SCRIPT=%~dp0serve_quiz_app.ps1"

if exist "%TSC_CMD%" (
  call "%TSC_CMD%" -p tsconfig.json
  if errorlevel 1 (
    echo TypeScript build failed.
    pause
    goto :end
  )
)

start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%SERVER_SCRIPT%" -Port %APP_PORT% -SetId %DEFAULT_SET_ID%

powershell -NoProfile -Command ^
  "$ok=$false; 1..40 | ForEach-Object { try { Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:%APP_PORT%/api/public/catalog' | Out-Null; $ok=$true; break } catch { Start-Sleep -Milliseconds 500 } }; if (-not $ok) { exit 1 }"

if errorlevel 1 (
  echo Failed to start the quiz app server.
  echo The local API did not become ready in time.
  pause
  goto :end
)

start "" "%APP_URL%"

:end
endlocal
