# MoonLight Smoke Test Runner
# Windows PowerShell script

Write-Host "" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host "  MoonLight Smoke Test" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host ""

# Check if backend is running
$backendCheck = Test-NetConnection -ComputerName 127.0.0.1 -Port 8001 -InformationLevel Quiet -WarningAction SilentlyContinue

if (-not $backendCheck) {
    Write-Host "ERROR: Backend not running on port 8001" -ForegroundColor Red
    Write-Host "Please start backend first: yarn dev:backend" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "Backend detected. Running smoke tests..." -ForegroundColor Green
Write-Host ""

# Run smoke test
cd backend
yarn ts-node scripts/smoke-test.ts

$exitCode = $LASTEXITCODE

if ($exitCode -eq 0) {
    Write-Host "" -ForegroundColor Green
    Write-Host "✅ Smoke test PASSED" -ForegroundColor Green
    Write-Host "" -ForegroundColor Green
} else {
    Write-Host "" -ForegroundColor Red
    Write-Host "❌ Smoke test FAILED" -ForegroundColor Red
    Write-Host "" -ForegroundColor Red
}

exit $exitCode
