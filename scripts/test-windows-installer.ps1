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
New-Item -ItemType Directory -Path (Join-Path $env:RUNNER_TEMP 'verification-update-worker') -Force | Out-Null
$workerRoot = Join-Path $env:RUNNER_TEMP 'verification-update-worker'
$worker = Join-Path $workerRoot 'wb-update-worker.exe'
Copy-Item -LiteralPath $binary -Destination $worker
$workerInstaller = Join-Path $workerRoot 'update-smoke.exe'
Copy-Item -LiteralPath $installers[0].FullName -Destination $workerInstaller
$build = Get-Content -LiteralPath 'artifacts/windows-x64/build-info.json' -Raw | ConvertFrom-Json
$workerRequest = Join-Path $workerRoot 'wb-update-request.json'
$oldApplication = Start-Process -FilePath $binary -WindowStyle Hidden -PassThru
@{ installer = $workerInstaller; application = $binary; parent_pid = $oldApplication.Id; version = $build.appVersion; size = (Get-Item -LiteralPath $workerInstaller).Length; sha256 = (Get-FileHash -LiteralPath $workerInstaller -Algorithm SHA256).Hash.ToLowerInvariant() } | ConvertTo-Json | Set-Content -LiteralPath $workerRequest -Encoding utf8NoBOM
$supervisor = Start-Process -FilePath $worker -ArgumentList @('--verification-update-worker', ('"' + $workerRequest + '"')) -WindowStyle Hidden -PassThru
try {
  $waitingDeadline = [DateTime]::UtcNow.AddSeconds(30)
  do {
    Start-Sleep -Milliseconds 200
    $receiptPath = Join-Path $workerRoot 'last-install.json'
    $state = if (Test-Path -LiteralPath $receiptPath) { try { Get-Content -LiteralPath $receiptPath -Raw | ConvertFrom-Json } catch { $null } } else { $null }
  } until ($state.status -eq 'waiting_for_app_exit' -or [DateTime]::UtcNow -ge $waitingDeadline -or $supervisor.HasExited)
  if ($state.status -ne 'waiting_for_app_exit' -or $supervisor.HasExited) { throw 'Supervisor did not wait for the existing application.' }
} finally {
  if (-not $oldApplication.HasExited) {
    $null = $oldApplication.CloseMainWindow()
    if (-not $oldApplication.WaitForExit(10000)) { $oldApplication.Kill(); $oldApplication.WaitForExit() }
  }
}
if (-not $supervisor.WaitForExit(180000)) { $supervisor.Kill(); throw 'Update supervisor timed out.' }
$result = Get-Content -LiteralPath (Join-Path $workerRoot 'last-install.json') -Raw | ConvertFrom-Json
if ($supervisor.ExitCode -ne 0 -or $result.status -ne 'restart_started') { throw "Update supervisor failed: $($result.status), exit $($result.exit_code)" }
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
'Installer and supervised same-version restart tests passed. Business-data restoration is covered separately.' | Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY
