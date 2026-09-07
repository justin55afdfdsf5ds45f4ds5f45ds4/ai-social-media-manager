# Runs the production dashboard (build once with `npm run build`). Used by the scheduled task.
$root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $root "dashboard")
$env:NODE_ENV = "production"
$env:PORT = "3000"
$log = Join-Path $root "deploy\dashboard.log"
& npx next start -p 3000 *>> $log
