@echo off
setlocal

cd /d "%~dp0"

set "SITE_ENV=%~1"
if "%SITE_ENV%"=="" set "SITE_ENV=production"

set "SITE_PORT=8780"
set "SITE_URL=http://127.0.0.1:%SITE_PORT%/"
set "TSC_CMD=%~dp0..\quiz_app\node_modules\.bin\tsc.cmd"
set "SERVER_SCRIPT=%~dp0serve_site.ps1"
set "RENDER_CONFIG_SCRIPT=%~dp0render_runtime_config.ps1"

if exist "%TSC_CMD%" (
  call "%TSC_CMD%" -p tsconfig.json
  if errorlevel 1 (
    echo TypeScript build failed.
    pause
    goto :end
  )
  copy /y "%~dp0build\app\account-status.js" "%~dp0app\account-status.js" >nul
  copy /y "%~dp0build\app\api-client.js" "%~dp0app\api-client.js" >nul
  copy /y "%~dp0build\app\app.js" "%~dp0app\app.js" >nul
  copy /y "%~dp0build\app\auth-client.js" "%~dp0app\auth-client.js" >nul
  copy /y "%~dp0build\assets\diagnosis.js" "%~dp0assets\diagnosis.js" >nul
  copy /y "%~dp0build\assets\landing-page.js" "%~dp0assets\landing-page.js" >nul
  copy /y "%~dp0build\auth\login-page.js" "%~dp0login\login-page.js" >nul
  copy /y "%~dp0build\contact\contact-page.js" "%~dp0contact\contact-page.js" >nul
  copy /y "%~dp0build\premium\premium-page.js" "%~dp0premium\premium-page.js" >nul
  copy /y "%~dp0build\premium\purchase-ready-page.js" "%~dp0premium\purchase-ready-page.js" >nul
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%RENDER_CONFIG_SCRIPT%" -EnvironmentName "%SITE_ENV%"
if errorlevel 1 (
  echo Failed to render runtime config for %SITE_ENV%.
  pause
  goto :end
)

start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%SERVER_SCRIPT%" -Port %SITE_PORT%

powershell -NoProfile -Command ^
  "$ok=$false; 1..40 | ForEach-Object { try { Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:%SITE_PORT%/api/public/catalog' | Out-Null; $ok=$true; break } catch { Start-Sleep -Milliseconds 500 } }; if (-not $ok) { exit 1 }"

if errorlevel 1 (
  echo Failed to start the public site server.
  echo The local API did not become ready in time.
  pause
  goto :end
)

start "" "%SITE_URL%"

:end
endlocal
