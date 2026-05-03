param(
  [string]$PublishedBy = "local-dev",
  [string]$Notes = "grade3 premium combined publish"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
  throw "uv command not found. Please run this script in an environment where uv is available."
}

uv run python .\publish_approved_questions.py `
  --dataset-key grade3_premium_combined_160 `
  --published-by $PublishedBy `
  --notes $Notes
