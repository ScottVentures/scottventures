$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $root
Set-Location $projectRoot
if (-not (Test-Path '.venv\Scripts\python.exe')) {
    python -m venv .venv
}
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt
Set-Location $root
Start-Process 'http://127.0.0.1:8001'
& ..\.venv\Scripts\python.exe -m uvicorn app:app --app-dir . --host 127.0.0.1 --port 8001
