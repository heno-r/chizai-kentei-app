@echo off
setlocal

cd /d "%~dp0"

set "APP_PORT=8765"
set "APP_URL=http://127.0.0.1:%APP_PORT%/?v=20260427-4"
set "BUNDLED_PYTHON=C:\Users\henoh\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

start "" "%APP_URL%"

where uv >nul 2>nul
if %errorlevel%==0 (
  call uv run python -m http.server %APP_PORT%
  goto :end
)

if exist "%BUNDLED_PYTHON%" (
  echo uv command was not found. Falling back to bundled Python.
  "%BUNDLED_PYTHON%" -m http.server %APP_PORT%
  goto :end
)

echo Failed to start the quiz app server.
echo Neither uv nor bundled Python was available.
pause

:end
endlocal
