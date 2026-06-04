param(
  [ValidateSet("production", "staging")]
  [string]$EnvironmentName = "production",

  [string]$ConfigPath,
  [string]$OverrideConfigPath
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$siteDir = $scriptDir
$defaultConfigPath = Join-Path $siteDir "config\runtime-config.$EnvironmentName.json"
$defaultOverrideConfigPath = Join-Path $siteDir "config\runtime-config.$EnvironmentName.local.json"
$resolvedConfigPath = if ($ConfigPath) { $ConfigPath } else { $defaultConfigPath }
$resolvedOverrideConfigPath = if ($OverrideConfigPath) { $OverrideConfigPath } else { $defaultOverrideConfigPath }

if (-not (Test-Path $resolvedConfigPath)) {
  throw "Runtime config file was not found: $resolvedConfigPath"
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

$rawConfig = Get-Content -Path $resolvedConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
$overrideConfig = $null
if (Test-Path $resolvedOverrideConfigPath) {
  $overrideConfig = Get-Content -Path $resolvedOverrideConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
}

$mergedConfig = Merge-ConfigObjects -BaseConfig $rawConfig -OverrideConfig $overrideConfig
$runtimeConfig = $mergedConfig.runtimeConfig
if (-not $runtimeConfig) {
  throw "runtimeConfig was not found in $resolvedConfigPath"
}

$supportEmail = [string]$runtimeConfig.supportEmail
if (-not [string]::IsNullOrWhiteSpace($supportEmail) -and $supportEmail -like "*support@example.com*") {
  $runtimeConfig.supportEmail = ""
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
if ($overrideConfig) {
  Write-Host "Override: $resolvedOverrideConfigPath"
}
