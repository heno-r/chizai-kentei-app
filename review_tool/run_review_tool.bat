@echo off
setlocal

cd /d "%~dp0"

where uv >nul 2>nul
if %errorlevel%==0 (
  call uv run python review_gui.py
  goto :end
)

set "BUNDLED_PYTHON=C:\Users\henoh\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

if exist "%BUNDLED_PYTHON%" (
  echo uv command was not found. Falling back to bundled Python.
  "%BUNDLED_PYTHON%" review_gui.py
  goto :end
)

echo Failed to start the review tool.
echo Neither uv nor bundled Python was available.
pause

:end
endlocal
