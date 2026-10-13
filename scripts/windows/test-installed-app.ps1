$ErrorActionPreference = 'Stop'
$installers = @(Get-ChildItem dist/*Setup*x64.exe)
if ($installers.Count -ne 1) { throw 'Expected exactly one Windows installer' }
$installer = $installers[0]
$target = Join-Path $env:TEMP 'SporTagLytics 日本語 #50%'
$result = Start-Process -FilePath $installer.FullName -ArgumentList @('/S', "/D=$target") -Wait -PassThru
if ($result.ExitCode -ne 0) { throw "Installer failed: $($result.ExitCode)" }
try {
  $env:E2E_APP_PATH = Join-Path $target 'SporTagLytics.exe'
  if (-not (Test-Path $env:E2E_APP_PATH)) { throw 'Installed application is missing' }
  ./scripts/windows/inspect-distribution-signatures.ps1 -Installation $target -Installer $installer.FullName -Output 'output/distribution/windows-signatures.json'
  node scripts/windows/report-installed-distribution.mjs "$target" "$($installer.FullName)" output/distribution/windows-signatures.json output/distribution/windows-installed.json
  if ($LASTEXITCODE -ne 0) { throw 'Installed distribution byte verification failed' }
  node scripts/windows/verify-native-dependencies.mjs "$target/resources/media-tools/ffmpeg.exe" "$target/resources/media-tools/ffprobe.exe" "$target/resources/llama/win32/llama-completion.exe"
  if ($LASTEXITCODE -ne 0) { throw 'Native runtime has missing dependencies' }
  foreach ($scenario in @('ux-review', 'ux-density', 'package-safety', 'sportscode-import', 'legacy-external', 'live-capture', 'clip-sync', 'multi-clip-playback', 'code-window-menu', 'export-progress', 'timeline-rows', 'paint', 'tactical-board', 'package-reopen', 'playlist-open-menu', 'playlist-references-angles', 'event-detection')) {
    node "scripts/e2e-$scenario.mjs"
    if ($LASTEXITCODE -ne 0) { throw "Installed application failed: $scenario" }
  }
  $association = Get-ItemPropertyValue 'HKCU:\Software\Classes\Directory\shell\SporTagLytics\command' '(default)'
  if (-not $association.Contains($target)) { throw 'Explorer package opening is not registered' }
} finally {
  Remove-Item Env:E2E_APP_PATH -ErrorAction SilentlyContinue
  $uninstaller = Join-Path $target 'Uninstall SporTagLytics.exe'
  if (Test-Path $uninstaller) {
    $removed = Start-Process -FilePath $uninstaller -ArgumentList '/S' -Wait -PassThru
    if ($removed.ExitCode -ne 0) { throw "Uninstaller failed: $($removed.ExitCode)" }
  }
}
