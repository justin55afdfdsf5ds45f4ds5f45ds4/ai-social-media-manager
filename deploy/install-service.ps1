# Keeps the dashboard running on this machine as a Windows scheduled task (starts at log-on, restarts on failure).
#   powershell -ExecutionPolicy Bypass -File deploy\install-service.ps1          # install / update + start
#   powershell -ExecutionPolicy Bypass -File deploy\install-service.ps1 -Remove  # remove
param([switch]$Remove)
$ErrorActionPreference = "Stop"
$name = "AI Social Media Manager"
$root = Split-Path -Parent $PSScriptRoot
$script = Join-Path $PSScriptRoot "start-dashboard.ps1"

if ($Remove) {
  schtasks /End /TN $name 2>$null | Out-Null
  schtasks /Delete /TN $name /F | Out-Null
  Write-Host "removed task '$name'"
  exit 0
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`"" -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $name
Write-Host "task '$name' installed and started -> http://localhost:3000"
