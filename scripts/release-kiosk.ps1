param(
  [string]$Version,
  [switch]$Patch,
  [switch]$SkipChecks,
  [switch]$PublishGithub,
  [switch]$Push,
  [switch]$CommitVersion,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Run-Step {
  param(
    [string]$Title,
    [string]$Command
  )

  Write-Host ""
  Write-Host "==> $Title" -ForegroundColor Cyan
  Write-Host $Command -ForegroundColor DarkGray

  if ($DryRun) {
    return
  }

  Invoke-Expression $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Step failed: $Title"
  }
}

function Get-PackageVersion {
  $packageJson = Get-Content -LiteralPath "package.json" -Raw | ConvertFrom-Json
  return [string]$packageJson.version
}

function Get-NextPatchVersion {
  param([string]$CurrentVersion)

  $parts = $CurrentVersion.Split(".")
  if ($parts.Length -ne 3) {
    throw "Current version '$CurrentVersion' is not semver x.y.z."
  }

  return "$($parts[0]).$($parts[1]).$([int]$parts[2] + 1)"
}

function Get-GithubToken {
  $credInput = "protocol=https`nhost=github.com`n`n"
  $cred = $credInput | git credential fill
  $token = ($cred | Where-Object { $_ -like "password=*" } | ForEach-Object { $_.Substring(9) })
  if (-not $token) {
    throw "GitHub token not found in git credential helper."
  }
  return $token
}

function Stop-LocalReleaseApp {
  Write-Host ""
  Write-Host "==> Stop local release app if running" -ForegroundColor Cyan

  if ($DryRun) {
    Write-Host "Would stop FanFrame Kiosk processes running from release\\win-unpacked." -ForegroundColor DarkGray
    return
  }

  $releasePath = Join-Path (Get-Location) "release\win-unpacked"
  Get-Process -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Path -and
      $_.Path.StartsWith($releasePath, [System.StringComparison]::OrdinalIgnoreCase)
    } |
    Stop-Process -Force
}

function Publish-GithubRelease {
  param([string]$ReleaseVersion)

  $token = Get-GithubToken
  $headers = @{
    Authorization = "Bearer $token"
    Accept = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
  }

  $body = @{
    tag_name = "v$ReleaseVersion"
    target_commitish = "main"
    name = "FanFrame Kiosk v$ReleaseVersion"
    body = "Release operacional do FanFrame Kiosk v$ReleaseVersion."
    draft = $false
    prerelease = $false
  } | ConvertTo-Json -Compress

  $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
  try {
    $release = Invoke-RestMethod `
      -Method Post `
      -Uri "https://api.github.com/repos/fanframe-ai/fanframe-totem/releases" `
      -Headers $headers `
      -Body $bytes `
      -ContentType "application/json; charset=utf-8"
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 422) {
      $release = Invoke-RestMethod `
        -Method Get `
        -Uri "https://api.github.com/repos/fanframe-ai/fanframe-totem/releases/tags/v$ReleaseVersion" `
        -Headers $headers
    } else {
      throw
    }
  }

  $assets = @(
    "release/FanFrame Kiosk Setup $ReleaseVersion.exe",
    "release/FanFrame Kiosk Setup $ReleaseVersion.exe.blockmap",
    "release/FanFrame Kiosk $ReleaseVersion.exe",
    "release/FanFrame-Kiosk-Setup-latest.exe",
    "release/FanFrame-Kiosk-Setup-$ReleaseVersion.exe",
    "release/FanFrame-Kiosk-Setup-$ReleaseVersion.exe.blockmap",
    "release/latest.yml"
  )

  foreach ($asset in $assets) {
    $path = Resolve-Path $asset
    $name = [System.IO.Path]::GetFileName($path)
    foreach ($existing in @($release.assets | Where-Object { $_.name -eq $name })) {
      Invoke-RestMethod -Method Delete -Uri $existing.url -Headers $headers | Out-Null
    }

    $encodedName = [System.Uri]::EscapeDataString($name)
    Invoke-RestMethod `
      -Method Post `
      -Uri "https://uploads.github.com/repos/fanframe-ai/fanframe-totem/releases/$($release.id)/assets?name=$encodedName" `
      -Headers $headers `
      -ContentType "application/octet-stream" `
      -InFile $path | Out-Null

    Write-Host "uploaded $name"
  }

  Write-Host $release.html_url -ForegroundColor Green
}

if (-not (Test-Path -LiteralPath "package.json")) {
  throw "Run this script from the repository root."
}

if (-not $Version) {
  if ($Patch) {
    $Version = Get-NextPatchVersion -CurrentVersion (Get-PackageVersion)
  } else {
    throw "Pass -Version x.y.z or -Patch."
  }
}

if ($Version -notmatch "^\d+\.\d+\.\d+$") {
  throw "Version must use semver x.y.z. Received '$Version'."
}

$dirty = git status --porcelain
if ($dirty -and -not $DryRun) {
  throw "Working tree is dirty. Commit or stash changes before releasing."
}

Write-Host "FanFrame Kiosk release $Version" -ForegroundColor Green

Run-Step "Set package version" "npm version $Version --no-git-tag-version"

if (-not $SkipChecks) {
  Run-Step "Run tests" "npm test"
  Run-Step "Run lint" "npm run lint"
  Run-Step "Build admin" "npm --prefix apps/admin run build"
}

Stop-LocalReleaseApp
Run-Step "Build Windows installer" "npm run dist:win"
Run-Step "Create update aliases" "Copy-Item -LiteralPath 'release\FanFrame Kiosk Setup $Version.exe' -Destination 'release\FanFrame-Kiosk-Setup-latest.exe' -Force; Copy-Item -LiteralPath 'release\FanFrame Kiosk Setup $Version.exe' -Destination 'release\FanFrame-Kiosk-Setup-$Version.exe' -Force; Copy-Item -LiteralPath 'release\FanFrame Kiosk Setup $Version.exe.blockmap' -Destination 'release\FanFrame-Kiosk-Setup-$Version.exe.blockmap' -Force"

if ($CommitVersion) {
  Run-Step "Commit version bump" "git add package.json package-lock.json; git commit -m 'Release kiosk v$Version'"
}

if ($Push) {
  Run-Step "Push main" "git push origin main"
}

if ($PublishGithub) {
  if ($DryRun) {
    Write-Host "Would publish GitHub release v$Version"
  } else {
    Publish-GithubRelease -ReleaseVersion $Version
  }
}

Write-Host ""
Write-Host "Release script finished for $Version." -ForegroundColor Green
