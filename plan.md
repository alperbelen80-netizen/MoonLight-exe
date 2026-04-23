# MoonLight Trading OS — Stabilize → Scenario B Live Signals → Multi‑Source Feed Auto‑Select (AI‑verified) → Scenario C AI Coach

## Objectives
- Keep **stability locked**: backend + desktop builds green; full unit test suite green (**114/114 PASS baseline**).
- Deliver **Scenario B (Live Signals Demo)** end‑to‑end using **Mock Live Feed** (due to Binance geo‑block) with **FAST_DEMO** candle emission so the UI shows signals immediately.
- Add a **Multi‑Source Data Feed layer** (Mock + Bybit CCXT + TradingView Webhook) with:
  - parallel provider health checks
  - latency + reliability scoring
  - **automatic provider selection** with **Gemma E4B AI validation** (Emergent LLM Key approved).
- Maintain **Core‑First / Fail‑Safe** properties: deterministic behavior, fail‑closed defaults, reason codes, circuit‑breaker compatibility.
- Prepare **Scenario C (Gemma E4B AI Coach)** to provide strategy coaching + runtime validations (feed selection validation, signal sanity checks) without requiring real broker credentials.

---

## Implementation Steps

### Phase 1 — Core Flow POC (Isolation)
> Core POC is already established via `backend/scripts/poc-core-flow.ts` and Sandbox is validated. For this iteration, priority shifts to Scenario B (Live Signals) and Data Feed provider automation.

**Status:** COMPLETE (Sandbox POC + core routing skeleton validated)

**Completed (evidence)**
- `backend/scripts/poc-core-flow.ts` created and Sandbox flow validated.
- Quad‑Core Broker Adapter **skeleton + harness** in place (BaseWSAdapter, BrokerCredentialsService, MockWSServer).
- Desktop UI polish completed (Loading/Error states, Skeletons, StrictMode double-fetch fixes).
- Vite proxy routing aligned (`/api` prefix), Nest global prefix enabled.

**Carry‑over invariants to keep**
- Deterministic logs + reason codes
- Idempotency semantics
- Routing explanations available for UI

---

### Phase 2 — V1 App Development (Backend + Desktop around proven core)

**Status:** IN PROGRESS

**What is in progress now**
- **Scenario B — Live Signals Mode** (Mock feed acceleration + UI visibility)
- Session management UX and broker adapter health endpoints already exist

**Steps (updated)**
- Backend
  - Verify `MOCK_FEED_FAST_DEMO` behavior: ensure candles emit every ~1–2s and seed history so indicators produce signals immediately.
  - Ensure LiveSignalEngine produces and persists signals; expose them via API for UI.
  - Add/verify endpoints needed by LiveSignals UI (list stream/poll).
- Desktop
  - Validate LiveSignalsPage renders incoming signals cleanly with loading/empty/error states.
  - Keep SessionManagerPage aligned with backend provider selection actions (later phases).

---

### Phase 3 — Testing & Hardening

**Status:** PARTIALLY COMPLETE

**Completed (confirmed earlier)**
- Backend: **29/29 suites PASS, 114/114 tests PASS**
- Backend build: PASS
- Desktop build: PASS
- Broker adapter test harness exists (MockWSServer, adapter specs, registry tests)

**Now (expanded scope)**
1. **Stability verification checkpoint**
   - Run `yarn verify` and confirm it still passes after Scenario B changes.
   - Start backend and validate `/api/health`.
2. **Scenario B smoke tests (manual + repeatable)**
   - Start backend with `MOCK_FEED_FAST_DEMO=true`.
   - Confirm candle emission rate and LiveSignalEngine signal throughput.
   - Confirm `/api/live/signals` returns fresh signals.
3. **Introduce smoke test ergonomics (optional)**
   - Add a simple curl-based script (or documented steps) for Scenario B verification.

---

### Phase 4 — Next Direction (post-stable checkpoint)

**Status:** READY TO START (updated: multi-source feed + AI auto-select + AI coach)

#### Track A — Scenario B: Live Signals Demo (finish)
**Status:** IN PROGRESS

**User stories**
1. As an owner, I can run Live Signals mode and see new signals appear without waiting 60s per candle.
2. As an owner, I can see signals flowing in the desktop UI reliably.

**Steps**
- Backend
  - Ensure `MockLiveDataFeedAdapter` FAST_DEMO mode seeds history + emits candles at ~1500ms.
  - Verify LiveSignalEngine consumes candles and persists to `live_signals`.
  - Verify `GET /api/live/signals` shows recent records.
- Desktop
  - Confirm LiveSignalsPage renders signal list and updates.
  - (Optional) add “connected feed + provider name” badge.

**Deliverables**
- Live Signals demo works in K8s/restricted environments with Mock feed.

#### Track B — Multi‑Source Data Feed + AI Auto‑Selection
**Status:** PENDING

**Motivation**
- Binance CCXT is geo‑blocked (HTTP 451). We will keep Mock as fallback while adding Bybit + TradingView.

**User stories**
1. As ops, I can see all feed providers’ health + latency in one endpoint.
2. As owner, I can click “Auto‑Select Best Feed” and the system chooses the best working provider.
3. As risk, I can require **AI validation** before switching providers (fail‑closed on uncertainty).

**Steps**
- Providers
  - Add **Bybit CCXT adapter** (preferred non-geo‑blocked default).
  - Improve **TradingView Webhook adapter** (reliability, symbol mapping, timestamps).
  - Keep **Mock** as always-available fallback.
- Orchestrator
  - Add parallel health checks + latency measurement.
  - Add scoring model: availability, latency, error rate, data freshness.
  - Implement `selectBestProvider()` with deterministic scoring.
  - Add **AI verification step** (Gemma E4B): validate the deterministic choice + sanity checks; if AI fails/returns low confidence → do not switch (fail‑closed) or switch only to Mock.
- API
  - `GET /api/data/providers/health`
  - `POST /api/data/providers/auto-select`
  - (Optional) `POST /api/data/providers/switch/:provider`
- Desktop
  - Add “Auto‑Select Best Feed” button to Session Manager.
  - Display provider health table (name, connected, latency, last update).

**Deliverables**
- Multi-provider feed system that chooses best available provider automatically, with AI-verified guardrails.

#### Track C — Scenario C: Gemma E4B AI Coach
**Status:** PENDING (approved: Emergent LLM Key = YES)

**User stories**
1. As an owner, I can ask AI for strategy feedback and market context.
2. As ops, I can ask AI to validate current feed selection and identify anomalies.

**Steps**
- Backend
  - Add integration playbook using Emergent Universal LLM Key.
  - Implement `AICoachService`:
    - `analyzeStrategy()` (preset strategy + performance hints)
    - `validateFeedSelection()` (input: providers health + selected provider)
  - Endpoints:
    - `POST /api/ai-coach/analyze`
    - `POST /api/ai-coach/validate-feed`
- Desktop
  - Add AI Coach panel (chat + insights) with safe rate limits and clear disclaimers.

**Deliverables**
- AI Coach MVP available without real broker credentials.

---

## Next Actions (Immediate)
1. **Run stability verification**
   - `cd /app/moonlight && yarn verify`
   - Start backend; verify `/api/health`.
2. **Finish Scenario B demo**
   - Run backend with `MOCK_FEED_FAST_DEMO=true`.
   - Verify `/api/live/signals` is updating.
   - Confirm LiveSignalsPage shows streaming/polling updates.
3. **Start Multi‑Source Feed track**
   - Add Bybit adapter + provider health endpoints.
   - Implement deterministic `selectBestProvider()`.
   - Add AI verification hook (Gemma E4B).

---

## Success Criteria
- Stability
  - `yarn verify` → PASS
  - Backend `/api/health` → OK
- Scenario B (Live Signals)
  - Mock FAST_DEMO emits candles every ~1–2s and seeds history
  - LiveSignalEngine produces signals and persists them
  - `GET /api/live/signals` returns fresh signals
  - Desktop Live Signals page shows new signals without long delays
- Multi‑Source Feed Auto‑Select
  - `GET /api/data/providers/health` shows provider status + latency
  - `POST /api/data/providers/auto-select` chooses working provider deterministically
  - AI verification gates provider switching (fail‑closed)
- Scenario C (AI Coach)
  - `POST /api/ai-coach/analyze` and `validate-feed` operational
  - UI panel usable and stable without broker credentials
