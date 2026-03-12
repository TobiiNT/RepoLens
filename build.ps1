# RepoLens — Chrome Extension Build Script
# Usage: .\build.ps1
# Output: repolens-<version>.zip  (ready for Chrome Web Store upload)

$ErrorActionPreference = "Stop"

# ── Read version from manifest ────────────────────────────────────────────────
$manifest = Get-Content "manifest.json" | ConvertFrom-Json
$version  = $manifest.version
$zipName  = "repolens-$version.zip"

# ── Files to include in the package ──────────────────────────────────────────
$include = @(
    "manifest.json",
    "content.js",
    "popup.js",
    "popup.html",
    "styles.css",
    "icons\icon16.png",
    "icons\icon48.png",
    "icons\icon128.png"
)

# ── Clean previous build ──────────────────────────────────────────────────────
if (Test-Path $zipName) {
    Remove-Item $zipName -Force
    Write-Host "Removed old $zipName"
}

# ── Create zip ────────────────────────────────────────────────────────────────
$tempDir = New-Item -ItemType Directory -Path "$env:TEMP\repolens-build-$version" -Force

try {
    foreach ($file in $include) {
        $dest = Join-Path $tempDir (Split-Path $file -Parent)
        if ($dest -ne $tempDir.FullName) {
            New-Item -ItemType Directory -Path $dest -Force | Out-Null
        }
        Copy-Item $file (Join-Path $tempDir $file) -Force
    }

    Compress-Archive -Path "$($tempDir.FullName)\*" -DestinationPath $zipName -CompressionLevel Optimal
    Write-Host ""
    Write-Host "Built: $zipName" -ForegroundColor Green
    Write-Host "Size:  $([math]::Round((Get-Item $zipName).Length / 1KB, 1)) KB"
    Write-Host ""
    Write-Host "Upload at: https://chrome.google.com/webstore/devconsole"
} finally {
    Remove-Item $tempDir -Recurse -Force
}
