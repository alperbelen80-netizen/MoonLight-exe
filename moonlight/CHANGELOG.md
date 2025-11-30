# MoonLight Trading OS - Change Log

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
