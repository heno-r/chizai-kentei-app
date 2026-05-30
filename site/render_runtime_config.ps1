param(
  [ValidateSet("production", "staging")]
  [string]$EnvironmentName = "production",

  [string]$ConfigPath
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$siteDir = $scriptDir
$defaultConfigPath = Join-Path $siteDir "config\runtime-config.$EnvironmentName.json"
$resolvedConfigPath = if ($ConfigPath) { $ConfigPath } else { $defaultConfigPath }

if (-not (Test-Path $resolvedConfigPath)) {
  throw "Runtime config file was not found: $resolvedConfigPath"
}

$rawConfig = Get-Content -Path $resolvedConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
$runtimeConfig = $rawConfig.runtimeConfig
if (-not $runtimeConfig) {
  throw "runtimeConfig was not found in $resolvedConfigPath"
}

$runtimeJson = $runtimeConfig | ConvertTo-Json -Depth 20
$output = @(
  "// @ts-nocheck"
  "window.APP_RUNTIME_CONFIG = Object.freeze($runtimeJson);"
) -join "`r`n"

$targets = @(
  (Join-Path $siteDir "build\assets\runtime-config.js"),
  (Join-Path $siteDir "assets\runtime-config.js")
)

foreach ($target in $targets) {
  $targetDir = Split-Path -Parent $target
  if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
  }
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($target, $output, $utf8NoBom)
}

Write-Host "Rendered runtime-config for $EnvironmentName"
Write-Host "Source: $resolvedConfigPath"
