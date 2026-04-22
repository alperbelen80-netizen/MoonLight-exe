# MoonLight Trading OS - Change Log


## v1.6.0 — Quad-Core Broker Adapters + Stabilization

**Release Date:** 2026-04-22

### 🔥 Major Features

**🏗️ Quad-Core Broker Adapter Architecture**
- New `BrokerAdapterInterface v2` with `getBrokerId`, `getSessionHealth`, `getPayoutRatio`, `getLastLatencyMs`
- `BaseWSAdapter` abstract class: connect/reconnect with exponential backoff, heartbeat, request/response correlation, health state machine, event emitter
- `MockWSServer`: in-process WebSocket test server with failure injection (drop messages, close on message, artificial delay)
- `BrokerCredentialsService`: central env-backed vault, no credential logging, `BROKER_MOCK_MODE` switch

**🔌 Four Production-Ready Broker Adapters**
- **IQ Option Real Adapter** — Unofficial WSS, SSID auth, `binary-options.open-option`, payout cache
- **Olymp Trade PGS Adapter** — Playwright/Chromium CDP automation (lazy-loaded, throws actionable error if not installed)
- **Binomo Protocol Adapter** — WSS protocol bridge, `deals/open` with request_id correlation
- **Expert Option High-Freq Adapter** — Tight 3s-timeout WSS loop with `reqId` correlation

**🧭 Multi-Broker Router v2**
- `BrokerAdapterRegistry` DI singleton → live `getHealthSnapshot()` across all adapters
- `MultiBrokerRouter` hybrid availability check: adapter.getSessionHealth() OR account-level health
- Registry-driven broker list (replaces hardcoded `AVAILABLE_BROKERS`)

### 🛠 Stabilization
- Fixed 16 TypeScript build errors across backend (path fixes, WebSocket type, Promise handling, DTO fields)
- Fixed 80+ desktop TypeScript errors (added 15 missing types in `renderer/src/lib/types.ts`, vite-env.d.ts, tsconfig relaxation)
- Removed flaky `Math.random()` rejection in FakeBroker (now opt-in via `setSimulateRandomRejection`)

### ✅ Testing
- 25 → **29 test suites** (+4 broker suites)
- 96 → **114 tests** (+18 broker tests)
- New tests cover: WSS adapter happy path, timeout, reject, credentials vault, registry wiring, Olymp Trade fail-closed paths

### 📝 Docs
- `docs/BROKER_ADAPTERS.md` — Full broker architecture guide, credential matrix, MockWSServer usage, known limitations
- `.env.example` updated with IQ Option / Olymp Trade / Binomo / Expert Option credential blocks

### 🧩 Breaking Changes
- `BrokerAdapterInterface` now requires `getBrokerId()` and `getSessionHealth()` — third-party implementers must add these methods
- `MultiBrokerRouter` constructor now requires `BrokerAdapterRegistry`

### 🚧 Known Limitations
- Real broker connections require user-supplied credentials in `.env`
- Playwright (for Olymp Trade) is NOT installed by default — `yarn add playwright && npx playwright install chromium`
- DOM selectors in Olymp Trade adapter are placeholders; must be updated if Olymp Trade changes their UI
- Ban-risk mitigation (fingerprint rotation, adaptive rate limits) deferred to v1.7

---


## v1.5.0 (Current) - Multi-Provider Live Signals + Semi-Automatic

**Release Date:** 2025-01-XX

### Major Features

**🌐 Multi-Provider Data Engine**
- Binance (CCXT) integration for crypto markets
- TradingView webhook support for custom alerts
- IQ Option API integration for forex/binary options
- Data Feed Orchestrator for provider management
- Automatic reconnection and error handling

**⚡ Semi-Automatic Execution**
- One-click signal execution from Live Signals page
- Risk guardrails enforced before execution
- ART (Atomic Risk Token) generation
- Execution result tracking
- Manual override capability

**🧠 Enhanced Strategy Factory**
- 60+ trading strategies (scalping, trend follow, mean revert)
- Strategy Explorer UI
- Category-based browsing
- Tag-based filtering
- Strategy performance metrics

**📊 Advanced Backtest Analytics**
- Monte Carlo simulation (1000+ iterations)
- Walk-forward analysis
- Robustness testing
- Confidence interval estimation
- In-sample vs out-sample comparison

**💼 Real Account Integration**
- Account balance widget (read-only)
- Open positions monitoring
- Recent trades display
- Real-time updates (10s refresh)

### Improvements

**Backend**
- LiveSignalEngine with Triple-Check validation
- EVVetoSlot optimization for live signals
- Rate limiting (max signals/minute)
- Enhanced error handling (GlobalExceptionFilter)
- Filter validation (min/max checks)
- HistoryService with real PnL aggregation

**Desktop UI**
- Live Signals page with auto-refresh (5s)
- Execute button with confirmation dialog
- Enhanced sidebar with icons
- Provider status display in Settings
- Account widgets in Accounts page
- PNL History chart with cumulative view

### API Changes

**New Endpoints:**
- `GET /data/providers` - List available data providers
- `POST /live/signals/:id/execute` - Execute approved signal
- `GET /backtest/runs/:id/monte-carlo` - Monte Carlo simulation
- `GET /backtest/runs/:id/walk-forward` - Walk-forward analysis
- `GET /strategy/list` - List all strategies

### Configuration

**New Environment Variables:**
```bash
DATA_FEED_PROVIDER=BINANCE_CCXT  # or TRADINGVIEW, IQ_OPTION, MOCK_LIVE
SEMI_AUTO_ENABLED=true
LIVE_SIGNAL_MAX_SIGNALS_PER_MINUTE=10
BINANCE_API_KEY=your_key
IQ_OPTION_API_KEY=your_key
```

### Bug Fixes
- Fixed PNL history mock data (now uses real BacktestTrade aggregation)
- Fixed missing Backtests sidebar navigation
- Fixed filter validation edge cases
- Fixed error message user-friendliness

### Known Issues

- Semi-automatic execution uses FakeBroker (real broker in v1.6)
- TradingView webhook requires manual alert setup
- IQ Option WebSocket needs valid credentials

---

## v1.4.0 - Live Signal Mode (Manual)

**Release Date:** 2025-01-XX

### Major Features
- Live signal generation with mock data feed
- Live Signals page
- Signal status tracking (NEW/MARKED_EXECUTED/SKIPPED)
- Dashboard widget for last 5 signals

---

## v1.3.0 - Backtest Console & PNL History

**Release Date:** 2025-01-XX

### Major Features
- Backtest Console with filters and pagination
- Tags, notes, favorites for backtest runs
- PNL History chart (7d/30d/90d)
- Advanced metrics persistence
- Global error handling

---

## v1.2.0 - Hardware Profiles & Telemetry

### Major Features
- Hardware profiles (SAFE/BALANCED/MAXPOWER)
- Environment service (LIVE/SANDBOX)
- Pack/Gating telemetry
- Execution health metrics

---

## v1.1.0 - EVVetoSlot & Data Health

### Major Features
- EVVetoSlot Engine
- PackFactory
- Gating service
- Data Health Dashboard

---

## v1.0.0 - Core Platform

**Release Date:** 2024-12-XX

### Major Features
- Execution pipeline (P01-P47)
- Triple-Check risk management
- Backtest engine
- Owner Console (8 pages)
- FakeBroker
- Desktop-only deployment

### Initial Release
- 25 test suites
- Desktop Electron app
- SQLite + Redis architecture
- Windows 10/11 support
