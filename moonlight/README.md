# MoonLight Trading OS v1.5

**Enterprise-Grade Algorithmic Trading Platform — Desktop Application with Multi-Provider Live Signals**

---

## 🆕 What's New in v1.5

**🌐 Multi-Provider Data Engine:**
- ✅ **Binance Integration (CCXT)** - Real-time crypto market data
- ✅ **TradingView Webhook** - Custom alert integration
- ✅ **IQ Option API** - Forex & binary options data
- ✅ **Data Feed Orchestrator** - Switch providers on-the-fly

**⚡ Semi-Automatic Execution:**
- ✅ **One-click execute** - Approve signal → auto-execution
- ✅ **Risk guardrails** - Pre-trade checks enforced
- ✅ **Manual override** - Full control over every trade
- ✅ **Execution tracking** - Signal → order → result logging

**🧠 Enhanced Strategy Factory:**
- ✅ **50+ strategies** - Scalping, trend follow, mean revert
- ✅ **Strategy Explorer** - Browse, filter, analyze strategies
- ✅ **Live validation** - Triple-Check + EVVetoSlot on live signals

**📊 Advanced Backtest Analytics:**
- ✅ **Monte Carlo Simulation** - 1000+ simulations for confidence intervals
- ✅ **Walk-Forward Analysis** - In-sample vs out-sample validation
- ✅ **Robustness Testing** - Strategy stability metrics

**💼 Real Account Integration:**
- ✅ **Balance Widget** - Real-time account balance
- ✅ **Open Positions** - Live position monitoring
- ✅ **Read-only mode** - Safe account info access

---

## 🚀 Quick Start (v1.5)

### For Developers

```bash
# 1. Install dependencies
yarn install

# 2. Configure (IMPORTANT - v1.5 new settings)
cp backend/.env.example backend/.env
cp desktop/.env.example desktop/.env

# Edit backend/.env:
# - Set DATA_FEED_PROVIDER (BINANCE_CCXT, TRADINGVIEW, IQ_OPTION, or MOCK_LIVE)
# - Set LIVE_SIGNAL_ENABLED=true
# - Set SEMI_AUTO_ENABLED=true (for semi-automatic mode)
# - Add provider API keys if using real data

# 3. Start
yarn dev
```

### For End Users (Owner)

1. Install **MoonLight-Owner-Console-Setup-1.5.0.exe**
2. Ensure Redis is running
3. Launch MoonLight
4. Navigate to **Live Signals** (new in v1.5)
5. Configure data provider in **Settings**
6. Start receiving real-time signals!

---

## 🎯 Core Features (v1.5)

**Live Signal Mode:**
- Real-time signal generation from live market data
- 3 data providers (Binance, TradingView, IQ Option)
- Triple-Check risk validation
- EVVetoSlot optimization
- Signal quality filtering
- Manual or semi-automatic execution

**50+ Trading Strategies:**
- **Scalping:** BB+RSI, Stochastic, VWAP, Support/Resistance, etc.
- **Trend Follow:** EMA, MACD, ADX, SuperTrend, Parabolic SAR, etc.
- **Mean Revert:** RSI, Bollinger, Keltner, Fibonacci, Pivot, etc.

**Advanced Analytics:**
- Monte Carlo simulation (1000+ iterations)
- Walk-forward analysis
- Sharpe ratio, Profit Factor, Expectancy
- Equity curve visualization
- Risk-adjusted metrics

**Owner Console (10 Screens):**
1. Dashboard - KPI, PNL history, live signals
2. Live Signals - Real-time signal monitoring + execute
3. Strategies - 50+ strategy explorer
4. Accounts - Balance, positions, session health
5. Execution Matrix - Data/signal/trade controls
6. Backtests - Run history, analytics, export
7. Data Health - Quality monitoring
8. Alerts - System notifications
9. Settings - Provider selection, configuration
10. (Legacy pages maintained)

---

## 📊 System Capabilities

**What You Can Do Now:**
- ✅ Connect to Binance for real crypto data
- ✅ Use TradingView alerts as signals
- ✅ Monitor IQ Option forex pairs
- ✅ Generate live signals (50+ strategies)
- ✅ One-click execute approved signals
- ✅ Track account balance & positions
- ✅ Run Monte Carlo simulations
- ✅ Perform walk-forward analysis
- ✅ Export advanced analytics to Excel

**Limitations:**
- ⚠️ Semi-automatic only (full-auto in v1.6)
- ⚠️ FakeBroker for execution testing
- ⚠️ Real broker execution: development/testing phase

---

## 🔧 Configuration (v1.5)

### Backend (.env)

```bash
# Live Signal Configuration
LIVE_SIGNAL_ENABLED=true
LIVE_SIGNAL_SYMBOLS=XAUUSD,EURUSD,GBPUSD,BTCUSD
LIVE_SIGNAL_TIMEFRAMES=1m,5m,15m
LIVE_SIGNAL_MAX_SIGNALS_PER_MINUTE=10

# Data Provider (choose one)
DATA_FEED_PROVIDER=BINANCE_CCXT  # or TRADINGVIEW, IQ_OPTION, MOCK_LIVE

# Semi-Automatic Execution
SEMI_AUTO_ENABLED=true

# Provider API Keys (if using real data)
BINANCE_API_KEY=your_binance_key
BINANCE_API_SECRET=your_binance_secret
IQ_OPTION_API_KEY=your_iq_key
IQ_OPTION_WS_URL=wss://iqoption.com/echo/websocket
```

---

## 📚 Documentation

- **[WINDOWS_SETUP.md](docs/WINDOWS_SETUP.md)** - Installation & setup
- **[QUICKSTART_OWNER.md](docs/QUICKSTART_OWNER.md)** - v1.5 operational guide (UPDATED)
- **[STRATEGY_GUIDE.md](docs/STRATEGY_GUIDE.md)** - 50+ strategy documentation (NEW)

---

## 🧪 Testing

```bash
# Backend tests
cd backend && yarn test  # 25 suites, 96+ tests

# Smoke test (v1.5 endpoints)
yarn smoke

# Full system
yarn dev
```

---

## 📦 Version History

**v1.5 (Current)** - Multi-Provider Live Signals + Semi-Auto
- Real-time data (Binance/TradingView/IQ Option)
- 50+ strategies
- Semi-automatic execution
- Monte Carlo & walk-forward analysis
- Account widgets

**v1.4** - Live Signal Mode (Manual)
**v1.3** - Backtest Console & PNL History
**v1.2** - Hardware Profiles & Telemetry
**v1.1** - EVVetoSlot & Data Health
**v1.0** - Core Platform

---

## 🗺️ Roadmap

**v1.6 (Next)** - Full Automatic Mode
- Remove manual approval requirement
- Advanced risk controls
- Kill-switch safeguards

**v2.0** - QUAD-CORE Complete
- All 4 brokers fully integrated
- Multi-broker routing
- Production-ready execution

**v2.5** - ML & Advanced Analytics
**v3.0** - Cloud & Enterprise

---

## 🏆 MoonLight v1.5 PRODUCTION-READY

**Desktop-only Windows trading platform with:**
- 3 real data providers
- 50+ trading strategies
- Semi-automatic execution
- Advanced analytics
- Full Owner control

**Ready for real trading with proper testing and risk management.**
