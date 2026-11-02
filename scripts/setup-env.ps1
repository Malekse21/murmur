$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$templatePath = Join-Path $root ".env.example"
$envPath = Join-Path $root ".env.local"
if (-not (Test-Path -LiteralPath $templatePath)) {
  throw "Could not find .env.example in the project directory."
}

$script:EnvValues = @{}
if (Test-Path -LiteralPath $envPath) {
  foreach ($line in Get-Content -LiteralPath $envPath) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
      $script:EnvValues[$matches[1]] = $matches[2]
    }
  }
}

function Read-EnvValue {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Label,
    [string]$Default = "",
    [switch]$Required
  )

  $current = [string]$script:EnvValues[$Name]
  $hasCurrent = -not [string]::IsNullOrWhiteSpace($current)
  if ($hasCurrent) {
    $hint = if ($Required) { "press Enter to keep saved value" } else { "press Enter to keep saved value, or type !clear to remove it" }
    $answer = Read-Host "$Label ($hint)"
    if ($answer.Trim() -eq "!clear" -and -not $Required) {
      $script:EnvValues[$Name] = ""
      return
    }
    if (-not [string]::IsNullOrWhiteSpace($answer)) {
      $script:EnvValues[$Name] = $answer.Trim()
    }
    return
  }

  while ($true) {
    $prompt = $Label
    if (-not [string]::IsNullOrWhiteSpace($Default)) {
      $prompt += " [default: $Default]"
    }
    if ($Required) {
      $prompt += " (required)"
    }

    $answer = Read-Host $prompt
    if (-not [string]::IsNullOrWhiteSpace($answer)) {
      $script:EnvValues[$Name] = $answer.Trim()
      return
    }
    if (-not [string]::IsNullOrWhiteSpace($Default)) {
      $script:EnvValues[$Name] = $Default
      return
    }
    if (-not $Required) {
      $script:EnvValues[$Name] = ""
      return
    }
    Write-Host "This value is required."
  }
}

function Read-SecretValue {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Label
  )

  $current = [string]$script:EnvValues[$Name]
  $hasCurrent = -not [string]::IsNullOrWhiteSpace($current)
  while ($true) {
    $prompt = if ($hasCurrent) { "$Label (press Enter to keep saved value)" } else { "$Label (required)" }
    $secureValue = Read-Host -Prompt $prompt -AsSecureString
    if ($secureValue.Length -eq 0) {
      if ($hasCurrent) { return }
      Write-Host "This value is required."
      continue
    }

    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
    try {
      $script:EnvValues[$Name] = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    } finally {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
    return
  }
}

function Read-ExtensionOwnerId {
  $current = [string]$script:EnvValues["TWITCH_EXTENSION_OWNER_ID"]
  $hasValidCurrent = $current -match '^\d+$'
  while ($true) {
    $prompt = if ($hasValidCurrent) {
      "Numeric Twitch user ID of the Extension owner (press Enter to keep saved value)"
    } else {
      "Numeric Twitch user ID of the Extension owner (required; do not enter the login name)"
    }
    $answer = Read-Host $prompt
    if ([string]::IsNullOrWhiteSpace($answer)) {
      if ($hasValidCurrent) { return }
      Write-Host "Enter the numeric user ID from Twitch's Get Users lookup."
      continue
    }

    $answer = $answer.Trim()
    if ($answer -match '^\d+$') {
      $script:EnvValues["TWITCH_EXTENSION_OWNER_ID"] = $answer
      return
    }
    Write-Host "That is not numeric. Use the Twitch account ID, not its login or display name."
  }
}

Write-Host "MurMur environment setup"
Write-Host "Paste values from Twitch, TypeSafe, and Groq. Secret prompts are hidden."
Write-Host ""

Read-EnvValue -Name "TWITCH_CLIENT_ID" -Label "Twitch OAuth app Client ID" -Required
Read-SecretValue -Name "TWITCH_CLIENT_SECRET" -Label "Twitch OAuth app Client Secret"
Read-EnvValue -Name "TWITCH_REDIRECT_URI" -Label "Twitch OAuth callback URL" -Default "http://localhost:3000/api/twitch/callback" -Required
Read-SecretValue -Name "GROQ_API_KEY" -Label "Groq API key"
Read-EnvValue -Name "GROQ_MODEL" -Label "Groq model" -Default "openai/gpt-oss-20b"
Read-SecretValue -Name "TYPESAFE_API_KEY" -Label "TypeSafe API key"

Read-EnvValue -Name "TWITCH_EXTENSION_ID" -Label "Twitch Extension ID" -Required
Read-SecretValue -Name "TWITCH_EXTENSION_SECRET" -Label "Twitch Extension Base64 shared secret"
Read-EnvValue -Name "TWITCH_EXTENSION_VERSION" -Label "Twitch Extension version" -Default "0.1.0" -Required
Read-ExtensionOwnerId

if ([string]::IsNullOrWhiteSpace([string]$script:EnvValues["TWITCH_SESSION_SECRET"]) -or $script:EnvValues["TWITCH_SESSION_SECRET"] -eq "replace-with-at-least-32-random-characters") {
  $randomBytes = New-Object byte[] 32
  $randomGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $randomGenerator.GetBytes($randomBytes)
  } finally {
    $randomGenerator.Dispose()
  }
  $script:EnvValues["TWITCH_SESSION_SECRET"] = [BitConverter]::ToString($randomBytes).Replace("-", "").ToLowerInvariant()
}

Read-EnvValue -Name "TWITCH_EXTENSION_ALLOWED_ORIGINS" -Label "Extra Extension origins (optional; usually blank for local test)"
Read-EnvValue -Name "MURMUR_EXTENSION_EBS_URL" -Label "Public MurMur backend URL (blank for local test)"
Read-EnvValue -Name "MURMUR_DASHBOARD_URL" -Label "Public MurMur dashboard URL (blank for local test)"

$renderedLines = New-Object System.Collections.Generic.List[string]
$writtenKeys = @{}
foreach ($line in Get-Content -LiteralPath $templatePath) {
  if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
    $name = $matches[1]
    $value = [string]$script:EnvValues[$name]
    $renderedLines.Add("$name=$value")
    $writtenKeys[$name] = $true
  } else {
    $renderedLines.Add($line)
  }
}

foreach ($name in $script:EnvValues.Keys) {
  if (-not $writtenKeys.ContainsKey($name)) {
    $renderedLines.Add("$name=$($script:EnvValues[$name])")
  }
}

$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($envPath, ($renderedLines -join [Environment]::NewLine) + [Environment]::NewLine, $utf8WithoutBom)
Write-Host ""
Write-Host "Saved .env.local. It is git-ignored and your secret values were not printed."
