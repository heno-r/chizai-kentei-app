param(
  [int]$Port = 8780,
  [string]$DatasetKey = "grade3_mixed_priority_50",
  [string]$SupabaseProjectUrl = "https://vpvqxgdoqprhzbftfryv.supabase.co"
)

$ErrorActionPreference = "Stop"

$siteDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $siteDir "..")
$workspacePython = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
$venvPython = Join-Path $repoRoot "content_admin\.venv\Scripts\python.exe"

Set-Location $repoRoot

if (Test-Path $workspacePython) {
  & $workspacePython .\content_admin\publish_approved_questions.py --dataset-key $DatasetKey | Out-Null
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
  & $workspacePython .\content_admin\local_api_server.py --port $Port --static-root .\site --supabase-project-url $SupabaseProjectUrl
  exit $LASTEXITCODE
}

if (Test-Path $venvPython) {
  & $venvPython .\content_admin\publish_approved_questions.py --dataset-key $DatasetKey | Out-Null
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
  & $venvPython .\content_admin\local_api_server.py --port $Port --static-root .\site --supabase-project-url $SupabaseProjectUrl
  exit $LASTEXITCODE
}

if (Get-Command uv -ErrorAction SilentlyContinue) {
  uv run python .\content_admin\publish_approved_questions.py --dataset-key $DatasetKey | Out-Null
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
  uv run python .\content_admin\local_api_server.py --port $Port --static-root .\site --supabase-project-url $SupabaseProjectUrl
  exit $LASTEXITCODE
}

throw "No usable Python runtime was found for site serving."
