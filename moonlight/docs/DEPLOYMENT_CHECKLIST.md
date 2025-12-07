# MoonLight v1.6 - Production Deployment Checklist

## Pre-Deployment

### 1. Configuration Review
- [ ] `.env` files configured (backend + desktop)
- [ ] `policy.yaml` reviewed and approved
- [ ] Hardware profile selected (SAFE/BALANCED/MAXPOWER)
- [ ] Data provider configured (BINANCE_CCXT/TRADINGVIEW/IQ_OPTION)
- [ ] Execution mode set (OFF/AUTO/GUARD/ANALYSIS)

### 2. Security
- [ ] ART_SIGNING_SECRET changed from default
- [ ] TRADINGVIEW_WEBHOOK_SECRET unique
- [ ] Broker API keys secured (if using real brokers)
- [ ] Demo accounts identified
- [ ] Real accounts double-checked

### 3. Risk Limits
- [ ] DayCap set appropriately
- [ ] Max lot per symbol configured
- [ ] Loss streak limit reviewed (default: 5)
- [ ] Concurrent trades limit (SAFE: 2, BALANCED: 5, MAXPOWER: 15)

### 4. Testing
- [ ] `yarn test` - All tests passing
- [ ] `yarn smoke` - Smoke test successful
- [ ] `yarn dev` - System starts without errors
- [ ] Pre-flight checklist passes (console output on startup)

## Deployment Steps

### Backend
1. Build: `cd backend && yarn build`
2. Start: `yarn start` (or Windows Service)
3. Verify: Pre-flight checklist all green
4. Monitor: Check logs for errors

### Desktop
1. Build installer: `cd desktop && yarn dist`
2. Install: Run `.exe` installer
3. Launch: MoonLight Owner Console
4. Verify: All pages load, API connected

## Post-Deployment

### Initial Verification
- [ ] Dashboard loads with correct data
- [ ] Live Signals page shows data (if enabled)
- [ ] Strategies page lists 68 strategies
- [ ] Data Health shows quality metrics
- [ ] Execution mode controllable

### Live Signal Testing (if enabled)
- [ ] Data provider connected (Settings page)
- [ ] Signals generating (Live Signals page)
- [ ] Regime detection working (check signal notes)
- [ ] Strategy performance tracking (Strategies page)

### Execution Testing (Semi-Auto)
- [ ] Select NEW signal
- [ ] Click "EXECUTE" button
- [ ] Confirm dialog appears
- [ ] Execution succeeds or fails with clear message
- [ ] Signal status updates to MARKED_EXECUTED
- [ ] Health score calculated and displayed

### Full-Auto Testing (if enabled)
- [ ] Set execution mode to AUTO
- [ ] Set FULL_AUTO_ENABLED=true
- [ ] Restart backend
- [ ] Signals auto-execute within 10 seconds
- [ ] Safety checks enforced (DayCap, circuit breaker)
- [ ] Kill-switch stops execution immediately

## Monitoring

### Key Metrics
- Win Rate (7d) - Track trend
- PnL Today/7d/30d - Monitor profitability  
- Strategy performance - Identify winners/losers
- Circuit breaker triggers - Review safety events
- Alert count - System health indicator

### Daily Checklist
- [ ] Check alerts (critical first)
- [ ] Review PnL history
- [ ] Monitor data health
- [ ] Check strategy performance
- [ ] Verify execution mode correct
- [ ] Review any circuit breaker events

## Emergency Procedures

### Kill-Switch Activation
1. Click kill-switch button (top-right)
2. Confirm activation
3. All trading stops immediately
4. Review what triggered need for kill-switch
5. Fix underlying issue
6. Deactivate when safe

### Circuit Breaker Triggered
1. Check Alerts page for details
2. Identify trigger (DayCap, loss streak, etc.)
3. Follow relevant incident runbook (docs/INCIDENT_RUNBOOKS.md)
4. Wait for cooldown or manually reset

### Data Feed Disconnect
1. Check Settings → Data Provider status
2. Verify internet/API credentials
3. System auto-reconnects (3 attempts)
4. Switch provider if persistent issue

## Performance Tuning

### If Signals Too Frequent
- Increase `LIVE_SIGNAL_MAX_SIGNALS_PER_MINUTE`
- Raise min_ev/min_confidence in policy.yaml
- Enable more strict regime filtering

### If Signals Too Rare
- Lower min_ev/min_confidence thresholds
- Add more symbols/timeframes
- Review strategy enable/disable status

### If Execution Too Slow
- Check broker latency metrics
- Switch to faster broker
- Optimize hardware profile (BALANCED → MAXPOWER)

## Backup & Recovery

### Backup Important Data
- `data/db/moonlight.sqlite` - All trades, strategies, config
- `backend/.env` - Configuration
- `src/config/policy.yaml` - Policy settings

### Recovery Procedure
1. Stop all services
2. Restore SQLite database
3. Restore .env and policy.yaml
4. Run `yarn test` to verify
5. Start services
6. Run pre-flight checklist

---

**MOONLIGHT v1.6 DEPLOYMENT READY** ✅
