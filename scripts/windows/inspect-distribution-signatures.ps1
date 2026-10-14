param([Parameter(Mandatory)][string]$Installation, [Parameter(Mandatory)][string]$Installer, [Parameter(Mandatory)][string]$Output)
$ErrorActionPreference = 'Stop'
$targets = @(
  @{ Role = 'installer'; Path = $Installer },
  @{ Role = 'application'; Path = (Join-Path $Installation 'SporTagLytics.exe') },
  @{ Role = 'ffmpeg'; Path = (Join-Path $Installation 'resources/media-tools/ffmpeg.exe') },
  @{ Role = 'ffprobe'; Path = (Join-Path $Installation 'resources/media-tools/ffprobe.exe') }
)
$records = @($targets | ForEach-Object {
  $signature = Get-AuthenticodeSignature -LiteralPath $_.Path
  # Publish status and file identity only, never certificate subjects or local paths.
  [ordered]@{ role = $_.Role; status = $signature.Status.ToString(); sha256 = (Get-FileHash -LiteralPath $_.Path -Algorithm SHA256).Hash.ToLowerInvariant() }
})
$outputPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Output)
New-Item -ItemType Directory -Force (Split-Path -Parent $outputPath) | Out-Null
[System.IO.File]::WriteAllText($outputPath, ($records | ConvertTo-Json -Depth 3), [System.Text.UTF8Encoding]::new($false))
