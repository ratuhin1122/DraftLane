$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$dataPath = Join-Path $projectRoot '.local/postgres'
if (!(Test-Path (Join-Path $dataPath 'PG_VERSION'))) {
  throw 'No local database data found. Configure DATABASE_URL and DIRECT_URL for your PostgreSQL server. This script never creates or resets your database.'
}
$version = (Get-Content (Join-Path $dataPath 'PG_VERSION')).Trim()
$pgCtl = Join-Path $env:ProgramFiles "PostgreSQL/$version/bin/pg_ctl.exe"
if (!(Test-Path $pgCtl)) { throw "PostgreSQL $version is required to run this data directory." }
& $pgCtl -D $dataPath status
if ($LASTEXITCODE -eq 0) { exit 0 }
& $pgCtl -D $dataPath -l (Join-Path $projectRoot '.local/postgres.log') -o '-h 127.0.0.1 -p 55432' -w start
if ($LASTEXITCODE -ne 0) { throw 'Database startup failed. Check .local/postgres.log.' }
