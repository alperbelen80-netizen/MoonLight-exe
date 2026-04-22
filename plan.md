# MoonLight Trading OS — Stabilize → POC Core Flow → V1 App → Expand

## Objectives
- Keep **stability locked**: backend+desktop builds green; full unit test suite green.
- Maintain and extend the now-completed **Quad‑Core Broker Adapter layer** (Plan B Phase 1 complete) with safe defaults, deterministic behavior, and test harness.
- Prove the **core trading flow** end-to-end (POC): *Signal → Risk/EVVetoSlot → Route → Idempotent Order → Reconcile* using **MultiBrokerRouter v2 + BrokerAdapterRegistry** and at least one adapter in realistic mode.
- Build a **usable V1 Owner Console + Backend** around the proven core flow (no “big features” until core is reliable).
- Incorporate key doc themes: deterministic routing FSM, policy/guardrails, kill‑switch/circuit‑breaker, observability.
- After core flow is proven, proceed with:
  - **Plan B Phase 2** hardening (ban-risk mitigation, reconciliation improvements, real payout wiring), and/or
  - **DevSecOps Atlas Planning** (separate dashboard/planning workstream requested by user).

---

## Implementation Steps

### Phase 1 — Core Flow POC (Isolation)
> Core is complex (multi-step routing + websockets + broker adapters), so POC is mandatory.

**Status:** NOT STARTED (but prerequisites are now stronger because Plan B Phase 1 is complete)

**User stories**
1. As an owner, I can run a single-command POC that places a *simulated* order from a canonical signal and see a final reconciled status.
2. As an owner, I can see the routing decision (selected slot/expiry, chosen broker, reject reasons) for a signal.
3. As a risk officer, I can force a reject (policy/guardrail) and see it explained.
4. As an ops user, I can run the POC without the desktop app and get deterministic logs + a JSON report artifact.
5. As a developer, I can replay the same signal twice and observe idempotency preventing duplicates.

**Steps**
- Add `backend/scripts/poc-core-flow.ts` (or `scripts/poc/`) that:
  - Seeds/loads a canonical signal (EV + confidence + symbol + tf)
  - Runs EVVetoSlot selection
  - Runs Risk approval / ART / gate checks
  - Calls Execution Router (or minimal orchestrator) → IdempotentOrderService
  - Uses **MultiBrokerRouter v2** to select broker via **BrokerAdapterRegistry**
  - Sends order via selected adapter and records latency/health snapshot
  - Runs reconciliation and emits a final state summary JSON
- Prefer a **realistic but controllable adapter**:
  - Option A (default): **Fake broker + full routing stack** (same code path)
  - Option B: Use one of the real adapters against **MockWSServer** (IQ/Binomo/ExpertOption) for protocol-level realism without credentials
  - Option C: Real broker live mode only when credentials are provided
- Add a small **web research checkpoint** for best practices:
  - WS session resilience patterns + backoff
  - idempotent order semantics (keys, retries)
  - state-machine audit logging
- Add POC assertions:
  - deterministic state transitions
  - idempotency
  - expected reject reasons
  - reconciliation completes within timeout

**Deliverables**
- `yarn poc:core-flow` (or `yarn poc`) runs POC and exits 0 on success.
- `poc-output.json` containing: signal_id, slotResult, riskResult, brokerSelection, adapterHealthSnapshot, orderAck, finalState.

---

### Phase 2 — V1 App Development (Backend + Desktop around proven core)

**Status:** IN PROGRESS (stability/build alignment complete; functional E2E still needs POC)

**User stories**
1. As an owner, I can view dashboard summary (health score, execution mode, circuit breaker) in the desktop app.
2. As an owner, I can switch execution mode (OFF/AUTO/GUARD/ANALYSIS) and see it persist.
3. As an owner, I can view and edit the execution matrix (data/signal/autotrade flags per symbol+tf).
4. As an owner, I can view alerts and ACK/RESOLVE them.
5. As an owner, I can view approval queue items and approve/reject.
6. As an owner, I can view **broker health snapshot** (per adapter: UP/DOWN, last latency) and active broker selection decision.

**Steps**
- Backend
  - Ensure routing/decision endpoints expose the same data as POC (decision explanations, reason codes, chosen broker)
  - Expose `BrokerAdapterRegistry.getHealthSnapshot()` via owner endpoint for UI visibility
  - Add/verify policy loader + defaults + versioning (runtime paths stable)
  - Normalize DTO alignment between backend and desktop types (keep desktop `types.ts` in sync)
- Desktop
  - Keep API client base URL centralized (`VITE_API_BASE_URL`)
  - Ensure each page has: loading/empty/error states and retries
  - Add a minimal “Broker Health” panel (or section on Dashboard page)
- Conclude with one **E2E pass**: start backend + desktop dev, click through key flows.

---

### Phase 3 — Testing & Hardening

**Status:** PARTIALLY COMPLETE

**Completed (since last plan update)**
- Backend: **29/29 test suites PASS, 114/114 tests PASS**
- Backend build: PASS
- Desktop build: PASS
- Added production-ready broker adapter test harness:
  - `MockWSServer` for local deterministic adapter tests
  - Unit tests for IQ/Binomo/ExpertOption WSS adapters + Olymp adapter credential/availability behavior
  - Registry unit tests + credentials unit tests

**Remaining user stories**
1. As a developer, I can run a single command that executes unit tests + build checks.
2. As ops, I can run smoke test against a running backend and see a clear pass/fail report.
3. As an owner, I can trust that a rejected signal always includes reason codes.
4. As a developer, I can detect regressions via replay tests.
5. As a risk officer, I can verify circuit breaker / kill switch behavior with tests.

**Steps**
- Add root scripts:
  - `yarn verify` = backend test + backend build + desktop build
- Fix smoke-test ergonomics:
  - Make smoke test optionally spin up backend OR clearly require it and check port first
- Add regression tests for the POC core invariants (idempotency, FSM transitions, reject reasons)

---

### Phase 4 — Next Direction (post-stable checkpoint)

**Status:** READY TO START (choices pending)

**User stories**
1. As an owner, I can route orders across multiple brokers using a scoring policy.
2. As ops, I can degrade/disable a broker adapter and see routing automatically switch.
3. As a quant, I can use real payout matrix inputs in EVVetoSlot selection.
4. As an owner, I can view broker health (latency/error rate) in the console.
5. As a developer, I can add a new broker adapter with a documented contract and test harness.

**What changed (new capability delivered)**
- **Plan B Phase 1 complete:** Quad‑Core Broker Adapters production-ready with unified interface + shared WS base + CDP skeleton.
  - `BrokerAdapterInterface v2`
  - `BaseWSAdapter` (reconnect/backoff, heartbeat, request/response correlation)
  - `MockWSServer` (local test harness)
  - `BrokerCredentialsService` (env-backed vault)
  - `BrokerAdapterRegistry`
  - `MultiBrokerRouter v2` wired to registry
  - `docs/BROKER_ADAPTERS.md`

**Options to choose next**
- **Plan B Phase 2 (Hardening):**
  - Ban-risk mitigation layer (rate limits, jitter, session rotation policy hooks)
  - Reconciliation worker improvements: live broker position close detection + settlement correctness
  - Real payout matrix wiring: start with IQ Option `getPayoutRatio()` path; extend to others
  - Per-adapter health scoring: incorporate adapter health + last latency into BrokerScoringService
- **DevSecOps Atlas Planning (separate workstream):**
  - Decide scope: separate repo vs MoonLight-integrated dashboard
  - MVP tabs (e.g., Phase Guard, Defect Hunt, Green Validity, Blockers)
  - Data source: static vs MoonLight runtime evidence (tests/builds/alerts)

---

## Next Actions (Immediate)
1. Create `yarn verify` at repo root.
2. Implement `backend/scripts/poc-core-flow.ts` + `yarn poc:core-flow`.
3. Add minimal POC JSON output + assertions.
4. Decide next workstream:
   - **A)** Plan B Phase 2 hardening (recommended if going live soon)
   - **B)** DevSecOps Atlas MVP planning/build

---

## Success Criteria
- Stability
  - `backend: yarn jest` → **PASS** (currently PASS)
  - `backend: yarn build` → **PASS** (currently PASS)
  - `desktop: yarn build` → **PASS** (currently PASS)
  - `root: yarn verify` → **PASS** (to be added)
- Quad-Core Brokers (Phase 1 Complete)
  - All 4 adapters compile and conform to BrokerAdapterInterface v2
  - Local deterministic tests via MockWSServer
  - Registry + router integration verified
- Core POC
  - `yarn poc:core-flow` exits 0 and produces `poc-output.json`.
  - Re-running with same idempotency key produces **no duplicate order**.
  - Reject paths show **reason codes** and are deterministic.
- V1 UX
  - Owner can view dashboard, execution matrix, alerts, approvals without runtime errors.
  - Execution mode changes persist and reflect immediately in UI.
  - Broker health snapshot visible in UI.
