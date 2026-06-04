param(
  [string]$RepoRoot = (Get-Location).Path,
  [ValidateSet("staging", "production")]
  [string]$EnvironmentName = "staging"
)

$ErrorActionPreference = "Stop"

function Add-Issue {
  param(
    [System.Collections.Generic.List[string]]$List,
    [string]$Message
  )
  $List.Add($Message) | Out-Null
}

function Read-JsonFile {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "File not found: $Path"
  }
  $raw = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
  return $raw | ConvertFrom-Json
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

function Is-PlaceholderValue {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $true
  }
  return $Value -match "replace[-_]?staging|replace[-_]?me|example\.com|your[-_]?staging|your[-_]?project|your[-_]?staging[-_]?site"
}

function Get-ScopedTomlBlock {
  param(
    [string]$TomlText,
    [string]$EnvironmentName,
    [ValidateSet("vars", "d1", "r2")]
    [string]$Section
  )

  if ($EnvironmentName -eq "production") {
    switch ($Section) {
      "vars" {
        if ($TomlText -match '(?s)\[vars\](.+?)(\[\[d1_databases\]\]|\[env\.|$)') { $Matches[1] } else { "" }
      }
      "d1" {
        if ($TomlText -match '(?s)\[\[d1_databases\]\](.+?)(\[\[r2_buckets\]\]|\[env\.|$)') { $Matches[1] } else { "" }
      }
      "r2" {
        if ($TomlText -match '(?s)\[\[r2_buckets\]\](.+?)(\[env\.|$)') { $Matches[1] } else { "" }
      }
    }
    return
  }

  $stagingBlock = ""
  if ($TomlText -match '(?s)\[env\.staging\](.+)$') {
    $stagingBlock = $Matches[1]
  }

  switch ($Section) {
    "vars" { $stagingBlock }
    "d1" {
      if ($stagingBlock -match '(?s)\[\[env\.staging\.d1_databases\]\](.+?)(\[\[env\.staging\.r2_buckets\]\]|$)') { $Matches[1] } else { "" }
    }
    "r2" {
      if ($stagingBlock -match '(?s)\[\[env\.staging\.r2_buckets\]\](.+)$') { $Matches[1] } else { "" }
    }
  }
  return
}

function Test-TomlValue {
  param(
    [System.Collections.Generic.List[string]]$Issues,
    [string]$TomlText,
    [string]$EnvironmentName,
    [ValidateSet("vars", "d1", "r2")]
    [string]$Section,
    [string]$Label,
    [string]$Pattern
  )

  $targetText = Get-ScopedTomlBlock -TomlText $TomlText -EnvironmentName $EnvironmentName -Section $Section
  if ($targetText -match $Pattern) {
    if (Is-PlaceholderValue $Matches[1]) {
      Add-Issue -List $Issues -Message "secure_api_worker/wrangler.toml: $Label"
    }
    return
  }

  Add-Issue -List $Issues -Message "secure_api_worker/wrangler.toml: $Label not found"
}

$issues = New-Object 'System.Collections.Generic.List[string]'

$runtimeConfigPath = Join-Path $RepoRoot "site\config\runtime-config.$EnvironmentName.json"
$runtimeOverrideConfigPath = Join-Path $RepoRoot "site\config\runtime-config.$EnvironmentName.local.json"
$workerTomlPath = Join-Path $RepoRoot "secure_api_worker\wrangler.toml"

$siteConfig = Read-JsonFile -Path $runtimeConfigPath
$overrideConfig = $null
if (Test-Path -LiteralPath $runtimeOverrideConfigPath) {
  $overrideConfig = Read-JsonFile -Path $runtimeOverrideConfigPath
}
$siteConfig = Merge-ConfigObjects -BaseConfig $siteConfig -OverrideConfig $overrideConfig
$runtimeConfig = $siteConfig.runtimeConfig

if (Is-PlaceholderValue([string]$siteConfig.pagesUrl)) {
  Add-Issue -List $issues -Message "site/config/runtime-config.$EnvironmentName.json: pagesUrl"
}

$runtimeChecks = @(
  @{ Name = "secureApiBaseUrl"; Value = [string]$runtimeConfig.secureApiBaseUrl },
  @{ Name = "supabaseUrl"; Value = [string]$runtimeConfig.supabaseUrl },
  @{ Name = "supabasePublishableKey"; Value = [string]$runtimeConfig.supabasePublishableKey },
  @{ Name = "supportEmail"; Value = [string]$runtimeConfig.supportEmail }
)

if ($EnvironmentName -eq "production") {
  $runtimeChecks += @(
    @{ Name = "stripePublishableKey"; Value = [string]$runtimeConfig.stripePublishableKey },
    @{ Name = "stripePriceId"; Value = [string]$runtimeConfig.stripePriceId }
  )
}

foreach ($check in $runtimeChecks) {
  if (Is-PlaceholderValue $check.Value) {
    Add-Issue -List $issues -Message "site/config/runtime-config.$EnvironmentName.json: runtimeConfig.$($check.Name)"
  }
}

if (-not (Test-Path -LiteralPath $workerTomlPath)) {
  Add-Issue -List $issues -Message "secure_api_worker/wrangler.toml is missing"
} else {
  $workerToml = Get-Content -LiteralPath $workerTomlPath -Raw

  if ($EnvironmentName -eq "production") {
    Test-TomlValue -Issues $issues -TomlText $workerToml -EnvironmentName $EnvironmentName -Section "vars" -Label "[vars].SUPABASE_PROJECT_URL" -Pattern 'SUPABASE_PROJECT_URL = "([^"]+)"'
    Test-TomlValue -Issues $issues -TomlText $workerToml -EnvironmentName $EnvironmentName -Section "vars" -Label "[vars].SUPABASE_JWKS_URL" -Pattern 'SUPABASE_JWKS_URL = "([^"]+)"'
    Test-TomlValue -Issues $issues -TomlText $workerToml -EnvironmentName $EnvironmentName -Section "vars" -Label "[vars].PUBLIC_SITE_URL" -Pattern 'PUBLIC_SITE_URL = "([^"]+)"'
    Test-TomlValue -Issues $issues -TomlText $workerToml -EnvironmentName $EnvironmentName -Section "d1" -Label "[[d1_databases]].database_name" -Pattern 'database_name = "([^"]+)"'
    Test-TomlValue -Issues $issues -TomlText $workerToml -EnvironmentName $EnvironmentName -Section "d1" -Label "[[d1_databases]].database_id" -Pattern 'database_id = "([^"]+)"'
    Test-TomlValue -Issues $issues -TomlText $workerToml -EnvironmentName $EnvironmentName -Section "r2" -Label "[[r2_buckets]].bucket_name" -Pattern 'bucket_name = "([^"]+)"'
  } else {
    Test-TomlValue -Issues $issues -TomlText $workerToml -EnvironmentName $EnvironmentName -Section "vars" -Label "[env.staging.vars].SUPABASE_PROJECT_URL" -Pattern 'SUPABASE_PROJECT_URL = "([^"]+)"'
    Test-TomlValue -Issues $issues -TomlText $workerToml -EnvironmentName $EnvironmentName -Section "vars" -Label "[env.staging.vars].SUPABASE_JWKS_URL" -Pattern 'SUPABASE_JWKS_URL = "([^"]+)"'
    Test-TomlValue -Issues $issues -TomlText $workerToml -EnvironmentName $EnvironmentName -Section "vars" -Label "[env.staging.vars].PUBLIC_SITE_URL" -Pattern 'PUBLIC_SITE_URL = "([^"]+)"'
    Test-TomlValue -Issues $issues -TomlText $workerToml -EnvironmentName $EnvironmentName -Section "d1" -Label "[[env.staging.d1_databases]].database_name" -Pattern 'database_name = "([^"]+)"'
    Test-TomlValue -Issues $issues -TomlText $workerToml -EnvironmentName $EnvironmentName -Section "d1" -Label "[[env.staging.d1_databases]].database_id" -Pattern 'database_id = "([^"]+)"'
    Test-TomlValue -Issues $issues -TomlText $workerToml -EnvironmentName $EnvironmentName -Section "r2" -Label "[[env.staging.r2_buckets]].bucket_name" -Pattern 'bucket_name = "([^"]+)"'
  }
}

if ($issues.Count -eq 0) {
  Write-Output "$EnvironmentName setup looks ready"
  exit 0
}

Write-Output "$EnvironmentName setup is incomplete"
Write-Output ""
Write-Output "missing or placeholder values:"
$issues | ForEach-Object { Write-Output " - $_" }
exit 1
