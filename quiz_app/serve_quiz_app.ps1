param(
  [int]$Port = 8765,
  [string]$SetId = "grade3_mixed_priority_50"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$contentAdminDir = Join-Path $scriptDir "..\content_admin"
$contentDbPath = Join-Path $contentAdminDir "data\content.db"
$bundledPython = "C:\Users\henoh\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

Set-Location $contentAdminDir

$uvCommand = Get-Command uv -ErrorAction SilentlyContinue
if ($uvCommand) {
  uv sync
  uv run python publish_approved_questions.py --dataset-key $SetId --db-path $contentDbPath --published-by run_quiz_app
  uv run python local_api_server.py --port $Port --db-path $contentDbPath --static-root "..\quiz_app"
  exit $LASTEXITCODE
}

if (Test-Path $bundledPython) {
  & $bundledPython publish_approved_questions.py --dataset-key $SetId --db-path $contentDbPath --published-by run_quiz_app
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
  & $bundledPython local_api_server.py --port $Port --db-path $contentDbPath --static-root "..\quiz_app"
  exit $LASTEXITCODE
}

throw "Neither uv nor bundled Python was available."
