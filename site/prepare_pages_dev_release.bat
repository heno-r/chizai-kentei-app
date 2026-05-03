@echo off
setlocal

cd /d "%~dp0"

set "PAGES_URL=%~1"
if "%PAGES_URL%"=="" set "PAGES_URL=https://shiken-junbishitsu-chizai3.pages.dev"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0prepare_pages_dev_release.ps1" -PagesUrl "%PAGES_URL%"

endlocal
