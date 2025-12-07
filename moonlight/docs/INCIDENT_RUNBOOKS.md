# MoonLight Incident Runbooks

## Runbook-001: Circuit Breaker L1 Triggered (Product/Strategy Pause)

**Trigger:** DayCap exceeded OR WR degradation > 10% OR Loss streak ≥ 5

**Immediate Actions:**
1. ✅ System automatically pauses affected product/strategy
2. ✅ Alert sent to Owner Console
3. ✅ Cooldown period: 30 minutes

**Owner Actions:**
1. Check Alerts page for trigger details
2. Review PNL History for affected symbol/strategy
3. Check Data Health (data quality issue?)
4. Review Strategy Performance (strategy degrading?)
5. **Decision:**
   - Resume after cooldown (if temporary)
   - Disable strategy permanently (if broken)
   - Adjust risk limits (if too aggressive)

---

## Runbook-002: Circuit Breaker L2 (Broker Suspend)

**Trigger:** Broker reject rate > 10% OR Latency p95 > 1000ms

**Immediate Actions:**
1. ✅ System suspends broker
2. ✅ Routes to fallback broker
3. ✅ Cooldown: 60 minutes

**Owner Actions:**
1. Check broker session health (Accounts page)
2. Review broker latency metrics
3. Check broker API status (external)
4. **Decision:**
   - Wait for auto-recovery
   - Switch to different broker
   - Contact broker support

---

## Runbook-003: Kill-Switch Activated (L3 Global Halt)

**Trigger:** Manual activation OR Critical system error

**Immediate Actions:**
1. ✅ ALL trading stopped
2. ✅ Open positions remain (expire naturally)
3. ✅ No new signals processed

**Owner Actions:**
1. Identify root cause:
   - Check Alerts page
   - Review recent executions
   - Check system logs
2. **Resolution:**
   - Fix underlying issue
   - Verify system health
   - Deactivate kill-switch
   - Resume execution mode

---

## Runbook-004: Data Feed Disconnected

**Trigger:** Provider connection lost > 60s

**Immediate Actions:**
1. ✅ Auto-reconnect attempts (3x)
2. ✅ Fallback to MOCK_LIVE if all fail
3. ✅ Alert generated

**Owner Actions:**
1. Check Settings → Data Provider status
2. Verify API keys/credentials
3. Check internet connection
4. Switch to alternative provider

---

## Runbook-005: High Uncertainty Regime (SHOCK)

**Trigger:** Volatility > 3% threshold

**Immediate Actions:**
1. ✅ Signal generation paused
2. ✅ Existing positions monitored
3. ✅ Auto-resume when regime normalizes

**Owner Actions:**
1. Monitor market news/events
2. Review Data Health (data spike?)
3. Wait for regime to stabilize
4. Consider manual intervention if needed

---

## Runbook-006: Strategy Auto-Disabled

**Trigger:** 5 consecutive losses

**Immediate Actions:**
1. ✅ Strategy disabled automatically
2. ✅ Alert sent
3. ✅ Performance metrics logged

**Owner Actions:**
1. Go to Strategies page
2. Review strategy performance
3. Check backtest results vs live
4. **Decision:**
   - Re-enable with modified parameters
   - Disable permanently
   - Run new backtest

---

## Runbook-007: Demo Account Execution Attempt

**Trigger:** Auto-execution on DEMO account

**Immediate Actions:**
1. ✅ Execution blocked (if DEMO_AUTO_EXECUTION_ALLOWED=false)
2. ✅ Warning returned to UI

**Owner Actions:**
1. Verify account type (Accounts page)
2. If intended for demo:
   - Set DEMO_AUTO_EXECUTION_ALLOWED=true
3. If accident:
   - Switch to correct account
   - Review account selection logic
