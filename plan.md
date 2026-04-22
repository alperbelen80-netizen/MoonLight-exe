# MoonLight Trading OS — Stabilize → POC Core Flow → V1 App → Expand

## Objectives
- Lock in **stability**: tests + builds green, CI-like checks easy to run locally.
- Prove the **core trading flow** end-to-end (POC): *Signal → Risk/EVVetoSlot → Route → Idempotent Order → Reconcile* using at least one broker adapter in a realistic mode.
- Build a **usable V1 Owner Console + Backend** around the proven core flow (no new “big features” until core is reliable).
- Incorporate key new doc themes: deterministic routing FSM, policy/guardrails, kill-switch/circuit-breaker, observability.

---

## Implementation Steps

### Phase 1 — Core Flow POC (Isolation) 
> Core is complex (multi-step routing + websockets + broker adapters), so POC is mandatory.

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
  - Calls Execution Router (or minimal orchestrator) → IdempotentOrderService → Broker adapter
  - Runs reconciliation and emits a final state summary JSON
- Prefer a **realistic but controllable adapter**:
  - Option A: keep current MOCK broker/data-feed but enforce the *same code-path* as live (router/FSM/policy).
  - Option B: add a *single* real adapter POC (IQ Option WS) only if credentials available.
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
- `poc-output.json` containing: signal_id, slotResult, riskResult, brokerRoute, orderAck, finalState.

---

### Phase 2 — V1 App Development (Backend + Desktop around proven core)

**User stories**
1. As an owner, I can view dashboard summary (health score, execution mode, circuit breaker) in the desktop app.
2. As an owner, I can switch execution mode (OFF/AUTO/GUARD/ANALYSIS) and see it persist.
3. As an owner, I can view and edit the execution matrix (data/signal/autotrade flags per symbol+tf).
4. As an owner, I can view alerts and ACK/RESOLVE them.
5. As an owner, I can view approval queue items and approve/reject.

**Steps**
- Backend
  - Ensure routing/decision endpoints expose the same data as POC (decision explanations).
  - Add/verify policy loader + defaults + versioning (already compiled; ensure runtime paths stable).
  - Normalize DTO alignment between backend and desktop types (keep desktop `types.ts` in sync).
- Desktop
  - Keep API client base URL centralized (`VITE_API_BASE_URL`).
  - Ensure each page has: loading/empty/error states and retries.
- Conclude with one **E2E pass**: start backend + desktop dev, click through key flows.

---

### Phase 3 — Testing & Hardening

**User stories**
1. As a developer, I can run a single command that executes unit tests + build checks.
2. As ops, I can run smoke test against a running backend and see a clear pass/fail report.
3. As an owner, I can trust that a rejected signal always includes reason codes.
4. As a developer, I can detect regressions via replay tests.
5. As a risk officer, I can verify circuit breaker / kill switch behavior with tests.

**Steps**
- Add root scripts:
  - `yarn verify` = backend test + backend build + desktop build.
- Fix smoke-test ergonomics:
  - Make smoke test optionally spin up backend (or clearly require it and check port first).
- Add regression tests for the POC core invariants (idempotency, FSM transitions, reject reasons).

---

### Phase 4 — Next Direction (post-stable checkpoint)

**User stories**
1. As an owner, I can route orders across multiple brokers using a scoring policy.
2. As ops, I can degrade/disable a broker adapter and see routing automatically switch.
3. As a quant, I can use real payout matrix inputs in EVVetoSlot selection.
4. As an owner, I can view broker health (latency/error rate) in the console.
5. As a developer, I can add a new broker adapter with a documented contract and test harness.

**Options to choose after Phase 3**
- Multi-broker intelligent routing (latency/payout/slippage scoring)
- Real payout matrix + regime detection wired to live feeds
- Advanced features (GA engine, meta-learner, reporting packs)

---

## Next Actions (Immediate)
- Create `yarn verify` at repo root.
- Implement `backend/scripts/poc-core-flow.ts` + `yarn poc:core-flow`.
- Add minimal POC JSON output + assertions.
- Scan remaining uploaded docs (MAX policy system, Node app architecture, Owner console, master doc) and extract only deltas that affect POC/V1.

---

## Success Criteria
- Stability
  - `backend: yarn jest` → **PASS**
  - `backend: yarn build` → **PASS**
  - `desktop: yarn build` → **PASS**
  - `root: yarn verify` → **PASS**
- Core POC
  - `yarn poc:core-flow` exits 0 and produces `poc-output.json`.
  - Re-running with same idempotency key produces **no duplicate order**.
  - Reject paths show **reason codes** and are deterministic.
- V1 UX
  - Owner can view dashboard, execution matrix, alerts, approvals without runtime errors.
  - Execution mode changes persist and reflect immediately in UI.
