$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$source = (Resolve-Path (Join-Path $root "twitch-extension\build")).Path
$artifacts = Join-Path $root "artifacts"
$target = Join-Path $artifacts "murmur-twitch-extension.zip"
if (-not $source.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Extension package source is outside the project directory."
}
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
Compress-Archive -Path (Join-Path $source "*") -DestinationPath $target -Force
Write-Output "Created $target"
