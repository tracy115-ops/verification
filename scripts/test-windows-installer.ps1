$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true') { throw 'Run installer smoke tests only in the disposable GitHub runner.' }
$installers = @(Get-ChildItem -LiteralPath 'artifacts/windows-x64' -Filter '*-setup.exe' -File)
if ($installers.Count -ne 1) { throw 'Expected one installer.' }
$installRoot = Join-Path $env:RUNNER_TEMP 'Verification Workbench install smoke'
$profileRoot = Join-Path $env:RUNNER_TEMP 'verification-webview-smoke'
$env:WEBVIEW2_USER_DATA_FOLDER = $profileRoot
$binary = Join-Path $installRoot 'verification-desktop.exe'
function Install-Workbench([switch]$Upgrade) {
  $arguments = @('/S')
  if ($Upgrade) { $arguments += @('/UPDATE', '/R') }
  $arguments += "/D=$installRoot"
  $installer = Start-Process -FilePath $installers[0].FullName -ArgumentList $arguments -WindowStyle Hidden -PassThru
  if (-not $installer.WaitForExit(120000)) {
    $installer.Kill()
    throw 'Installer timed out.'
  }
  if ($installer.ExitCode -ne 0) { throw "Installer failed: $($installer.ExitCode)" }
  foreach ($resource in @($binary, (Join-Path $installRoot 'collaboration/server.cjs'), (Join-Path $installRoot 'collaboration/web/index.html'))) {
    if (-not (Test-Path -LiteralPath $resource -PathType Leaf)) { throw "Installed resource missing: $resource" }
  }
}
function Start-WorkbenchSmoke {
  $application = Start-Process -FilePath $binary -WindowStyle Hidden -PassThru
  try {
    if ($application.WaitForExit(10000)) { throw "Application exited during startup: $($application.ExitCode)" }
  } finally {
    if (-not $application.HasExited) {
      $null = $application.CloseMainWindow()
      if (-not $application.WaitForExit(10000)) { $application.Kill(); $application.WaitForExit() }
    }
  }
}
Install-Workbench
Start-WorkbenchSmoke
New-Item -ItemType Directory -Path $profileRoot -Force | Out-Null
$sentinel = Join-Path $profileRoot 'upgrade-smoke-sentinel.txt'
'keep-profile' | Set-Content -LiteralPath $sentinel
Install-Workbench -Upgrade
if ((Get-Content -LiteralPath $sentinel -Raw).Trim() -ne 'keep-profile') { throw 'Upgrade modified the existing profile directory.' }
$restartDeadline = [DateTime]::UtcNow.AddSeconds(30)
$restarted = $null
while ([DateTime]::UtcNow -lt $restartDeadline) {
  $restarted = Get-Process -Name 'verification-desktop' -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $binary } | Select-Object -First 1
  if ($restarted) { break }
  Start-Sleep -Milliseconds 250
}
if (-not $restarted) { throw 'Installer did not automatically restart the installed application.' }
try {
  if ($restarted.WaitForExit(10000)) { throw 'Automatically restarted application exited early.' }
} finally {
  if (-not $restarted.HasExited) {
    $null = $restarted.CloseMainWindow()
    if (-not $restarted.WaitForExit(10000)) { $restarted.Kill(); $restarted.WaitForExit() }
  }
}
'Installer and same-version automatic restart tests passed. Business-data restoration is covered separately.' | Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY
