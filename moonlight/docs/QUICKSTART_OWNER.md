# MoonLight Owner Console - Quickstart Guide

**Target Audience:** MoonLight Owner (non-developer)

---

## What is MoonLight?

MoonLight is your **automated trading assistant** for fixed-time (binary/turbo) markets. It helps you:

- Execute **60+ pre-built trading strategies** automatically
- Manage **risk** with circuit breakers and fail-safes
- Monitor **live trades** and performance
- Run **backtests** to validate strategies before going live
- Control everything from a **single desktop app**

---

## Installation

### Option 1: Using Installer (Recommended)

1. Download **MoonLight-Owner-Console-Setup-1.0.0.exe**
2. Run the installer
3. Follow on-screen instructions
4. Launch "MoonLight Owner Console" from Start Menu or Desktop shortcut

### Option 2: Development Mode

If you have the source code:

```bash
# Open PowerShell in project root
.\scripts\start-dev.ps1
```

This will start both backend and desktop UI.

---

## First Launch

### Step 1: Dashboard Overview

When you first open MoonLight, you'll see the **Dashboard**:

- **Health Score:** Overall system health (0-100)
  - 🟢 **GREEN (80-100):** System performing well
  - 🟡 **AMBER (60-79):** Watch mode
  - 🔴 **RED (40-59):** Issues detected
  - ⚫ **BLACKOUT (<40):** Critical problems

- **KPI Cards:**
  - **Win Rate (7d):** Your recent success rate
  - **PnL Today:** Daily profit/loss
  - **Trades Today:** Number of trades executed
  - **Pending Approvals:** Trades waiting for your decision (GUARD mode)

### Step 2: Execution Mode

Top-right corner shows **Execution Mode**:

- 🔴 **OFF:** System is paused, no trading
- 🟢 **AUTO:** Fully automatic (strategies execute trades without approval)
- 🟡 **GUARD:** Semi-automatic (high-uncertainty trades need your approval)
- 🔵 **ANALYSIS:** Dry-run mode (simulates but doesn't execute)

**How to change mode:**
1. Click on the mode buttons (OFF/AUTO/GUARD/ANALYSIS)
2. Confirm the change
3. System updates immediately

**⚠ WARNING:** Switching to AUTO means trades will execute automatically. Make sure you understand your risk settings first!

---

## Understanding the Kill-Switch

**What is it?**
The **Kill-Switch** is an emergency stop button. When activated:
- ALL automatic trading stops immediately
- Existing open positions remain (they will close at expiry)
- System enters Circuit Breaker L3 (GLOBAL HALT)

**When to use:**
- Market is behaving unexpectedly
- You see unexpected losses
- You want to pause and review settings
- Technical issues detected

**How to activate:**
1. Click **"Activate Kill-Switch"** (red button, top-right)
2. Confirm (this action is logged)
3. System halts all new trades

**How to deactivate:**
1. Click **"Deactivate Kill-Switch"** (yellow button when active)
2. Confirm
3. System resumes based on current Execution Mode

---

## Managing Broker Accounts

### Viewing Accounts

Go to **Accounts** page (left sidebar):

- See all connected broker accounts
- Check **Session Health:**
  - 🟢 **UP:** Connection stable
  - 🟡 **DEGRADED:** Minor issues
  - 🔵 **RECONNECTING:** Attempting to reconnect
  - 🟠 **COOLDOWN:** Temporary pause (will retry soon)
  - 🔴 **DOWN:** Connection lost

### Adding an Account

1. Click **"Add Account"** button
2. Fill in:
   - **Alias:** Friendly name (e.g., "My Olymp Real Account")
   - **Broker:** Select broker (FakeBroker for testing)
   - **Type:** REAL, DEMO, SIM_INTERNAL, or READ_ONLY
3. Save
4. Account appears in table

**Note:** v1.0 uses FakeBroker for testing. Real broker integration coming in v1.1.

---

## Product Execution Matrix

### What is it?

The **Execution Matrix** lets you control which products (symbols) and timeframes (TF) are:
- Collecting data
- Generating signals
- Executing trades

### How to use:

Go to **Execution Matrix** page:

1. See table with columns:
   - **Symbol** (e.g., XAUUSD, EURUSD)
   - **TF** (1m, 5m, 15m, etc.)
   - **Data** ☐ (checkbox)
   - **Signal** ☐ (checkbox)
   - **Auto-Trade** ☐ (checkbox)

2. **Toggle checkboxes:**
   - **Data OFF:** System stops capturing data for this product/TF
   - **Signal OFF:** Strategies won't generate signals for this product/TF
   - **Auto-Trade OFF:** Signals generate but trades don't execute (manual review only)

**Use Case Example:**

You want to analyze EURUSD 5m but not trade it yet:
- Data: ☑ ON
- Signal: ☑ ON
- Auto-Trade: ☐ OFF

Signals will appear in logs/reports, but no actual trades will execute.

---

## Alerts & Health Center

### What are Alerts?

Alerts notify you when:
- Circuit breakers trigger (DayCap exceeded, loss streak, etc.)
- Session health degrades
- Reconciliation finds mismatches
- Kill-switch is activated/deactivated

### Severity Levels:

- 🔴 **CRITICAL:** Immediate attention needed (e.g., kill-switch, DayCap exceeded)
- 🟡 **WARNING:** Watch closely (e.g., session degraded, loss streak approaching limit)
- 🔵 **INFO:** Informational (e.g., backtest completed, config changed)

### Managing Alerts:

1. Go to **Alerts** page
2. Filter by severity or status
3. Click **ACK** (acknowledge) to mark as seen
4. Click **RESOLVE** to close the alert

---

## Approval Queue (GUARD Mode)

### What is GUARD mode?

In **GUARD mode**, high-uncertainty trades require your manual approval before execution.

### How it works:

1. Set Execution Mode to **GUARD**
2. When a trade signal is uncertain (U2 or U3 HIGH), it goes to **Approval Queue**
3. You see:
   - Symbol, TF, direction (CALL/PUT)
   - Expected Value (EV)
   - Confidence score
   - Uncertainty level (LOW/MEDIUM/HIGH)
   - Reason summary
4. You decide:
   - **APPROVE:** Trade executes
   - **REJECT:** Trade is cancelled

**Approval Queue Panel:**
- Visible on Dashboard (top pending items)
- Full list in Alerts page (Approval Queue tab)

---

## Risk Settings (Advanced)

**Note:** v1.0'da risk settings API var ama UI tam değil. İleride:

- DayCap (daily loss limit)
- Max lot per symbol
- Loss streak limit
- Cooldown periods

Owner Console'da ayarlanabilir olacak.

Şimdilik varsayılan ayarlar:
- DayCap: $500/day
- Max lot: $50/trade
- Loss streak: 5 consecutive losses → PAUSE

---

## Running Backtests

### From API (for now):

```bash
curl -X POST http://localhost:8001/backtest/run \
  -H "Content-Type: application/json" \
  -d '{
    "symbols": ["XAUUSD"],
    "timeframes": ["1m"],
    "strategy_ids": ["bb_rsi_buy_v1"],
    "from_date": "2025-01-01",
    "to_date": "2025-01-31",
    "initial_balance": 1000,
    "risk_profile_id": "PROFILE_DEFAULT",
    "environment": "BACKTEST"
  }'
```

### Check Results:

```bash
curl http://localhost:8001/backtest/status/<runId>
curl http://localhost:8001/reporting/backtest/<runId>/advanced
```

### Export to Excel:

Navigate to:
```
http://localhost:8001/reporting/backtest/<runId>/export/xlsx
```

File downloads automatically.

**UI for backtest:** Coming in v1.1 (Backtest page in Owner Console).

---

## Troubleshooting

### Backend won't start

**Problem:** "Redis connection error"

**Solution:**
- Make sure Redis is running (port 6379)
- Windows: Use Redis for Windows or WSL2

### Desktop app won't connect to backend

**Problem:** "API Error: Network request failed"

**Solution:**
- Check backend is running: http://localhost:8001/owner/dashboard/summary
- Verify `desktop/.env` has `VITE_API_BASE_URL=http://localhost:8001`

### Execution Mode stuck on OFF

**Problem:** Can't switch to AUTO

**Solution:**
- Check Circuit Breaker state (GET /risk/circuit-breaker/state)
- If kill-switch is active, deactivate it first
- Check alerts for fail-safe triggers

### No data in Dashboard

**Problem:** All metrics show 0

**Solution:**
- v1.0 uses FakeBroker, so no real trades yet
- Run a backtest to generate sample data
- Or wait for live trades in AUTO mode with FakeBroker

---

## Support

For technical issues:
- Check logs: `backend/*.log`
- Run smoke test: `yarn smoke`
- Review alerts in Owner Console

For operational questions:
- See **[README.md](../README.md)** for architecture details
- Contact: moonlight-support@example.com

---

**MoonLight v1.0 - Production-Ready Owner Console** ✅
