param(
  [string]$OutputDir = ".\deploy_artifacts\premium-questions"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
  throw "uv コマンドが見つかりません。uv を使えるターミナルで再実行してください。"
}

$outputPath = Join-Path $OutputDir "grade3_premium_combined_160.json"

uv run python .\export_premium_question_payload.py `
  --set-id grade3_premium_combined_160 `
  --plan-code grade3_premium `
  --output $outputPath

Write-Host ""
Write-Host "R2 アップロード用 JSON を出力しました: $outputPath"
