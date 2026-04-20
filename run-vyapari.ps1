param(
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = Join-Path $root 'backend'
$frontendPath = Join-Path $root 'frontend'
$venvPath = Join-Path $backendPath '.venv'
$backendPython = Join-Path $venvPath 'Scripts\python.exe'
$backendUvicorn = @(
    '-m', 'uvicorn', 'run:app', '--reload', '--port', '8000'
)
$frontendDev = @(
    'run', 'dev', '--', '--host', '0.0.0.0', '--port', '5173'
)

function Write-Section($title) {
    Write-Host ''
    Write-Host ('=' * 72)
    Write-Host $title
    Write-Host ('=' * 72)
}

Write-Section 'Vyapari Launcher'
Write-Host "Root:     $root"
Write-Host "Backend:  $backendPath"
Write-Host "Frontend: $frontendPath"

if (-not (Test-Path $venvPath)) {
    Write-Host 'Creating Python virtual environment for backend...'
    Push-Location $backendPath
    try {
        python -m venv .venv
    } finally {
        Pop-Location
    }
}

if (-not $SkipInstall) {
    Write-Host 'Installing backend dependencies...'
    Push-Location $backendPath
    try {
        & $backendPython -m pip install --upgrade pip | Out-Host
        & $backendPython -m pip install -r requirements.txt | Out-Host
    } finally {
        Pop-Location
    }

    if (-not (Test-Path (Join-Path $frontendPath 'node_modules'))) {
        Write-Host 'Installing frontend dependencies...'
        Push-Location $frontendPath
        try {
            npm install | Out-Host
        } finally {
            Pop-Location
        }
    }
}

Write-Host 'Starting backend on http://localhost:8000 ...'
Start-Process -FilePath 'powershell' -WorkingDirectory $backendPath -ArgumentList @(
    '-NoExit',
    '-ExecutionPolicy', 'Bypass',
    '-Command', "& '$backendPython' $($backendUvicorn -join ' ')"
)

Write-Host 'Starting frontend on http://localhost:5173 ...'
$viteBinary = Join-Path $frontendPath 'node_modules\.bin\vite.cmd'
Start-Process -FilePath $viteBinary -WorkingDirectory $frontendPath -ArgumentList @(
    '--host', '0.0.0.0',
    '--port', '5173',
    '--strictPort'
)

Write-Host ''
Write-Host 'Vyapari is launching in two PowerShell windows.'
Write-Host 'Use the frontend URL for the UI and the backend URL for the API.'
Write-Host 'Close the spawned windows to stop the servers.'
