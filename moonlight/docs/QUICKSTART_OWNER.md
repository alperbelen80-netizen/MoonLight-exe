# MoonLight Owner Console v1.5 - Quickstart Guide

**Target Audience:** MoonLight Owner (Trading System User)

---

## What's New in v1.5?

### 🌐 Multi-Provider Live Data

You can now connect to **real market data** from:
- **Binance** - Crypto markets (BTC, ETH, etc.)
- **TradingView** - Custom alerts for any market
- **IQ Option** - Forex & binary options

### ⚡ Semi-Automatic Execution

Instead of just seeing signals, you can now:
1. Review the signal
2. Click **"EXECUTE"** button
3. System automatically places the order for you

### 🧠 50+ Strategies

Strategy library expanded:
- 15+ Scalping strategies
- 22+ Trend Following strategies
- 12+ Mean Reversion strategies

---

## Getting Started with Live Signals

### Step 1: Enable Live Signal Mode

1. Open MoonLight Owner Console
2. Go to **Settings** page
3. Check "Data Feed Provider" section
4. Verify provider is connected (green dot)

### Step 2: Configure Symbols & Timeframes

Edit `backend/.env` file:

```bash
LIVE_SIGNAL_SYMBOLS=XAUUSD,EURUSD,BTCUSD
LIVE_SIGNAL_TIMEFRAMES=1m,5m,15m
```

Restart backend for changes to take effect.

### Step 3: Monitor Live Signals

1. Go to **Live Signals** page (sidebar)
2. You'll see real-time signals as they're generated
3. Each signal shows:
   - Time
   - Symbol (e.g., XAUUSD)
   - Direction (CALL/PUT or BUY/SELL)
   - Confidence score
   - Strategy name
   - Status

### Step 4: Execute a Signal (Semi-Auto)

**Option A: One-Click Execute**
1. Click on a signal row (opens detail drawer)
2. Review signal details
3. Click **"⚡ OTOMATİĞE ÇALIŞTIR"** button
4. Confirm execution
5. System sends order to broker
6. Signal status → MARKED_EXECUTED

**Option B: Manual Execute**
1. Review signal
2. Open your broker platform manually
3. Place order yourself
4. Click **"Manuel Girdim"** button
5. Signal marked as executed

**Option C: Skip**
1. Click **"Atladım"** button
2. Signal marked as skipped

---

## Understanding Data Providers

### Binance (CCXT)

**Best for:** Cryptocurrency trading

**Supported symbols:**
- BTC/USDT, ETH/USDT, BNB/USDT
- XAU/USD (gold)
- Major crypto pairs

**Setup:**
```bash
DATA_FEED_PROVIDER=BINANCE_CCXT
BINANCE_API_KEY=your_key  # optional for public data
```

### TradingView

**Best for:** Any market (stocks, forex, crypto, commodities)

**How it works:**
1. Create alert in TradingView
2. Set webhook URL to MoonLight backend
3. MoonLight receives alert → generates signal

**Setup:**
```bash
DATA_FEED_PROVIDER=TRADINGVIEW
# No API key needed
# Configure webhook in TradingView:
# http://localhost:8001/webhook/tradingview/{symbol}/{timeframe}
```

### IQ Option

**Best for:** Binary options, forex

**Supported symbols:**
- EUR/USD, GBP/USD, USD/JPY
- XAU/USD (gold)
- Major forex pairs

**Setup:**
```bash
DATA_FEED_PROVIDER=IQ_OPTION
IQ_OPTION_API_KEY=your_api_key
IQ_OPTION_WS_URL=wss://iqoption.com/echo/websocket
```

---

## Using Semi-Automatic Mode

### What is Semi-Automatic?

Instead of manually opening every trade, you:
1. Review signals as they come
2. Approve the ones you like
3. System executes them for you

### Safety Features

**Before execution, system checks:**
- ✅ Risk guardrails (DayCap, max lot)
- ✅ Triple-Check uncertainty
- ✅ Circuit breaker status
- ✅ Account balance

**If any check fails:**
- ❌ Execution blocked
- 📝 Reason logged
- 🔔 Owner notified

### Execution Workflow

```
Signal Generated → Triple-Check → EVVetoSlot → 
  ↓
Owner Reviews in Live Signals
  ↓
Owner Clicks "EXECUTE"
  ↓
Risk Guardrails Check → ART Token → Broker Order
  ↓
Order Confirmed → Signal Status Updated
```

---

## Advanced Features

### Monte Carlo Simulation

**What it does:** Runs 1000+ simulations of your backtest with randomized trade order.

**How to use:**
1. Go to Backtests page
2. Click on a backtest run
3. In detail drawer, click "Monte Carlo"
4. View confidence intervals (5th-95th percentile)

**Interpretation:**
- **Expected PnL:** Average across simulations
- **5th percentile:** Worst-case scenario
- **95th percentile:** Best-case scenario

### Walk-Forward Analysis

**What it does:** Tests if strategy works on unseen data.

**How to use:**
1. Backtests page → select run
2. Click "Walk-Forward"
3. View in-sample vs out-sample performance

**Interpretation:**
- **Degradation < 5%:** Robust strategy ✅
- **Degradation > 10%:** Overfitting risk ⚠️

---

## Strategy Explorer

**New in v1.5:** Browse all 50+ strategies

**How to use:**
1. Go to **Strategies** page
2. Filter by:
   - Category (Scalping/Trend/Mean Revert)
   - Search by name
3. View strategy details:
   - Supported symbols
   - Timeframes
   - Tags

**Strategy Categories:**
- **Scalping:** Quick trades, 1-15m timeframes
- **Trend Follow:** Ride momentum, 15m-4h
- **Mean Revert:** Counter-trend, 5m-1h

---

## Troubleshooting (v1.5)

### Live signals not appearing

**Check:**
1. LIVE_SIGNAL_ENABLED=true in backend/.env
2. DATA_FEED_PROVIDER correctly set
3. Backend logs for connection errors
4. Provider API keys (if required)

### Execute button not working

**Check:**
1. SEMI_AUTO_ENABLED=true
2. Signal status is "NEW"
3. Account connected
4. Risk limits not exceeded

### Provider connection issues

**Binance:**
- Check internet connection
- Verify API keys (if private data)
- Check rate limits

**TradingView:**
- Verify webhook URL
- Check TradingView alert configuration

**IQ Option:**
- Verify API credentials
- Check WebSocket connection
- Review session status

---

## Risk Management (v1.5)

### Before Using Semi-Auto

**Set your limits:**
1. DayCap (daily loss limit)
2. Max lot per trade
3. Max concurrent trades

**Default limits (SAFE profile):**
- DayCap: $500/day
- Max lot: $50/trade
- Concurrent trades: 2

**Test first:**
1. Use MOCK_LIVE provider
2. Use FakeBroker
3. Verify signal quality
4. Then switch to real data

---

## Next Steps

**After v1.5 mastery:**
1. **Test with demo accounts** (when available)
2. **Optimize strategy selection** (use backtest analytics)
3. **Fine-tune risk parameters**
4. **Wait for v1.6** (full automatic mode)

---

**MoonLight v1.5 - Real Signals, Real Data, Real Power** 🚀
