# MoonLight v2.5 — Architecture & Operations

> **Scope:** This document describes the v2.5 runtime layers introduced in the
> v2.5.1 → v2.5.5 series: lazy-start live signal pump, unified broker
> simulator, IQ Option feature-flag guard, DOM-automation adapter skeleton,
> and the Ray-like CPU/GPU resource broker.
> **Status:** All five phases are merged and test-green (366/366 Jest).

---

## 1. Component Map (v2.5)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Electron Desktop Shell                       │
│  renderer/ (React + Vite + Tailwind + Zustand + Shadcn/UI)     │
│  routes: /dashboard /live/signals /backtest /trinity /brokers  │
└───────────────────────────────┬─────────────────────────────────┘
                                │ IPC + REST (/api/*)
┌───────────────────────────────▼─────────────────────────────────┐
│                 NestJS Backend (port 8001)                      │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐│
│  │ MoE Brains  │→ │ Global MoE + │→ │ Execution FSM (13-state)││
│  │ CEO|TRADE|  │  │ Ensemble     │  │ + Triple-Check Risk     ││
│  │ TEST        │  │ Orchestrator │  │ + EV-Veto Slot          ││
│  └─────────────┘  └──────────────┘  └──────────┬──────────────┘│
│         ▲                 ▲                     │               │
│         │                 │            ┌────────▼─────────────┐│
│  ┌──────┴──────┐  ┌───────┴───────┐   │ Broker Router        ││
│  │ Trinity     │  │ 100 Indicator │   │                      ││
│  │ Oversight   │  │ Registry +    │   │ ┌──────────────────┐ ││
│  │ GÖZ-1/2/3   │  │ Strategy      │   │ │ SimulatedBroker* │ ││
│  │ + Resource  │  │ Factory (66   │   │ │ IQ|Olymp|Binomo| │ ││
│  │ Broker (v5) │  │ YAML presets) │   │ │ Expert|FAKE      │ ││
│  └──────┬──────┘  └───────┬───────┘   │ └──────────────────┘ ││
│         │                 │            │ ┌──────────────────┐ ││
│         │                 │            │ │ IQOptionRealWSS  │ ││
│  ┌──────▼─────────────────▼──────┐     │ │ (feature-flag)   │ ││
│  │ Live Signal Engine (v1)       │     │ └──────────────────┘ ││
│  │ MockLiveDataFeedAdapter (v5)  │     │ ┌──────────────────┐ ││
│  │ (lazy-start + chunked seed)   │     │ │ DomBrokerAdapters│ ││
│  └───────────────────────────────┘     │ │ (Playwright, v4) │ ││
│                                        │ └──────────────────┘ ││
│                                        └──────────────────────┘│
│                                                                 │
│  SQLite (TypeORM)  ─  Redis (Bull queues)  ─  Parquet (Data)   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Lifecycle Guarantees

### 2.1 Startup (fail-safe by default)

- Backend boots with `LIVE_SIGNAL_ENABLED=false` → no candle pump.
- `MockLiveDataFeedAdapter` seed is chunked + event-loop-yielded. Tick timer
  is `.unref()`-ed so Jest never hangs on open handles.
- `DataModule` ↔ `StrategyModule` ↔ `AICoachModule` cycle broken with
  `forwardRef` — boot is now deterministic.

### 2.2 Live Signal Control
- `POST /api/live/engine/start` → open subscriptions.
- `POST /api/live/engine/stop`  → close subscriptions + disconnect feed.
- `GET  /api/live/engine/status`.

### 2.3 Broker Simulator (V2.5-2)

Single `SimulatedBrokerAdapter` class impersonates any of the five
broker ids (IQ/Olymp/Binomo/Expert/FAKE). Characteristics come from
`DEFAULT_SIM_PROFILES`; see `src/broker/adapters/simulated/`.

- Deterministic Mulberry32 PRNG.
- Integrates with `BrokerHealthRegistryService` (state transitions).
- REST:
  - `GET  /api/broker/sim/state`
  - `POST /api/broker/sim/reset`
  - `POST /api/broker/sim/configure`
- Contract test guarantees: **same seed ⇒ bit-for-bit identical order sequence**.

### 2.4 IQ Option Real Adapter (V2.5-3)

Feature-flag gated: `BROKER_IQOPTION_REAL_ENABLED=true` is required
before any real WSS connection. Otherwise `connectSession()` throws
`IQ_OPTION_REAL_DISABLED` and `sendOrder()` returns `REJECT REAL_DISABLED`
without any network activity.

### 2.5 DOM Automation (V2.5-4)

Playwright loaded at runtime (lazy `require`). Tests inject mock via
`setPlaywrightImpl(...)`. Three adapters (Olymp/Binomo/Expert) share
`DomBrokerAdapterBase`.

Two-tier safety flags:
- `BROKER_DOM_AUTOMATION_ENABLED` — gate for session open.
- `BROKER_DOM_LIVE_ORDERS` — second opt-in for real clicks. Otherwise
  `sendOrder()` dry-runs: stage selectors, never click confirm, ACK with
  `DOM_DRYRUN_*` position id.

Selector registry is versioned (`VersionedSelectorBundle.version`) so
operators can hot-swap bundles when a broker's markup changes.

### 2.6 Resource Broker (V2.5-5)

`ResourceBrokerService` (GÖZ-1) is now a Ray-like token bucket:
- CPU + (simulated) GPU pools.
- %80 budget cap enforced: `cap = floor(total * MOE_BUDGET_PCT / 100)`.
- `tryAcquire` (sync) / `acquire` (queued, timeout) / `release`.
- Priority (0|1|2); high priority jumps queue head but **never pre-empts**
  existing leases.
- `setSimulation(true)` auto-allocates 4 virtual GPUs.
- REST: `GET /api/trinity/resources`, `POST /api/trinity/simulation`.

---

## 3. Environment Reference (v2.5 additions)

| Variable | Default | Purpose |
|---|---|---|
| `LIVE_SIGNAL_ENABLED` | `false` | Master gate for Live Signal Engine |
| `LIVE_SIGNAL_AUTO_START` | `false` | Auto-start pump at bootstrap |
| `LIVE_SIGNAL_SYMBOLS` | `XAUUSD,EURUSD` | Comma-separated list |
| `LIVE_SIGNAL_TIMEFRAMES` | `1m,5m` | Comma-separated list |
| `LIVE_SIGNAL_MAX_SIGNALS_PER_MINUTE` | `10` | Rate limit |
| `MOCK_FEED_FAST_DEMO` | `true` | Mock adapter demo mode |
| `MOCK_FEED_INTERVAL_MS` | `30000` | Tick cadence (>= 500, clamped) |
| `MOCK_FEED_SEED_BARS` | `100` | Historical seed bars per subscription |
| `MOCK_FEED_SEED_CHUNK` | `10` | Chunk size (event-loop yield) |
| `MOE_BUDGET_PCT` | `80` | Resource broker budget cap (10..95) |
| `RESOURCE_CPU_TOKENS` | `os.cpus().length` | CPU pool size |
| `RESOURCE_GPU_TOKENS` | `0` | GPU pool size (sim raises to 4) |
| `RESOURCE_SIMULATION_ENABLED` | `false` | Enable sim GPU pool at boot |
| `BROKER_SIM_SEED` | (derived) | Global seed for all sim brokers |
| `BROKER_SIM_REAL_LATENCY` | `false` | Actually sleep the simulated latency |
| `BROKER_IQOPTION_REAL_ENABLED` | `false` | Opt-in for IQ Option real WSS |
| `IQ_OPTION_SSID` | — | Real IQ Option session token |
| `IQ_OPTION_BALANCE_ID` | — | Real IQ Option balance id |
| `IQ_OPTION_WS_URL` | `wss://iqoption.com/echo/websocket` | Override |
| `BROKER_DOM_AUTOMATION_ENABLED` | `false` | Enable DOM broker sessions |
| `BROKER_DOM_LIVE_ORDERS` | `false` | Second opt-in for live clicks |
| `OLYMP_TRADE_EMAIL` / `_PASSWORD` | — | DOM credentials |
| `BINOMO_EMAIL` / `_PASSWORD` | — | DOM credentials |
| `EXPERT_OPTION_EMAIL` / `_PASSWORD` | — | DOM credentials |
| `BROKER_MOCK_MODE` | `false` | Legacy mock gate (pre-v2.5) |
| `FAKE_BROKER_ONLY` | `true` | Prefer FakeBrokerAdapter routing |
| `MOONLIGHT_ENVIRONMENT` | `SANDBOX` | `SANDBOX` | `STAGING` | `PROD` |

---

## 4. Operator Runbook

### 4.1 Smoke: "boot → live signal → sim order → telemetry"

```bash
# 1. Boot backend (no live pump yet — fail-safe default)
cd /app/moonlight/backend
yarn build
node dist/backend/src/main.js &
curl -s http://localhost:8001/api/healthz        # => 200

# 2. Start the live pump
curl -s -X POST http://localhost:8001/api/live/engine/start

# 3. Configure simulator (deterministic, replayable)
curl -s -X POST http://localhost:8001/api/broker/sim/configure \
  -H 'Content-Type: application/json' \
  -d '{"brokerId":"IQ_OPTION","seed":42,"profile":{"rejectionProb":0}}'

# 4. Bring up GPU simulation pool
curl -s -X POST http://localhost:8001/api/trinity/simulation \
  -H 'Content-Type: application/json' \
  -d '{"enabled":true}'

# 5. Telemetry (anytime)
curl -s http://localhost:8001/api/trinity/resources
curl -s http://localhost:8001/api/broker/sim/state
curl -s http://localhost:8001/api/broker/dom/status
```

### 4.2 Enabling real IQ Option (CAREFUL)

```bash
export BROKER_IQOPTION_REAL_ENABLED=true
export IQ_OPTION_SSID='...'         # from browser cookie
export IQ_OPTION_BALANCE_ID='...'
# restart backend
```

### 4.3 Enabling DOM automation (dry-run)

```bash
yarn add -W playwright              # ≈150MB Chromium
npx playwright install chromium

export BROKER_DOM_AUTOMATION_ENABLED=true
export OLYMP_TRADE_EMAIL='...'
export OLYMP_TRADE_PASSWORD='...'
# restart backend; dry-run stages selectors but never clicks confirm.
```

Flip `BROKER_DOM_LIVE_ORDERS=true` ONLY after you've validated the
full selector bundle against the live broker for at least a week.

---

## 5. Release Checklist (v2.5.x)

- [x] `yarn test` → **366/366 PASS**
- [x] `yarn build` (backend) clean
- [x] Backend real boot verified (`/api/healthz` → 200, CPU stable)
- [x] `CHANGELOG.md` entries for v2.5.1 / v2.5.2 / v2.5.3 / v2.5.4 / v2.5.5
- [x] `plan.md` phases COMPLETE
- [ ] Desktop `yarn build` (Electron main + renderer)
- [ ] Windows `electron-builder` NSIS/portable config (v2.6 scope)
- [ ] Credentials vault via `node-keytar` (v2.6 scope)
- [ ] Auto-update channel (v2.6 scope)

---

## 6. Known Limits (v2.5 honesty log)

- K8s cluster geo-blocks CCXT (Binance=451, Bybit=403). `mock-live-feed`
  is the documented fallback; on a user's Windows box with a valid API
  key, CCXT adapter works directly.
- Playwright/Chromium is a ~150MB install footprint — we lazy-load it so
  it's only required when DOM automation is actively enabled.
- Credentials are currently read from `.env`. Production (v2.6) will
  use OS keychain integration.
- Live broker trading paths (IQ real WSS + DOM live click) ship guarded;
  full prod confidence requires paper-trading for a defined observation
  window before lifting `BROKER_IQOPTION_REAL_ENABLED` / `BROKER_DOM_LIVE_ORDERS`.
