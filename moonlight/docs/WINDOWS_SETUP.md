# MoonLight Trading OS - Windows Setup Guide

**Target Platform:** Windows 10/11 (64-bit)

---

## Prerequisites

### Required Software

1. **Node.js 20.x LTS**
   - Download: https://nodejs.org/
   - Verify: `node --version` (should show v20.x.x)

2. **Yarn 1.22+**
   - Install: `npm install -g yarn`
   - Verify: `yarn --version`

3. **Redis 7.x**
   - **Option A (Recommended):** Redis for Windows
     - Download: https://github.com/microsoftarchive/redis/releases
     - Install and start Redis service (default port: 6379)
   - **Option B:** WSL2 + Redis
     ```bash
     wsl --install
     wsl -d Ubuntu
     sudo apt update && sudo apt install redis-server
     sudo service redis-server start
     ```
   - Verify: `redis-cli ping` (should return PONG)

4. **Git**
   - Download: https://git-scm.com/download/win

### Optional (Development)

- **Visual Studio Code** (recommended IDE)
- **Windows Terminal** (better PowerShell experience)

---

## First-Time Setup

### Step 1: Clone Repository

```powershell
git clone <repository-url>
cd moonlight
```

### Step 2: Install Dependencies

```powershell
# Install all workspace dependencies
yarn install
```

This installs:
- Root workspace dependencies
- Backend dependencies (NestJS, SQLite, Redis clients, etc.)
- Desktop dependencies (Electron, React, Vite, etc.)

**Expected time:** 2-5 minutes (depending on internet speed)

### Step 3: Configure Environment

```powershell
# Backend configuration
copy backend\.env.example backend\.env

# Desktop configuration
copy desktop\.env.example desktop\.env
```

**Edit `backend/.env`:**
- Review `ART_SIGNING_SECRET` (change for production)
- Verify `REDIS_HOST` and `REDIS_PORT` match your Redis installation
- Confirm `MOONLIGHT_ENVIRONMENT=SANDBOX` for safe testing

**Edit `desktop/.env`:**
- Verify `VITE_API_BASE_URL=http://localhost:8001` matches backend port

### Step 4: Initialize Database

First run will automatically create SQLite database:

```powershell
# Create data directory structure
mkdir data\db
mkdir data\raw
mkdir data\bars
```

---

## Daily Development Workflow

### Option 1: PowerShell Helper (Recommended)

```powershell
.\scripts\start-dev.ps1
```

This opens two terminal windows:
- **Terminal 1:** Backend (NestJS dev server on port 8001)
- **Terminal 2:** Desktop (Vite dev server on port 5173)

### Option 2: Manual Start

**Terminal 1 - Backend:**
```powershell
cd backend
yarn start:dev
```

Wait for:
```
[MoonLight Backend] Server running on port 8001
```

**Terminal 2 - Desktop:**
```powershell
cd desktop
yarn dev
```

Wait for:
```
VITE v5.x.x ready in XXXms
Local: http://localhost:5173/
```

**Access Owner Console:**
- Open browser: http://localhost:5173
- Or wait for Electron window to auto-launch

---

## Running Tests

### Backend Unit Tests

```powershell
cd backend
yarn test
```

**Expected:** 25+ test suites, 96+ tests passing

### Smoke Test

```powershell
# From project root
yarn smoke

# Or using PowerShell helper
.\scripts\run-smoke.ps1
```

**Checks:**
- Backend health endpoints
- Owner API contracts
- Backtest runs API
- PNL history API
- Data health matrix

---

## Building Production Installer

### Step 1: Build Backend

```powershell
cd backend
yarn build
```

Output: `backend/dist/`

### Step 2: Build Desktop Installer

```powershell
cd desktop
yarn build
yarn dist
```

**Output:** `desktop/dist/MoonLight-Owner-Console-Setup-1.3.0.exe`

**Time:** 3-5 minutes

### Step 3: Install

1. Run `MoonLight-Owner-Console-Setup-1.3.0.exe`
2. Follow installation wizard
3. Launch from Start Menu or Desktop shortcut

**Note:** Production installer still requires:
- Redis running locally
- Backend running as Windows Service (manual setup) or started via script

---

## Database Management

### View Database

```powershell
# Using SQLite browser
sqlite3 data\db\moonlight.sqlite

# Or use DB Browser for SQLite (GUI)
# Download: https://sqlitebrowser.org/
```

### Reset Database (Fresh Start)

```powershell
# WARNING: This deletes all data!
Remove-Item data\db\moonlight.sqlite -Force

# Restart backend - it will recreate the schema
cd backend
yarn start:dev
```

### Seed Sample Data (Optional)

```powershell
cd backend
yarn ts-node scripts/seed-data.ts
```

**Note:** Seed script creates sample accounts, strategies, and backtest runs for testing.

---

## Troubleshooting

### Backend won't start

**Problem:** "Redis connection error"

**Solution:**
```powershell
# Check Redis is running
redis-cli ping

# If not running, start Redis service
net start Redis

# Or if using WSL2
wsl -d Ubuntu
sudo service redis-server start
```

### Desktop app won't connect

**Problem:** "API Error: Network request failed"

**Solution:**
- Verify backend is running: http://localhost:8001/owner/dashboard/summary
- Check `desktop/.env` has correct `VITE_API_BASE_URL`
- Restart desktop app

### Port already in use

**Problem:** "Port 8001 is already in use"

**Solution:**
```powershell
# Find process using port 8001
netstat -ano | findstr :8001

# Kill process
taskkill /PID <PID> /F

# Or change port in backend/.env
PORT=8002
```

### Build fails

**Problem:** TypeScript compilation errors

**Solution:**
```powershell
# Clear node_modules and reinstall
Remove-Item node_modules -Recurse -Force
Remove-Item backend\node_modules -Recurse -Force
Remove-Item desktop\node_modules -Recurse -Force
yarn install
```

---

## Daily Checklist

**Before Starting Development:**
- [ ] Redis is running
- [ ] Latest code pulled from Git
- [ ] Dependencies updated (`yarn install` if package.json changed)

**Starting Work:**
- [ ] Backend: `cd backend && yarn start:dev`
- [ ] Desktop: `cd desktop && yarn dev`
- [ ] Browser/Electron window opens to Dashboard

**Before Committing:**
- [ ] Tests pass: `cd backend && yarn test`
- [ ] Smoke test: `yarn smoke`
- [ ] No hardcoded secrets in code
- [ ] .env files not committed

---

## Performance Tips

### Faster Development Cycle

1. **Keep Redis running:** Don't restart between sessions
2. **Use watch mode:** Backend hot-reload is enabled by default
3. **Vite HMR:** Desktop UI hot-reloads automatically

### Memory Management

- **SAFE profile:** ~500MB RAM
- **BALANCED profile:** ~1GB RAM
- **MAXPOWER profile:** ~2GB RAM

Adjust `HARDWARE_PROFILE` in backend/.env based on your machine.

---

## Advanced: Running as Windows Service

**For production deployment** (optional):

```powershell
# Install NSSM (Non-Sucking Service Manager)
choco install nssm

# Create backend service
nssm install MoonLightBackend "C:\Program Files\nodejs\node.exe"
nssm set MoonLightBackend AppDirectory "C:\path\to\moonlight\backend"
nssm set MoonLightBackend AppParameters "dist\main.js"

# Start service
nssm start MoonLightBackend
```

**Desktop app** will connect to local backend service automatically.

---

## Support

For setup issues:
- Check logs: `backend/*.log`
- Run smoke test: `yarn smoke`
- Review error messages in terminal

---

**MoonLight v1.3 - Windows Desktop Trading Platform**
