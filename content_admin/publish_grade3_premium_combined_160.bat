@echo off
setlocal

cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0publish_grade3_premium_combined_160.ps1"

if errorlevel 1 (
  echo.
  echo プレミアム用問題セットのDB反映に失敗しました。
  pause
  goto :end
)

echo.
echo プレミアム用問題セットのDB反映が完了しました。
pause

:end
endlocal
