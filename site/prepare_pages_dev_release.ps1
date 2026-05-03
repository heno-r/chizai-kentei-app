param(
  [string]$PagesUrl = "https://shiken-junbishitsu-chizai3.pages.dev",

  [string]$PremiumSetId = "grade3_premium_combined_160",
  [string]$PlanCode = "grade3_premium",
  [string]$R2BucketName = "chizai-kentei-premium-content"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir "..")
$siteDir = $scriptDir
$buildDir = Join-Path $siteDir "build"
$artifactsDir = Join-Path $repoRoot "content_admin\deploy_artifacts\premium-questions"
$artifactPath = Join-Path $artifactsDir "$PremiumSetId.json"
$instructionsPath = Join-Path $repoRoot "docs\pages_dev_release_next_steps.txt"

$bundledPython = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
$siteTsc = Join-Path $siteDir "node_modules\.bin\tsc.cmd"
$quizTsc = Join-Path $repoRoot "quiz_app\node_modules\.bin\tsc.cmd"

function Invoke-TscBuild {
  if (Test-Path $siteTsc) {
    & $siteTsc -p (Join-Path $siteDir "tsconfig.json")
    return
  }

  if (Test-Path $quizTsc) {
    & $quizTsc -p (Join-Path $siteDir "tsconfig.json")
    return
  }

  throw "TypeScript compiler was not found."
}

function Copy-BuildOutput {
  $copyPairs = @(
    @{ Source = "app\account-status.js"; Target = "app\account-status.js" }
    @{ Source = "app\api-client.js"; Target = "app\api-client.js" }
    @{ Source = "app\app.js"; Target = "app\app.js" }
    @{ Source = "app\auth-client.js"; Target = "app\auth-client.js" }
    @{ Source = "assets\diagnosis.js"; Target = "assets\diagnosis.js" }
    @{ Source = "assets\landing-page.js"; Target = "assets\landing-page.js" }
    @{ Source = "assets\runtime-config.js"; Target = "assets\runtime-config.js" }
    @{ Source = "auth\login-page.js"; Target = "login\login-page.js" }
    @{ Source = "contact\contact-page.js"; Target = "contact\contact-page.js" }
    @{ Source = "premium\premium-page.js"; Target = "premium\premium-page.js" }
    @{ Source = "premium\purchase-ready-page.js"; Target = "premium\purchase-ready-page.js" }
  )

  foreach ($pair in $copyPairs) {
    $sourcePath = Join-Path $buildDir $pair.Source
    $targetPath = Join-Path $siteDir $pair.Target
    if (Test-Path $sourcePath) {
      Copy-Item $sourcePath $targetPath -Force
    }
  }
}

function Export-PremiumPayload {
  if (-not (Test-Path $bundledPython)) {
    throw "Bundled Python runtime was not found."
  }

  & $bundledPython (Join-Path $repoRoot "content_admin\export_premium_question_payload.py") `
    --set-id $PremiumSetId `
    --plan-code $PlanCode `
    --output $artifactPath
}

function Write-NextSteps {
  $lines = @(
    "Pages release helper finished.",
    "",
    "Pages URL:",
    $PagesUrl,
    "",
    "Premium payload file:",
    $artifactPath,
    "",
    "Next steps:",
    "1. In Cloudflare Worker variables, set PUBLIC_SITE_URL to:",
    "   $PagesUrl",
    "",
    "2. Upload the premium payload to R2:",
    "   cd `"$repoRoot\secure_api_worker`"",
    "   npx wrangler r2 object put $R2BucketName/premium-questions/$PremiumSetId.json --file `"..\content_admin\deploy_artifacts\premium-questions\$PremiumSetId.json`"",
    "",
    "3. Redeploy the Worker:",
    "   cd `"$repoRoot\secure_api_worker`"",
    "   npx wrangler deploy",
    "",
    "4. In Supabase Authentication > URL Configuration, add:",
    "   $PagesUrl/",
    "   $PagesUrl/login/",
    "   $PagesUrl/premium/ready/",
    "   $PagesUrl/app/",
    "",
    "5. Open the Pages site and verify:",
    "   $PagesUrl/",
    "   $PagesUrl/app/",
    "   $PagesUrl/login/",
    "   $PagesUrl/premium/ready/"
  )

  Set-Content -Path $instructionsPath -Value $lines -Encoding UTF8
}

Set-Location $repoRoot

Invoke-TscBuild
Copy-BuildOutput
Export-PremiumPayload
Write-NextSteps

Write-Host ""
Write-Host "Prepared Pages release assets."
Write-Host "Pages URL: $PagesUrl"
Write-Host "Premium payload: $artifactPath"
Write-Host "Next steps file: $instructionsPath"
