$ErrorActionPreference = 'Stop'
$installer = Get-ChildItem dist/*Setup*x64.exe | Select-Object -First 1
if (-not $installer) { throw 'Windows installer is missing' }
$target = Join-Path $env:TEMP 'SporTagLytics 日本語 #50%'
$result = Start-Process -FilePath $installer.FullName -ArgumentList @('/S', "/D=$target") -Wait -PassThru
if ($result.ExitCode -ne 0) { throw "Installer failed: $($result.ExitCode)" }
try {
  $env:E2E_APP_PATH = Join-Path $target 'SporTagLytics.exe'
  if (-not (Test-Path $env:E2E_APP_PATH)) { throw 'Installed application is missing' }
  node scripts/windows/verify-native-dependencies.mjs "$target/resources/media-tools/ffmpeg.exe" "$target/resources/media-tools/ffprobe.exe" "$target/resources/llama/win32/llama-completion.exe"
  if ($LASTEXITCODE -ne 0) { throw 'Native runtime has missing dependencies' }
  foreach ($scenario in @('clip-sync', 'code-window-menu', 'export-progress', 'timeline-rows', 'paint')) {
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
