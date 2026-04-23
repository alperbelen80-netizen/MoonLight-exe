# MoonLight Trading OS — Stabilize → Scenario B Live Signals → Multi‑Source Feed Auto‑Select (AI‑verified) → Scenario C AI Coach → **v1.8 AI‑Native Trading OS** → **v1.9 Production‑Ready Hardening + Advanced Features**

## Objectives
- Keep **stability locked**: backend + desktop builds green; unit tests green (**147/147 PASS current baseline**).
- Deliver **Scenario B (Live Signals)** end‑to‑end using **Mock Live Feed** (K8s geo‑blocks Binance 451 + Bybit 403) with **FAST_DEMO** candle emission so UI shows signals immediately.
- Provide **Multi‑Source Data Feed** layer (Mock + Binance CCXT + Bybit CCXT + TradingView Webhook + IQ Option skeleton) with:
  - parallel provider health checks
  - latency + deterministic scoring + tie‑breakers
  - **AI‑validated auto‑selection (fail‑closed)**
- Provide **Scenario C (AI Coach)** as a first‑class module:
  - chat + strategy analysis
  - feed selection validation
- Upgrade to **v1.8 “AI‑Native Trading OS”**:
  - **AI Reasoning Layer per live signal (AI Guard)** + periodic auto‑batch
  - AI Insights on Dashboard
  - Market Intelligence heatmap + strategy leaderboard + AI Tune
  - Polish & hardening (dark mode, status bar, toasts, shortcuts)
- **NEW (v1.9)**: Production‑ready hardening + advanced features:
  - DB indexes + query performance
  - gzip + per‑IP throttling + healthz + structured errors + graceful shutdown
  - Backtest AI Analyzer
  - Alert System V2 (outgoing webhooks + thresholds)
  - Trade Journal timeline
  - Command Palette (Cmd+K)
  - React ErrorBoundary

---

## Implementation Steps

### Phase 1 — Core Flow POC (Isolation)
> Core POC was established via `backend/scripts/poc-core-flow.ts`. Sandbox validated.

**Status:** COMPLETE

**Completed (evidence)**
- `backend/scripts/poc-core-flow.ts` created and Sandbox flow validated.
- Quad‑Core Broker Adapter skeleton + harness (BaseWSAdapter, MockWSServer, BrokerCredentialsService) in place.
- Desktop UI polish completed (Loading/Error states, Skeletons).
- Vite proxy routing aligned (`/api` prefix), Nest global prefix enabled.

**Carry‑over invariants to keep**
- Deterministic logs + reason codes
- Fail‑closed defaults (Core‑First)
- Idempotency semantics

---

### Phase 2 — V1 App Development (Backend + Desktop around proven core)

**Status:** COMPLETE

**Completed (Scenario B evidence)**
- `MockLiveDataFeedAdapter` FAST_DEMO: 100‑bar seed + ~1500ms candles.
- `LiveSignalEngine` produces and persists live signals to SQLite.
- UI confirms signals flowing on `/live/signals` page.

**Fixes delivered**
- `LiveSignalEngine`: defensive numeric normalization to prevent NaN → `SQLITE_ERROR: no such column: NaN`.
- `LiveStrategyPerformanceService`: defaults + UNIQUE race retry to prevent constraint failures.

---

### Phase 3 — Testing & Hardening

**Status:** COMPLETE (expanded)

**Completed**
- Backend Jest: **147/147 tests PASS**.
- Backend build: PASS
- Desktop build: PASS
- Comprehensive backend endpoint testing: PASS for v1.7; v1.8 testing agent reported 16/17 due to route shadowing → fixed.

**Known expected constraints**
- Binance CCXT → HTTP 451 geo‑block in cluster
- Bybit CCXT → HTTP 403 geo‑block in cluster
- TradingView webhook requires external alert configuration

---

### Phase 4 — Next Direction (post‑stable checkpoint)

**Status:** COMPLETE for v1.7/v1.8, moving to v1.9

#### Track A — Scenario B: Live Signals Demo
**Status:** COMPLETE

**Deliverables (done)**
- Live Signals demo works in K8s/restricted environments using Mock feed.

#### Track B — Multi‑Source Data Feed + AI Auto‑Selection
**Status:** COMPLETE

**Deliverables (done)**
- `GET /api/data/providers/health`
- `POST /api/data/providers/auto-select` (AI dry‑run + apply)
- `POST /api/data/providers/switch`
- Desktop: **Data Sources** page (`/data-sources`) showing provider health + AI buttons.

#### Track C — Scenario C: AI Coach MVP
**Status:** COMPLETE

**Deliverables (done)**
- `AICoachService` via Emergent LLM Gateway (model default: `gemini-2.5-flash`).
- Endpoints: `status`, `chat`, `analyze-strategy`, `validate-feed`.
- Desktop: **AI Coach** page (`/ai-coach`) with chat UX.

---

## v1.8.0 Roadmap — “AI‑Native Trading OS” (User granted full authority)

**Status:** COMPLETE ✅

### Phase A — AI Reasoning Layer (KRİTİK)
**Goal:** Every live signal gets an AI “muhakeme” verdict.

**Delivered**
- `AIReasoningService`:
  - Rate limit: token bucket (default **30/min**)
  - Circuit breaker: 5 consecutive AI failures → 60s cooldown
  - Auto‑batch: every 30s reasons latest 5 UNKNOWN/PENDING signals
  - Strict guard (optional): if `AI_GUARD_STRICT=true` and AI rejects → `status=SKIPPED`
- DB:
  - `LiveSignal` columns: `ai_verdict`, `ai_confidence`, `ai_reasoning`, `ai_reasoned_at_utc`
  - TypeORM `synchronize` now opt‑out via `DB_SYNCHRONIZE=false` (default ON)
- Endpoints:
  - `POST /api/ai-coach/reason-signal/:id`
  - `POST /api/ai-coach/reason-signal/batch` (**route shadowing fixed by ordering static route before `:id`**)
  - `GET /api/ai-coach/reasoning-history`

**Frontend delivered**
- Live Signals table:
  - AI verdict column (APPROVED/REJECTED/UNKNOWN + confidence %)
  - 🧠 “Muhakeme” button with modal (reasoning + risk factors + expected WR)

**Tests delivered**
- Unit coverage for JSON extraction, rate limiter, circuit breaker, clamp01, degraded mode

---

### Phase B — Dashboard AI Insights Widget
**Status:** COMPLETE ✅

**Delivered**
- Backend: `GET /api/ai-coach/daily-insights` with 5‑minute in‑memory cache
- Frontend: AI Insights card on Dashboard (summary + totals + top symbols + regime distribution + 3 recommendations)

---

### Phase C — Market Intelligence Page
**Status:** COMPLETE ✅

**Delivered**
- Backend: `GET /api/ai-coach/regime-heatmap`
- Frontend: `/intel` page with heatmap (symbol×tf) + ADX tooltip

---

### Phase D — Strategy Leaderboard + AI Tuning
**Status:** COMPLETE ✅

**Delivered**
- Backend: `GET /api/ai-coach/strategy-leaderboard`
- Backend: `POST /api/ai-coach/tune-strategy`
- Frontend: Leaderboard table + per‑row AI Tune modal

---

### Phase E — Polish & Hardening
**Status:** COMPLETE ✅

**Delivered**
- Dark mode toggle (Tailwind `darkMode: 'class'`)
- Status bar (AI model + feed + provider UP count + rate tokens)
- Toast notifications (sonner) for new signals + AI approvals
- Keyboard shortcuts (`g d/l/i/a/s/b/h`)

---

## v1.9.0 Roadmap — Production‑Ready Hardening + Advanced Features

### 🎯 Ana Hedefler
- Mevcut **147 Jest** + regression endpointleri **tam yeşil**
- Minimum **+15 yeni Jest test** (hedef: **167+**)
- Performans iyileştirmeleri: DB index, caching, gzip
- Kurumsal seviye: alerts, journal, backtest AI

---

### Tier 1 — Critical (Bu sprint)

#### T1.1 — DB Index + Query Hızlandırma
**Goal:** LiveSignals/Insights/History sorgularını hızlandırmak.
- Add TypeORM `@Index` decorators:
  - `LiveSignal(symbol, timestamp_utc)`
  - `LiveSignal(ai_verdict)`
  - `LiveSignal(strategy_family, timestamp_utc)`
  - `BacktestRun(environment, created_at_utc)` (entity adı repo’da hangi isimle ise)
- Validate via: reasoning-history + daily-insights latency before/after
- Tests:
  - schema presence check (sqlite pragma index_list)

#### T1.2 — Backend Hardening
**Goal:** Production safety.
- gzip compression middleware (`compression`)
- Per‑IP throttling (`@nestjs/throttler`): 100 req/min (owner UI endpoints), 30 req/min (AI endpoints)
- `GET /api/healthz` structured:
  - db ok, ai ok, feed provider ok, broker adapter health, queue health
- Global exception filter (structured JSON: code, message, correlation_id)
- Graceful shutdown (SIGTERM): close db, clear timers, disconnect feeds
- Tests:
  - healthz contract
  - throttler behavior
  - error filter format

#### T1.3 — Backtest AI Analyzer
**Goal:** Backtest sonuçlarını AI ile yorumlama.
- `BacktestAIAnalyzerService`:
  - Input: backtest run stats + per‑strategy breakdown + drawdown metrics
  - Output: weaknesses, regime fit, top improvements, recommended parameter bands
- Endpoint: `POST /api/backtest/:id/ai-analyze`
- Frontend: BacktestsPage “AI Analiz” button + modal
- Tests:
  - degraded mode (no key)
  - JSON schema extraction

#### T1.4 — Alert System V2
**Goal:** Operasyonel alarm altyapısı.
- `AlertDispatcherService`: outgoing webhooks (Discord/Telegram/Slack templates)
- `POST /api/alerts/test-webhook`
- Threshold monitoring (cron/interval):
  - AI approval rate < 30% (last 60m) → alert
  - circuit breaker OPEN → alert
  - feed switched → info alert
- Frontend: webhook config UI + test button
- Tests:
  - webhook payload contract
  - threshold evaluator

#### T1.5 — Trade Journal Sayfası
**Goal:** Sinyal → AI verdict → (future) execution outcome timeline.
- Backend:
  - `GET /api/journal?from=&to=&status=&symbol=&strategy=`
  - Response: grouped cards (signal + reasoning + status + timestamps)
- Frontend:
  - Timeline view (filterable)
- Tests:
  - filtering correctness

#### T1.6 — Command Palette (Cmd+K)
**Goal:** Power‑user hız.
- Frontend: `cmdk` command palette
  - Navigate actions
  - Toggle theme
  - Trigger AI dry-run auto-select
  - Trigger reason-batch
  - Kill switch quick action (future)
- Tests:
  - basic rendering + action dispatch

#### T1.7 — Error Boundary
**Goal:** UI crash‑proof.
- React ErrorBoundary wrapper around routes
- Friendly fallback + “Reload” button
- Tests:
  - renders fallback on error

---

### Tier 2 — Polish (Bu sprint sonunda)

#### T2.1 — Risk Profile Presets
- Conservative / Moderate / Aggressive / Custom
- Extend `ExecutionConfig` to store profile + overrides
- Apply profile defaults into risk layer
- UI: Settings radio group

#### T2.2 — Notification History Drawer
- Persist last 50 toasts in localStorage
- Drawer UI (right slide‑in)

#### T2.3 — AI Regime Forecast
- Endpoint: `POST /api/ai-coach/forecast-regime {symbol, tf}`
- Input: last 2h candles + ADX + volatility snapshot
- Output: next 30m regime forecast + confidence + key risks
- Frontend: Market Intel expandable detail

---

### Tier 3 — Future
- lightweight‑charts signal overlay
- Virtualization (`react-window`) for long tables
- Onboarding tour (react-joyride)

---

## Next Actions (Immediate)
1. **T1.1 DB Indexes** (quick win) + verify latency improvements
2. **T1.2 Backend hardening**: gzip + throttler + `/healthz` + error filter + graceful shutdown
3. **T1.3 Backtest AI Analyzer** + Backtests UI modal
4. **T1.4 Alerts V2** webhook dispatcher + threshold monitor + UI
5. **T1.5 Trade Journal** backend endpoint + timeline page
6. **T1.6 Command Palette** (Cmd+K)
7. **T1.7 Error Boundary**

---

## Success Criteria
- Stability
  - `yarn verify` → PASS
  - Backend + Desktop build → PASS
  - Tests ≥ **167** PASS
- Performance
  - Live signals + history queries are indexed (measurable improvement)
  - Daily insights cache hit ratio visible (optional metric)
- Ops readiness
  - `/api/healthz` returns structured status
  - throttling prevents abuse
  - graceful shutdown verified
- AI features
  - Reasoning pipeline continues to work; batch endpoints not shadowed
  - Backtest AI analyzer produces consistent structured output
- UX quality
  - Command palette functional
  - ErrorBoundary prevents blank screen
  - Journal timeline usable and filterable
