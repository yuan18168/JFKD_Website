param([int]$Port = 8765)
$ErrorActionPreference = 'Stop'
$demoRoot = Join-Path (Split-Path $PSScriptRoot -Parent) '_preview'
if (-not (Test-Path -LiteralPath (Join-Path $demoRoot 'app.html'))) { $demoRoot = $PSScriptRoot }
$bundledPython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
if (Test-Path -LiteralPath $bundledPython) { $pythonExe = $bundledPython }
elseif (Get-Command python -ErrorAction SilentlyContinue) { $pythonExe = (Get-Command python).Source }
else { throw 'Python 3 is required.' }
if (-not (Test-Path -LiteralPath (Join-Path $demoRoot 'app.html'))) { throw 'Build preview first: python preview/build.py' }
Write-Host "Preview: http://localhost:$Port/app.html"
Write-Host 'Phone/tablet: use this PC LAN IPv4 address, same Wi-Fi and port. Ctrl+C stops preview.'
& $pythonExe -m http.server $Port --bind 0.0.0.0 --directory $demoRoot
