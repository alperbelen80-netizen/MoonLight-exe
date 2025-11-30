# MoonLight Trading OS v1.3

**Enterprise-Grade Algorithmic Trading Platform — Desktop Application**

---

## 📢 Deployment Strategy

**MoonLight v1.3 is a desktop-only application.**

### Official Deployment Target

- **Platform:** Windows 10/11 (64-bit)
- **Architecture:** Local backend + Electron desktop client
- **Backend Services:** Node.js + NestJS (runs locally)
- **Database:** SQLite (local file)
- **Queue:** Redis (local instance)
- **Client:** Electron desktop app

### Why Not Kubernetes/Cloud?

MoonLight's current architecture is optimized for desktop deployment:

1. **Electron Desktop UI:** Built for Windows/Mac native experience, not web browsers
2. **SQLite Database:** File-based database designed for single-user, local access
3. **Redis Job Queues:** Requires external Redis instance (not provided by typical web platforms)
4. **Low-Latency Requirements:** Trading algorithms benefit from local execution (no network hops)
5. **Data Privacy:** All data stays on owner's machine (no cloud storage)

### Future Roadmap (Hybrid Architecture)

**Option 3 - Remote Backend + Local Client** is a possible v2.0+ direction:

**Phase 1:** Database migration (SQLite → MongoDB cluster)
**Phase 2:** Queue refactor (Redis → managed message queue or external Redis cluster)
**Phase 3:** API hardening (authentication, multi-user support)
**Phase 4:** Deploy backend to Kubernetes, keep Electron as local control panel

**Estimated effort:** 8-12 weeks

**Benefits:**
- Centralized data & backtests
- Multi-device access to Owner Console
- Scalable strategy execution

**Trade-offs:**
- Increased latency (network roundtrip)
- Dependency on cloud infrastructure
- More complex deployment & security

For now, **desktop-only is the supported and recommended deployment mode**.

---

## What's New in v1.3

**✅ Backtest Console:**
- Complete backtest run history
- Advanced filtering (symbol, TF, strategy, environment, hardware profile, date range, WR, PnL, tags)
- Tags & notes for organization
- Favorite marking
- Direct links to advanced reports & Excel export

**✅ PNL History & Timeline:**
- Daily PnL tracking (7d/30d/90d)
- LIVE vs SANDBOX comparison
- Blocked trade metrics (by risk, EV, hardware profile)
- Visual timeline chart

**✅ Enhanced Owner Dashboard:**
- Environment badge (LIVE/SANDBOX)
- Hardware profile indicator (SAFE/BALANCED/MAXPOWER)
- Pack/Gating telemetry preview
- Execution health metrics

---

## Quick Start

### For Developers

See **[WINDOWS_SETUP.md](docs/WINDOWS_SETUP.md)** for detailed setup instructions.

```bash
# 1. Install dependencies
yarn install

# 2. Configure environment
copy backend\.env.example backend\.env
copy desktop\.env.example desktop\.env

# 3. Start development servers
yarn dev

# Backend: http://localhost:8001
# Desktop: http://localhost:5173
```

### For End Users (Owner)

See **[QUICKSTART_OWNER.md](docs/QUICKSTART_OWNER.md)** for operational guide.

1. Install **MoonLight-Owner-Console-Setup-1.3.0.exe**
2. Ensure Redis is running
3. Launch MoonLight from Start Menu
4. Configure broker accounts (FakeBroker for testing)
5. Set execution mode (OFF → AUTO → GUARD as you gain confidence)

---

## Architecture

**Backend (NestJS):**
- Runtime: Node.js 20
- Framework: NestJS 10
- Database: SQLite (trade logs, config, backtest results)
- Time-series: Parquet (OHLCV data)
- Queue: Redis + Bull
- Language: TypeScript (strict mode)

**Desktop (Electron + React):**
- Framework: Electron 28
- UI: React 18 + TypeScript
- Styling: TailwindCSS
- State: Zustand
- Bundler: Vite

---

## Core Features

**Trading Engine:**
- 60+ pre-built strategies (scalping, mean revert, trend follow)
- EVVetoSlot Engine: Intelligent expiry slot selection
- PackFactory: Strategy ensemble & weighted scoring
- Gating: Single-expert selection from multi-strategy signals

**Risk Management:**
- Triple-Check risk layer (U1/U2/U3 uncertainty scoring)
- M3 Defensive mechanism (AUTO/GUARD/ANALYSIS modes)
- Circuit Breaker (L1/L2/L3) & Fail-Safe
- DayCap, loss streak, exposure limits

**Backtest & Analysis:**
- Historical data backtesting
- Advanced metrics (Sharpe, Profit Factor, expectancy)
- Equity curve visualization
- CSV/XLSX export
- Backtest Console (v1.3)

**Owner Console:**
- Real-time dashboard
- Execution mode control
- Kill-switch (emergency stop)
- Product execution matrix
- Alert & health monitoring
- Approval queue (GUARD mode)
- Data quality dashboard
- **Backtest history & filtering (v1.3)**
- **PNL timeline (v1.3)**

---

## Testing

### Run All Tests

```bash
cd backend
yarn test
```

**Coverage:** 25+ test suites, 96+ tests

### Smoke Test

```bash
yarn smoke

# Or
.\scripts\run-smoke.ps1
```

**Checks:**
- Backend health
- Owner API
- Backtest runs API
- PNL history API
- Data health matrix
- Alerts API

---

## Production Build

### Backend

```bash
cd backend
yarn build
```

Output: `backend/dist/`

### Desktop Installer

```bash
cd desktop
yarn dist
```

Output: `desktop/dist/MoonLight-Owner-Console-Setup-1.3.0.exe`

Or from root:

```bash
yarn package:desktop
```

---

## Project Structure

```
moonlight/
├── backend/              # NestJS backend
│   ├── src/
│   │   ├── execution/      # Execution pipeline, FSM, reconciliation
│   │   ├── risk/           # ART, Triple-Check, Circuit Breaker, Fail-Safe
│   │   ├── strategy/       # Strategy factory, indicators, EVVetoSlot, PackFactory, Gating
│   │   ├── backtest/       # Backtest engine, replay runner
│   │   ├── data/           # Data capture, resample, Auto-Inspector
│   │   ├── broker/         # Broker adapters (FakeBroker)
│   │   ├── owner/          # Owner API, dashboard, history
│   │   ├── alerts/         # Alerts module
│   │   └── reporting/      # Advanced reporting, Excel export
│   └── tests/
├── desktop/             # Electron + React
│   ├── main/            # Electron main process
│   └── renderer/        # React UI
│       ├── src/
│       │   ├── pages/      # Dashboard, Accounts, Matrix, Alerts, Data Health, Backtests
│       │   ├── components/ # UI components
│       │   ├── stores/     # Zustand stores
│       │   └── api/        # API clients
├── data/                # Data storage
│   ├── db/              # SQLite database
│   ├── raw/             # Raw Parquet data
│   ├── bars/            # Resampled bars
│   ├── sim/             # Simulation results
│   └── reports/         # Generated reports
├── docs/                # Documentation
├── scripts/             # Helper scripts
└── .github/workflows/   # CI/CD (for reference)
```

---

## Known Limitations (v1.3)

**Broker Support:**
- ⚠️ FakeBroker only (simulated trading)
- Real broker adapters (IQ Option, Olymp Trade, Binomo, Expert Option) planned for v2.0 (QUAD-CORE)

**Multi-User:**
- Single owner scenario
- No user authentication/authorization

**Data Sources:**
- Manual Parquet import
- TradingView webhook integration planned but not active

**Deployment:**
- Desktop-only (no cloud/Kubernetes deployment)
- Requires local Redis instance

**Performance:**
- SQLite suitable for single-user workloads
- For high-frequency scenarios, database optimization may be needed

---

## API Endpoints (v1.3)

### Owner API
- `GET /owner/dashboard/summary` - Dashboard metrics
- `GET /owner/accounts` - Broker accounts
- `GET /owner/execution-matrix` - Product/TF config
- `GET /owner/execution-mode` - Global mode
- `POST /owner/execution-mode` - Change mode
- `GET /owner/history/pnl` - PNL timeline (NEW)

### Backtest API
- `POST /backtest/run` - Start backtest
- `GET /backtest/runs` - List with filters (NEW)
- `GET /backtest/runs/:id` - Run details (NEW)
- `POST /backtest/runs/:id/tags` - Update tags (NEW)
- `POST /backtest/runs/:id/notes` - Update notes (NEW)
- `POST /backtest/runs/:id/favorite` - Toggle favorite (NEW)
- `GET /backtest/status/:runId` - Check status
- `GET /backtest/detail/:runId` - Detailed results

### Reporting API
- `GET /reporting/backtest/:runId/advanced` - Advanced metrics
- `GET /reporting/backtest/:runId/export/csv` - CSV export
- `GET /reporting/backtest/:runId/export/xlsx` - Excel export

### Risk API
- `POST /risk/kill-switch/activate` - Emergency stop
- `POST /risk/kill-switch/deactivate` - Resume
- `GET /risk/approval/pending` - Approval queue

### Alerts API
- `GET /alerts` - List alerts
- `POST /alerts/:id/ack` - Acknowledge
- `POST /alerts/:id/resolve` - Resolve

### Data API
- `GET /data/health/matrix` - Data quality matrix

---

## Documentation

- **[WINDOWS_SETUP.md](docs/WINDOWS_SETUP.md)** - Windows installation & setup guide
- **[QUICKSTART_OWNER.md](docs/QUICKSTART_OWNER.md)** - Owner operational guide
- **[MASTER_BLUEPRINT.md](docs/MASTER_BLUEPRINT.md)** - Architecture deep dive (16 documents)

---

## Version History

**v1.3 (Current)** - Backtest Console & PNL History
- Backtest run management & filtering
- Tags, notes, favorites
- Daily PNL timeline
- LIVE vs SANDBOX tracking

**v1.2** - Hardware Profiles & Telemetry
- SAFE/BALANCED/MAXPOWER profiles
- Environment service (LIVE/SANDBOX)
- Pack/Gating telemetry

**v1.1** - EVVetoSlot & Data Health
- Intelligent slot selection
- PackFactory & Gating
- Data quality dashboard

**v1.0** - Core Platform
- Execution pipeline
- Risk management (Triple-Check, M3, Circuit Breaker)
- Backtest engine
- Owner Console (Dashboard, Accounts, Matrix, Alerts)

---

## License

Proprietary - MoonLight Trading OS

---

## Contact

For technical support: moonlight-support@example.com
