# MoonLight Development Starter
# Windows PowerShell script

Write-Host "" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "  MoonLight Dev Environment" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Check if Redis is running (optional)
$redisCheck = Test-NetConnection -ComputerName 127.0.0.1 -Port 6379 -InformationLevel Quiet -WarningAction SilentlyContinue

if (-not $redisCheck) {
    Write-Host "WARNING: Redis not detected on 127.0.0.1:6379" -ForegroundColor Yellow
    Write-Host "Backend might fail to start. Please ensure Redis is running." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Starting Backend (NestJS on port 8001)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; yarn start:dev"

Start-Sleep -Seconds 2

Write-Host "Starting Desktop (Vite dev server on port 5173)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd desktop; yarn dev"

Write-Host ""
Write-Host "MoonLight dev environment started!" -ForegroundColor Cyan
Write-Host "Backend: http://localhost:8001" -ForegroundColor White
Write-Host "Desktop: http://localhost:5173" -ForegroundColor White
Write-Host ""
