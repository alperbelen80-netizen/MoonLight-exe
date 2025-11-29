# MoonLight Trading OS v1.0

**Kurumsal Trading Otomasyon Platformu — Owner Console & Backtest Engine**

---

## Overview

MoonLight, Fixed-Time (binary/turbo) trading stratejileri için geliştirilmiş, kurumsal seviyede bir otomasyon ve risk yönetim platformudur. Sistem iki ana bileşenden oluşur:

- **Backend Engine (Node.js + NestJS):** Execution pipeline, risk management, backtest engine, strategy factory, data processing.
- **Owner Desktop Console (Electron + React):** Canlı kontrol paneli, risk yönetimi, execution mode kontrolü, alert & approval yönetimi.

**Temel Özellikler:**
- 60+ strateji desteği (scalping, mean revert, trend follow)
- Triple-Check risk katmanı (U1/U2/U3 uncertainty scoring)
- M3 Defensive mechanism (AUTO/GUARD/ANALYSIS modes)
- Circuit Breaker & Fail-Safe (DayCap, loss streak, WR degradation)
- Backtest engine (historical data → strategies → PnL calculation)
- Advanced reporting (Sharpe, Profit Factor, equity curve, CSV/XLSX export)
- Owner Console (execution mode control, kill-switch, product matrix, alerts, approval queue)

---

## Architecture

**Backend:**
- Runtime: Node.js 20
- Framework: NestJS 10
- Database: SQLite (trade logs, config)
- Time-series: Parquet (OHLCV data)
- Queue: Redis + Bull
- Language: TypeScript (strict mode)

**Desktop:**
- Framework: Electron 28
- UI: React 18 + TypeScript
- Styling: TailwindCSS
- State: Zustand
- Bundler: Vite

---

## Requirements

- **Node.js:** 20.x LTS
- **Package Manager:** Yarn 1.22+
- **Redis:** 7.x (for job queues)
- **OS:** Windows 10/11 (Owner Console), Linux/macOS (backend development)

---

## Development Setup

### 1. Clone & Install

```bash
git clone <repository-url>
cd moonlight
yarn install
```

### 2. Configure Environment

```bash
cp backend/.env.example backend/.env
cp desktop/.env.example desktop/.env
```

Edit `backend/.env` if needed (default ports: backend=8001, redis=6379).

### 3. Start Development Servers

```bash
yarn dev
```

This starts:
- **Backend:** http://localhost:8001
- **Desktop:** http://localhost:5173 (Vite dev server)

Alternatively (PowerShell on Windows):

```powershell
.\scripts\start-dev.ps1
```

---

## Production Build

### Backend Build

```bash
yarn build:backend
```

Output: `backend/dist/`

### Desktop Installer (Windows)

```bash
yarn package:desktop
```

Output: `desktop/dist/MoonLight-Owner-Console-Setup-1.0.0.exe`

---

## Testing

### Backend Unit Tests

```bash
cd backend
yarn test
```

**Coverage:** 20 test suites, 81+ tests

### Smoke Test

```bash
yarn smoke
```

Or (PowerShell):

```powershell
.\scripts\run-smoke.ps1
```

Checks:
- Backend health (GET /owner/dashboard/summary)
- API contracts (accounts, execution-matrix, alerts)

---

## Basic Workflow

### Step 1: Start System

```bash
yarn dev
```

### Step 2: Open Owner Console

Navigate to http://localhost:5173 (dev) or launch Electron app (production).

### Step 3: Check Dashboard

- View global health score
- See daily PnL and win rate
- Monitor execution mode (OFF/AUTO/GUARD/ANALYSIS)

### Step 4: Configure Accounts

Go to **Accounts** page:
- View broker accounts
- Check session health (UP/DEGRADED/COOLDOWN)
- Add new account (FakeBroker for testing)

### Step 5: Control Execution Matrix

Go to **Execution Matrix** page:
- Toggle data capture per product/TF
- Toggle signal generation
- Toggle auto-trade execution

### Step 6: Monitor Alerts

Go to **Alerts** page:
- Filter by severity (CRITICAL/WARNING/INFO)
- ACK or RESOLVE alerts
- Review circuit breaker and fail-safe events

### Step 7: Manage Approvals (GUARD mode)

If execution mode = GUARD:
- Dashboard shows pending approvals
- Approve or reject trades manually

### Step 8: Kill-Switch (Emergency Stop)

If needed:
- Click **Activate Kill-Switch** button
- All automatic trading stops (Circuit Breaker L3 GLOBAL)
- Deactivate when safe to resume

---

## Key Endpoints (Backend)

### Owner API
- `GET /owner/dashboard/summary` - Dashboard metrics
- `GET /owner/accounts` - Broker accounts
- `GET /owner/execution-matrix` - Product/TF config
- `GET /owner/execution-mode` - Global mode
- `POST /owner/execution-mode` - Change mode

### Risk API
- `POST /risk/kill-switch/activate` - Emergency stop
- `POST /risk/kill-switch/deactivate` - Resume
- `GET /risk/approval/pending` - Approval queue
- `POST /risk/approval/:id/approve` - Approve trade

### Alerts API
- `GET /alerts` - List alerts
- `POST /alerts/:id/ack` - Acknowledge
- `POST /alerts/:id/resolve` - Resolve

### Backtest API
- `POST /backtest/run` - Start backtest
- `GET /backtest/status/:runId` - Check status
- `GET /reporting/backtest/:runId/advanced` - Advanced metrics
- `GET /reporting/backtest/:runId/export/xlsx` - Excel export

---

## Limitations (v1.0)

- **Broker Support:** FakeBroker only (real broker adapters in development)
- **Multi-Tenant:** Single owner scenario
- **Data Sources:** Manual Parquet import (TradingView webhook in development)
- **Production Deployment:** Desktop app only (cloud deployment roadmap)

---

## Project Structure

```
moonlight/
├── backend/          # NestJS backend
│   ├── src/
│   │   ├── execution/  # Execution pipeline
│   │   ├── risk/       # Risk, ART, Triple-Check, Circuit Breaker
│   │   ├── strategy/   # Strategy factory, indicators
│   │   ├── backtest/   # Backtest engine
│   │   ├── data/       # Data capture, resample
│   │   ├── broker/     # Broker adapters
│   │   ├── owner/      # Owner API
│   │   └── alerts/     # Alerts module
│   └── tests/
├── desktop/         # Electron + React
│   ├── main/        # Electron main process
│   └── renderer/    # React UI
│       ├── src/
│       │   ├── routes/      # Pages
│       │   ├── components/  # UI components
│       │   ├── store/       # Zustand stores
│       │   └── services/    # API clients
├── data/            # Data storage (SQLite, Parquet)
├── docs/            # Documentation
├── scripts/         # PowerShell helpers
└── .github/workflows/  # CI/CD
```

---

## Documentation

- **[QUICKSTART_OWNER.md](docs/QUICKSTART_OWNER.md)** - Owner operational guide
- **[MASTER_BLUEPRINT.md](docs/MASTER_BLUEPRINT.md)** - Architecture deep dive (16 belgeden türetilmiş)
- **[API_CONTRACTS.md](docs/API_CONTRACTS.md)** - REST API documentation

---

## Contributing

MoonLight is a proprietary system. For internal development:

1. Create feature branch from `develop`
2. Run tests: `yarn test`
3. Run smoke test: `yarn smoke`
4. Submit PR to `develop`

---

## License

Proprietary - MoonLight Trading OS

---

## Contact

For technical support: moonlight-support@example.com
