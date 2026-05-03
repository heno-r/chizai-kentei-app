@echo off
setlocal

cd /d "%~dp0"

set "TSC_CMD=%~dp0node_modules\.bin\tsc.cmd"

if not exist "%TSC_CMD%" (
  echo TypeScript compiler was not found in node_modules.
  pause
  goto :end
)

call "%TSC_CMD%" -p tsconfig.json
if errorlevel 1 (
  echo Build failed.
  pause
  goto :end
)

echo Build completed.

:end
endlocal
