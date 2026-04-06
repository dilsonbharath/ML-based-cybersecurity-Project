$ErrorActionPreference = "Stop"

Write-Host "== Pre-deploy checks starting ==" -ForegroundColor Cyan

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$backendPython = Join-Path $root "Backend\.venv\Scripts\python.exe"
if (!(Test-Path $backendPython)) {
  throw "Backend Python not found at $backendPython"
}

$frontendDir = Join-Path $root "Frontend"
if (!(Test-Path $frontendDir)) {
  throw "Frontend directory not found at $frontendDir"
}

Write-Host "[1/6] Checking backend app import" -ForegroundColor Yellow
& $backendPython -c "import sys; sys.path.append('Backend'); from app.main import app; print('Backend import OK')"

Write-Host "[2/6] Checking backend database target" -ForegroundColor Yellow
& $backendPython "DB\check_db_location.py"

Write-Host "[3/6] Listing public tables" -ForegroundColor Yellow
& $backendPython "DB\list_public_tables.py"

Write-Host "[4/6] Running frontend production build" -ForegroundColor Yellow
Set-Location $frontendDir
npm run build
Set-Location $root

Write-Host "[5/6] Verifying frontend environment file" -ForegroundColor Yellow
$frontendProdEnvPath = Join-Path $frontendDir ".env.production"
$frontendLocalEnvPath = Join-Path $frontendDir ".env"
if (Test-Path $frontendProdEnvPath) {
  $frontendEnv = Get-Content $frontendProdEnvPath -Raw
  if ($frontendEnv -match "VITE_API_BASE_URL=(.+)") {
    $apiUrl = $matches[1].Trim()
    if ($apiUrl -match "localhost|127.0.0.1|your-backend-domain") {
      Write-Host "WARNING: Frontend .env.production VITE_API_BASE_URL looks non-production: $apiUrl" -ForegroundColor Red
    } else {
      Write-Host "Frontend .env.production contains VITE_API_BASE_URL=$apiUrl" -ForegroundColor Green
    }
  } else {
    Write-Host "WARNING: Frontend .env.production exists but VITE_API_BASE_URL is missing" -ForegroundColor Red
  }
} elseif (Test-Path $frontendLocalEnvPath) {
  $frontendEnv = Get-Content $frontendLocalEnvPath -Raw
  if ($frontendEnv -match "VITE_API_BASE_URL=(.+)") {
    $apiUrl = $matches[1].Trim()
    Write-Host "WARNING: Using Frontend .env for URL ($apiUrl). Create Frontend/.env.production for deploy." -ForegroundColor Red
  } else {
    Write-Host "WARNING: Frontend .env exists but VITE_API_BASE_URL is missing" -ForegroundColor Red
  }
} else {
  Write-Host "WARNING: Frontend .env.production not found. Copy Frontend/.env.production.example and set VITE_API_BASE_URL" -ForegroundColor Red
}

Write-Host "[6/6] Verifying backend CORS origins variable" -ForegroundColor Yellow
$backendEnvPath = Join-Path $root "Backend\.env.local"
if (Test-Path $backendEnvPath) {
  $backendEnv = Get-Content $backendEnvPath -Raw
  if ($backendEnv -match "CORS_ORIGINS=(.+)") {
    $corsOrigins = $matches[1].Trim()
    $parts = $corsOrigins.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
    $hasNonLocal = $false
    foreach ($origin in $parts) {
      if ($origin -notmatch "localhost|127.0.0.1") {
        $hasNonLocal = $true
        break
      }
    }

    if (-not $hasNonLocal) {
      Write-Host "WARNING: Backend CORS_ORIGINS is localhost-only. Add your production frontend origin(s)." -ForegroundColor Red
    } elseif ($corsOrigins -match "your-frontend-domain") {
      Write-Host "WARNING: Backend CORS_ORIGINS still uses placeholder domain. Replace with your real frontend URL." -ForegroundColor Red
    } else {
      Write-Host "Backend .env.local contains CORS_ORIGINS=$corsOrigins" -ForegroundColor Green
    }
  } else {
    Write-Host "WARNING: Backend .env.local missing CORS_ORIGINS" -ForegroundColor Red
  }
} else {
  Write-Host "WARNING: Backend .env.local not found. Copy Backend/.env.example and set DB + CORS" -ForegroundColor Red
}

Write-Host "== Pre-deploy checks finished ==" -ForegroundColor Cyan
Write-Host "If warnings were shown, fix them before deployment." -ForegroundColor Yellow
