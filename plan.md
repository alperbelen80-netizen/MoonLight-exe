# MoonLight Trading OS — Stabilize → Scenario B Live Signals → Multi‑Source Feed Auto‑Select (AI‑verified) → Scenario C AI Coach → **v1.8 AI‑Native Trading OS**

## Objectives
- Keep **stability locked**: backend + desktop builds green; unit tests green (**129/129 PASS baseline**).
- Deliver **Scenario B (Live Signals)** end‑to‑end using **Mock Live Feed** (K8s geo‑blocks Binance 451 + Bybit 403) with **FAST_DEMO** candle emission so UI shows signals immediately.
- Provide **Multi‑Source Data Feed** layer (Mock + Binance CCXT + Bybit CCXT + TradingView Webhook + IQ Option skeleton) with:
  - parallel provider health checks
  - latency + deterministic scoring + tie-breakers
  - **AI‑validated auto‑selection (fail‑closed)**
- Provide **Scenario C (AI Coach)** as a first-class module:
  - chat + strategy analysis
  - feed selection validation
- Upgrade to **v1.8 “AI‑Native Trading OS”**:
  - **AI Reasoning Layer per live signal (AI Guard)**
  - AI Insights on Dashboard
  - Market Intelligence heatmap
  - Strategy Leaderboard + AI tuning
  - Polish & hardening (dark mode, status bar, toasts, shortcuts)

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
- Fail‑closed defaults (Core-First)
- Idempotency semantics

---

### Phase 2 — V1 App Development (Backend + Desktop around proven core)

**Status:** COMPLETE

**Completed (Scenario B evidence)**
- `MockLiveDataFeedAdapter` FAST_DEMO: 100-bar seed + ~1500ms candles.
- `LiveSignalEngine` produces and persists live signals to SQLite.
- UI confirms signals flowing on `/live/signals` page.

**Fixes delivered**
- `LiveSignalEngine`: defensive numeric normalization to prevent NaN → `SQLITE_ERROR: no such column: NaN`.
- `LiveStrategyPerformanceService`: defaults + UNIQUE race retry to prevent constraint failures.

---

### Phase 3 — Testing & Hardening

**Status:** COMPLETE (expanded)

**Completed**
- Backend Jest: **129/129 tests PASS**.
- Backend build: PASS
- Desktop build: PASS
- Comprehensive backend endpoint testing: PASS (testing_agent_v3)

**Known expected constraints**
- Binance CCXT → HTTP 451 geo-block in cluster
- Bybit CCXT → HTTP 403 geo-block in cluster
- TradingView webhook requires external alert configuration

---

### Phase 4 — Next Direction (post-stable checkpoint)

**Status:** IN PROGRESS (v1.8 planning)

#### Track A — Scenario B: Live Signals Demo (finish)
**Status:** COMPLETE

**Deliverables (done)**
- Live Signals demo works in K8s/restricted environments using Mock feed.

#### Track B — Multi‑Source Data Feed + AI Auto‑Selection
**Status:** COMPLETE

**Deliverables (done)**
- `GET /api/data/providers/health`
- `POST /api/data/providers/auto-select` (AI dry-run + apply)
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

### Phase A — AI Reasoning Layer (KRİTİK)
**Goal:** Every live signal gets an AI “muhakeme” verdict. **AI Guard mode**: if AI rejects → signal becomes `SKIPPED` (fail‑closed).

**Backend**
- Add `AIReasoningService`:
  - Input: live signal + pack score + regime + key indicators + payout snapshot + risk layer summary
  - Output JSON: `{ approved, confidence, reasoning, riskFactors[], expectedWR, expectedEV, notes }`
  - Rate-limit: max **30 analyses/min** (token bucket) + circuit breaker on AI failures.
- DB changes:
  - `LiveSignal` entity add columns:
    - `ai_verdict` (enum/string: APPROVED/REJECTED/UNKNOWN)
    - `ai_confidence` (real)
    - `ai_reasoning` (text/json)
    - `ai_reasoned_at_utc` (datetime)
- Endpoints:
  - `POST /api/ai-coach/reason-signal/:id` (manual trigger)
  - `POST /api/ai-coach/reason-signal/batch` (latest N NEW signals)
  - `GET /api/ai-coach/reasoning-history` (filters: symbol/tf/verdict/date)
- Integration points:
  - In `LiveSignalEngine` after signal persisted → enqueue AI reasoning job (Bull) if enabled.
  - Fail-safe: if AI down or rate limited → `ai_verdict=UNKNOWN`, do not auto-skip unless `AI_GUARD_STRICT=true`.

**Frontend**
- Live Signals table:
  - Add 🧠 “Reason” action per row → modal shows verdict, confidence, risk factors.
  - Filter by `ai_verdict`.

**Tests**
- Unit tests for:
  - JSON extraction strictness
  - rate limiter
  - fail‑closed behavior
  - schema validation

---

### Phase B — Dashboard AI Insights Widget
**Goal:** Daily “what happened today” summary with actionable suggestions.

**Backend**
- `GET /api/ai-coach/daily-insights`:
  - top symbols/strategies
  - regime distribution
  - risk summary (Triple‑Check + M3)
  - 3 actionable recommendations
- Cache: 5 minutes (in-memory / Redis if available).

**Frontend**
- Dashboard: add **AI Insights** card (auto refresh 5 min) with expandable details.

---

### Phase C — Market Intelligence Page
**Goal:** Provide a “data center” view: regime heatmap + signal distribution.

**Backend**
- `GET /api/market/regime-heatmap`:
  - matrix: symbol × timeframe → `{ regime, adx, ts_utc }`
- (Optional) `GET /api/market/signal-distribution`:
  - per symbol/timeframe counts + verdict split.

**Frontend**
- New page `/market-intelligence`:
  - heatmap grid
  - distribution chart

---

### Phase D — Strategy Leaderboard + AI Tuning
**Goal:** Make strategy performance transparent and AI-assisted.

**Backend**
- `GET /api/strategies/leaderboard`:
  - live signals count, executed count, win rate, avg confidence, AI approval rate.
- `POST /api/ai-coach/tune-strategy`:
  - batch analysis of a strategy family + recommendations

**Frontend**
- Strategies page:
  - sortable leaderboard
  - “AI Tune” button per strategy

---

### Phase E — Polish & Hardening
**Goal:** Premium-grade usability + operational safety.

- Dark mode toggle (localStorage) + Tailwind theme tokens
- Status bar: active provider + AI availability + rate limit meter
- Toast notifications (sonner) for:
  - new AI-approved signals
  - feed switch events
  - AI failures (circuit breaker)
- Keyboard shortcuts:
  - `g d` dashboard
  - `g l` live signals
  - `g a` AI coach
  - `g m` market intelligence
- Docs updates:
  - `/docs/AI_COACH.md`
  - `/docs/DATA_FEEDS.md`
- Tests target: **150+** total, 0 regressions

---

## Next Actions (Immediate)
1. **Implement Phase A (AI Reasoning Layer)**
   - DB migration for LiveSignal AI columns
   - `AIReasoningService` + endpoints
   - LiveSignals UI 🧠 modal
2. **Dashboard AI Insights (Phase B)**
3. **Market Intelligence (Phase C)**
4. **Strategy Leaderboard + AI Tune (Phase D)**
5. **Polish & hardening (Phase E)**

---

## Success Criteria
- Stability
  - `yarn verify` → PASS
  - Backend + Desktop build → PASS
  - Tests ≥ 150 PASS
- AI Reasoning Layer
  - Per-signal AI verdict persisted + queryable
  - AI Guard can SKIP signals deterministically
  - Rate limiting + circuit breaker verified
- Insights + Intelligence
  - Daily insights endpoint cached and renders on Dashboard
  - Regime heatmap page usable and performant
- Strategy Leaderboard
  - Leaderboard metrics correct, AI tuning produces consistent structured output
- UX Quality
  - Dark mode, status bar, toasts, shortcuts all functional
