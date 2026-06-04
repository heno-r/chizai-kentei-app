param(
  [ValidateSet("production", "staging")]
  [string]$EnvironmentName = "production",

  [string]$PagesUrl = "",

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
$runtimeConfigPath = Join-Path $siteDir "config\runtime-config.$EnvironmentName.json"
$runtimeOverrideConfigPath = Join-Path $siteDir "config\runtime-config.$EnvironmentName.local.json"
$renderRuntimeConfigScript = Join-Path $siteDir "render_runtime_config.ps1"
$workerTomlPath = Join-Path $repoRoot "secure_api_worker\wrangler.toml"
$runtimeConfigObject = $null

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
    @{ Source = "assets\legal-page.js"; Target = "assets\legal-page.js" }
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

function Get-PagesUrlFromRuntimeConfig {
  if (-not (Test-Path $runtimeConfigPath)) {
    throw "Runtime config file was not found: $runtimeConfigPath"
  }

  function Merge-ConfigObjects {
    param(
      [object]$BaseConfig,
      [object]$OverrideConfig
    )

    if (-not $OverrideConfig) {
      return $BaseConfig
    }

    $merged = [ordered]@{}
    foreach ($property in $BaseConfig.PSObject.Properties) {
      if ($property.Name -eq "runtimeConfig") {
        continue
      }
      $merged[$property.Name] = $property.Value
    }

    foreach ($property in $OverrideConfig.PSObject.Properties) {
      if ($property.Name -eq "runtimeConfig") {
        continue
      }
      $merged[$property.Name] = $property.Value
    }

    $mergedRuntimeConfig = [ordered]@{}
    if ($BaseConfig.runtimeConfig) {
      foreach ($property in $BaseConfig.runtimeConfig.PSObject.Properties) {
        $mergedRuntimeConfig[$property.Name] = $property.Value
      }
    }
    if ($OverrideConfig.runtimeConfig) {
      foreach ($property in $OverrideConfig.runtimeConfig.PSObject.Properties) {
        $mergedRuntimeConfig[$property.Name] = $property.Value
      }
    }
    $merged["runtimeConfig"] = [pscustomobject]$mergedRuntimeConfig

    return [pscustomobject]$merged
  }

  $config = Get-Content -Path $runtimeConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
  if (Test-Path $runtimeOverrideConfigPath) {
    $overrideConfig = Get-Content -Path $runtimeOverrideConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $config = Merge-ConfigObjects -BaseConfig $config -OverrideConfig $overrideConfig
  }
  $script:runtimeConfigObject = $config.runtimeConfig
  $configuredPagesUrl = [string]$config.pagesUrl
  if ([string]::IsNullOrWhiteSpace($configuredPagesUrl)) {
    throw "pagesUrl is missing in $runtimeConfigPath"
  }
  return $configuredPagesUrl.TrimEnd("/")
}

function Get-ReleaseWarnings {
  if (-not $runtimeConfigObject) {
    return @()
  }

  $warnings = @()
  $purchaseEnabled = $runtimeConfigObject.purchaseEnabled -ne $false
  $checkoutProvider = [string]$runtimeConfigObject.checkoutProvider
  $supportEmail = [string]$runtimeConfigObject.supportEmail
  $secureApiBaseUrl = [string]$runtimeConfigObject.secureApiBaseUrl
  $pagesProject = [string]$runtimeConfigObject.cloudflarePagesProject
  $stripePublishableKey = [string]$runtimeConfigObject.stripePublishableKey
  $stripePriceId = [string]$runtimeConfigObject.stripePriceId
  $workerToml = if (Test-Path $workerTomlPath) { Get-Content -LiteralPath $workerTomlPath -Raw } else { "" }
  $workerVarsBlock = ""
  if (-not [string]::IsNullOrWhiteSpace($workerToml) -and ($workerToml -match '(?s)\[vars\](.+?)(\[\[d1_databases\]\]|\[env\.|$)')) {
    $workerVarsBlock = $Matches[1]
  }

  if ([string]::IsNullOrWhiteSpace($secureApiBaseUrl)) {
    $warnings += "secureApiBaseUrl is missing. Public pages cannot reach the secure API."
  }

  if ($purchaseEnabled -and ($checkoutProvider -eq "stripe")) {
    if ([string]::IsNullOrWhiteSpace($stripePublishableKey)) {
      $warnings += "stripePublishableKey is missing. Set the production value before enabling purchases."
    }
    if ([string]::IsNullOrWhiteSpace($stripePriceId)) {
      $warnings += "stripePriceId is missing. Set the production value before enabling purchases."
    }
  }

  if ([string]::IsNullOrWhiteSpace($supportEmail) -or $supportEmail -like "*support@example.com*") {
    $warnings += "supportEmail is still a placeholder. Replace it with the real support address."
  }

  if ($EnvironmentName -eq "production") {
    if ([string]::IsNullOrWhiteSpace($workerVarsBlock) -or ($workerVarsBlock -notmatch 'PUBLIC_SITE_URL = "([^"]+)"')) {
      $warnings += "Worker production PUBLIC_SITE_URL is missing. Add the Pages URL to secure_api_worker/wrangler.toml before redeploying."
    }
  }

  if ($EnvironmentName -eq "staging") {
    $stagingChecks = @(
      [string]$PagesUrl,
      $secureApiBaseUrl,
      [string]$runtimeConfigObject.supabaseUrl,
      [string]$runtimeConfigObject.supabasePublishableKey,
      $pagesProject
    )
    if ($stagingChecks | Where-Object { $_ -match "replace-" -or $_ -match "replace_" }) {
      $warnings += "Staging config still contains placeholder values. Fill in real Pages / Worker / Supabase values first."
    }

    if ([string]::IsNullOrWhiteSpace($workerToml) -or ($workerToml -match 'replace-staging-project|replace-staging-site|replace-staging-database|replace-staging-r2-bucket')) {
      $warnings += "Staging Worker config still contains placeholder values. Fill in env.staging vars, D1, and R2 settings first."
    }
  }

  return $warnings
}

function Render-RuntimeConfig {
  if (-not (Test-Path $renderRuntimeConfigScript)) {
    throw "Runtime config render script was not found."
  }

  & $renderRuntimeConfigScript -EnvironmentName $EnvironmentName
}

function Write-NextSteps {
  $warnings = Get-ReleaseWarnings
  $workerDeployCommand = if ($EnvironmentName -eq "staging") { "   npx wrangler deploy --env staging" } else { "   npx wrangler deploy" }
  $lines = @(
    "Pages release helper finished.",
    "",
    "Environment:",
    $EnvironmentName,
    "",
    "Pages URL:",
    $PagesUrl,
    "",
    "Premium payload file:",
    $artifactPath,
    "",
    "Next steps:",
    "0. Run the setup check for this environment:",
    "   cd `"$repoRoot`"",
    "   powershell -ExecutionPolicy Bypass -File `".\scripts\validate_staging_setup.ps1`" -EnvironmentName $EnvironmentName",
    "",
    "1. In Cloudflare Worker variables, set PUBLIC_SITE_URL to:",
    "   $PagesUrl",
    "",
    "2. Upload the premium payload to R2:",
    "   cd `"$repoRoot\secure_api_worker`"",
    "   npx wrangler r2 object put $R2BucketName/premium-questions/$PremiumSetId.json --file `"..\content_admin\deploy_artifacts\premium-questions\$PremiumSetId.json`"",
    "",
    "3. Redeploy the Worker:",
    "   cd `"$repoRoot\secure_api_worker`"",
    $workerDeployCommand,
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

  if ($warnings.Count -gt 0) {
    $lines += @(
      "",
      "Warnings:"
    )
    foreach ($warning in $warnings) {
      $lines += " - $warning"
    }
  }

  Set-Content -Path $instructionsPath -Value $lines -Encoding UTF8
}

Set-Location $repoRoot

if ([string]::IsNullOrWhiteSpace($PagesUrl)) {
  $PagesUrl = Get-PagesUrlFromRuntimeConfig
}

Invoke-TscBuild
Copy-BuildOutput
Render-RuntimeConfig
Export-PremiumPayload
Write-NextSteps
$releaseWarnings = Get-ReleaseWarnings

Write-Host ""
Write-Host "Prepared Pages release assets."
Write-Host "Environment: $EnvironmentName"
Write-Host "Pages URL: $PagesUrl"
Write-Host "Premium payload: $artifactPath"
Write-Host "Next steps file: $instructionsPath"
if ($releaseWarnings.Count -gt 0) {
  Write-Warning "Release warnings detected:"
  foreach ($warning in $releaseWarnings) {
    Write-Warning " - $warning"
  }
}
