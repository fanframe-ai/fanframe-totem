param(
  [string]$Version
)

$ErrorActionPreference = "Stop"

if (-not $Version) {
  $packageJson = Get-Content -LiteralPath "package.json" -Raw | ConvertFrom-Json
  $Version = [string]$packageJson.version
}

$required = @(
  "release/FanFrame Kiosk Setup $Version.exe",
  "release/FanFrame Kiosk Setup $Version.exe.blockmap",
  "release/FanFrame Kiosk $Version.exe",
  "release/FanFrame-Kiosk-Setup-latest.exe",
  "release/FanFrame-Kiosk-Setup-$Version.exe",
  "release/FanFrame-Kiosk-Setup-$Version.exe.blockmap",
  "release/latest.yml"
)

$missing = @()
foreach ($file in $required) {
  if (-not (Test-Path -LiteralPath $file)) {
    $missing += $file
  }
}

if ($missing.Count -gt 0) {
  throw "Missing release files: $($missing -join ', ')"
}

$latest = Get-Content -LiteralPath "release/latest.yml" -Raw
if ($latest -notmatch [regex]::Escape($Version)) {
  throw "release/latest.yml does not reference version $Version."
}

Write-Host "Release files verified for $Version." -ForegroundColor Green
