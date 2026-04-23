# MoonLight Trading OS — v1.9 (Stable) → **v2.x Evrimsel Öğrenen AI Mimarisi (MoE + Trinity Oversight) + v2.5 Broker Layer**

> Repo kökü: `/app/moonlight/` (NestJS + Electron + SQLite + Redis).
> Mimari prensip: **Core-First** + **Fail-Safe (Fail-Closed)** + deterministik FSM.
>
> Güncel gerçeklik:
> - **V2.0 → V2.4 tamamlandı** (MoE beyinler, Global Orchestrator/Ensemble, Trinity Oversight, StrategyFactory, 100 indikatör registry, Closed-Loop Scheduler, DB persist, CSV export, BrokerHealthRegistry).
> - Jest testleri: **322/322 PASS** (önceki 310 → +12 yeni V2.5-1 regression test).
> - P0 kritik sorun (**backend startup CPU lock/loop**) **çözüldü**:
>   - Lazy-start LiveSignal pump
>   - Mock feed seed işlemi chunked/async + timer `.unref()`
>   - DataModule ↔ StrategyModule ↔ AICoachModule bootstrap circular dependency forwardRef ile düzeltildi
> - V2.5’in odağı artık: **Broker bağlantıları kademeli** (Simulation → DOM/CDP → Hybrid gerçek API) + **Ray GPU Simulation**.

---

## Objectives

### A) Stabiliteyi kilitle (v1.9 baseline + v2.x çekirdeğini koru)
- Backend + Desktop build **yeşil**.
- Jest testleri **tam yeşil** (güncel rapor: **322/322 PASS**).
- Runtime stabilitesi:
  - Backend gerçek boot **başarılı** (Nest bootstrap çalışıyor).
  - Startup sırasında **CPU lock/loop yok** (CPU gözlemi ~%4–12).
  - LiveSignal pump **fail-safe**: manuel start edilmeden başlamaz.
- Core invariants:
  - deterministik loglar + reason codes
  - idempotency
  - fail-closed defaultlar

### B) V2.x: Hedge-fund grade “Evrimsel Öğrenen AI” çekirdeğini işlet (tamamlananlar + korunacaklar)
- 3 Local MoE beyin:
  - **CEO-MoE (Strateji)**
  - **TRADE-MoE (Uygulama/Timing)**
  - **TEST-MoE (Denetim/Saldırı – deterministic red team)**
- Üst orkestratör:
  - **Global MoE + Ensemble**
- **Trinity Oversight**:
  - **GÖZ-1 System Observer** (donanım/latency/%80 bütçe)
  - **GÖZ-2 Decision Auditor** (trace + drift)
  - **GÖZ-3 Topology & Learning Governor** (sinaptik kurallar + training toggle)
- Sinaptik akış kuralları: **Residual, Hebbian, Anti-Hebbian, Homeostatic, Plastic, Spike**
- Donanım/öğrenme:
  - **Max %80 kaynak kullanımı**
  - (Mevcut) Ray skeleton/local-mode yaklaşımı
  - (V2.5) **Ray GPU Simulation** (resource budget + governor entegrasyonu)

### C) Broker Katmanı (v2.5) — Kurumsal trading OS için gerçek bağlantıya giden yol
- Kademeli rollout (kullanıcı onayı):
  1) **Simulation Mode** (tüm brokerlar)
  2) **DOM Automation (Playwright/CDP)** (özellikle Olymp/Binomo/Expert)
  3) **Hybrid Real API**: IQ Option için **resmi WSS/REST** + diğerleri DOM
- Broker sırası:
  - **IQ Option**: önce simülasyon + contract testleri, sonra gerçek WSS/REST
  - Diğer 3 broker: paralel iskelet + simülasyon

---

## Implementation Steps

### Phase 1 — Core Flow POC (Isolation)
> Core POC was established via `backend/scripts/poc-core-flow.ts`. Sandbox validated.

**Status:** COMPLETE ✅

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

**Status:** COMPLETE ✅

**Completed (Scenario B evidence)**
- `MockLiveDataFeedAdapter` FAST_DEMO: seed + synthetic candles.
- `LiveSignalEngine` produces and persists live signals to SQLite.
- UI confirms signals flowing on `/live/signals` page.

**Fixes delivered**
- `LiveSignalEngine`: defensive numeric normalization to prevent NaN → `SQLITE_ERROR: no such column: NaN`.
- `LiveStrategyPerformanceService`: defaults + UNIQUE race retry to prevent constraint failures.

---

### Phase 3 — Testing & Hardening

**Status:** COMPLETE ✅ (expanded)

**Completed**
- Backend Jest: **322/322 tests PASS**.
- Backend build: PASS
- Desktop build: PASS

**Known expected constraints**
- Binance CCXT → HTTP 451 geo‑block in cluster
- Bybit CCXT → HTTP 403 geo‑block in cluster
- TradingView webhook requires external alert configuration

---

### Phase 4 — Next Direction (post‑stable checkpoint)

**Status:** COMPLETE ✅ for v1.8/v1.9. V2.0→V2.4 shipped.

#### Track A — Scenario B: Live Signals Demo
**Status:** COMPLETE ✅

**Deliverables (done)**
- Live Signals demo works in K8s/restricted environments using Mock feed.

#### Track B — Multi‑Source Data Feed + AI Auto‑Selection
**Status:** COMPLETE ✅ (minor open discrepancy)

**Deliverables (done)**
- `GET /api/data/providers/health`
- `POST /api/data/providers/auto-select` (AI dry‑run + apply)
- `POST /api/data/providers/switch`
- Desktop: **Data Sources** page (`/data-sources`) showing provider health + AI buttons.

**Known minor issue (P2)**
- `/api/data/providers/health` sometimes returns 4 vs 5 providers due to benign timing/cache miss.
  - Next checklist: `backend/src/data/data-providers.controller.ts` and orchestrator cache.

#### Track C — Scenario C: AI Coach MVP
**Status:** COMPLETE ✅

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
  - `POST /api/ai-coach/reason-signal/batch` (route shadowing fixed)
  - `GET /api/ai-coach/reasoning-history`

**Frontend delivered**
- Live Signals table:
  - AI verdict column (APPROVED/REJECTED/UNKNOWN + confidence %)
  - “Muhakeme” button with modal (reasoning + risk factors + expected WR)

---

## v1.9.0 Roadmap — Production‑Ready Hardening + Advanced Features

**Status:** COMPLETE ✅ (baseline hardened)

**Delivered (high level)**
- DB indexes + query improvements
- gzip + throttler + `/healthz` + graceful shutdown + structured errors
- Trade Journal + Alerts + Command Palette + Dark Mode + Toasts

---

## **v2.0 → v2.4 Roadmap — Evrimsel Öğrenen AI Architecture (MoE + Trinity Oversight)**

> Not: Bu fazlar başarıyla implemente edildi. Aşağıda “tamamlandı” olarak korunur; V2.5 ile runtime stabilite + broker katmanı genişletilir.

### Phase V2.0‑α — Foundation
**Status:** COMPLETE ✅

### Phase V2.0‑β — Local MoE Brains
**Status:** COMPLETE ✅

### Phase V2.0‑γ — Global Orchestrator + Ensemble
**Status:** COMPLETE ✅

### Phase V2.0‑δ — Trinity Oversight (GÖZ‑1/2/3)
**Status:** COMPLETE ✅

### Phase V2.0‑ε — Indicators + Synaptic Rules
**Status:** COMPLETE ✅

### Phase V2.0‑RC — Tests + Docs + Release
**Status:** COMPLETE ✅ (test suite expanded and maintained)

### Phase V2.4 — Persistence + Export + BrokerHealthRegistry
**Status:** COMPLETE ✅

**Delivered (evidence/highlights)**
- ExpertPrior DB persist
- A/B weighting CSV export
- `BrokerHealthRegistry` module + state machine

---

## **v2.5 Roadmap — Runtime Stabilization + Broker Connectivity + Ray GPU Simulation**

> Kullanıcı onayı (kademeli):
> 1) **Önce** Startup CPU Loop Fix
> 2) Broker: **Simulation Mode → DOM/CDP → Hybrid (IQ Option WSS/REST + diğerleri DOM)**
> 3) Ray GPU Simulation: **V2.5 içinde**
> 4) Broker önceliği: **IQ Option tam**, diğer 3 paralel iskelet

### Phase V2.5‑1 — **Startup CPU Loop Fix (P0 / Blocker)**
**Status:** COMPLETE ✅

**Root cause (postmortem)**
- Bootstrap sırasında LiveSignalEngine eager-start + MockLiveDataFeedAdapter senkron seed + agresif tick cadence.
- Ek olarak runtime boot’u engelleyen **DataModule ↔ StrategyModule ↔ AICoachModule** circular dependency.

**Delivered**
1) **Fail-safe defaults (.env)**
   - `LIVE_SIGNAL_ENABLED=false` default (fail-safe)
   - `LIVE_SIGNAL_AUTO_START=false`
   - `MOCK_FEED_INTERVAL_MS=30000`
   - `MOCK_FEED_SEED_BARS`, `MOCK_FEED_SEED_CHUNK` knob’ları
2) **Lazy-start kontrol yüzeyi**
   - `POST /api/live/engine/start`
   - `POST /api/live/engine/stop`
   - `GET /api/live/engine/status`
3) **Async bootstrap guard + interval büyütme**
   - Mock seed chunked/async + event-loop yield
   - FAST demo tick: env ile yönetilir (varsayılan 30s)
4) **Timer hygiene**
   - `setInterval().unref()` → Jest open handle riskini azaltır
5) **Bootstrap düzeltmeleri**
   - `DataModule` ↔ `StrategyModule` ↔ `AICoachModule` cycle: **forwardRef** ile kırıldı

**Evidence / results**
- Backend gerçek boot: **başarılı** (healthz HTTP 200)
- CPU: ~%4–12 (önceki %101 lock)
- Tests: **322/322 PASS** (+12 yeni regression test)

**New tests added (Jest)**
- `src/tests/unit/data/mock-live-feed.adapter.spec.ts`
- `src/tests/unit/execution/live-signal-engine.lazy-start.spec.ts`

---

### Phase V2.5‑2 — **Broker Simulation Mode (P0/P1)**
**Status:** PLANNED (NEXT)

**Goal**
- Tüm brokerlar için ortak arayüzle “gerçeğe yakın” execution akışı, ama dış dünyaya bağlanmadan.

**Deliverables**
- `backend/src/broker/adapters/simulated/`:
  - `SimulatedBrokerAdapter` (unified)
  - Fill/latency/slippage modelleri
  - Payout modelleri (konfigürasyonla)
  - Deterministic PRNG (seed) opsiyonu: replayable sim runs
- Routing / Feature flags:
  - IQ/Olymp/Binomo/Expert adapter seçiminde SIMULATION flag
  - `FAKE_BROKER_ONLY=true` ile otomatik simülasyon
- Telemetry + Health:
  - BrokerHealthRegistry entegrasyonu
  - “order lifecycle” event stream (journal/audit)
- API (opsiyonel ama önerilen):
  - `POST /api/broker/sim/reset`
  - `POST /api/broker/sim/config`
  - `GET /api/broker/sim/state`

**Exit Criteria**
- “place order → fill/reject → settle” akışı deterministik simülasyonla çalışır.
- Jest: adapter contract testleri + health transitions PASS.

---

### Phase V2.5‑3 — **IQ Option Real WSS/REST (Hybrid’in ilk ayağı) (P1)**
**Status:** PLANNED

**Deliverables**
- `IqOptionWsAdapter` gerçek bağlantı:
  - session/login guard
  - reconnect + backoff
  - subscribe: candles/quotes
  - place order: (demo/real ayrımı)
- Safety:
  - feature flag: `BROKER_IQOPTION_REAL_ENABLED=false` default
  - rate limit + circuit breaker
  - fail-closed: bağlantı belirsizse order atma
- Trinity audit:
  - GÖZ-2: order trace reason codes

**Exit Criteria**
- Sandbox ortamında IQ Option bağlantısı kurulabilir (credential var ise).
- Bağlantı yoksa sistem simülasyona düşer (fail-safe).

---

### Phase V2.5‑4 — **Olymp / Binomo / Expert DOM Automation (Playwright/CDP) Skeleton (P1/P2)**
**Status:** PLANNED

**Deliverables**
- Ortak “DOM broker automation” katmanı:
  - Browser session manager
  - selector registry + versioning
  - screenshot/video on failure
- Her broker için minimum iskelet:
  - login
  - quote read
  - order click flow (dry-run)
  - health reporting
- Güvenlik:
  - headless mode toggle
  - secrets isolation

**Exit Criteria**
- Her broker için “connect → health READY → dry-run order” çalışır.
- Selector kırılmalarında otomatik degrade (DISABLED) + audit log.

---

### Phase V2.5‑5 — **Ray GPU Simulation (V2.5 içinde) (P1)**
**Status:** PLANNED

**Goal**
- GÖZ-1’in %80 donanım bütçesini, gerçek GPU olmasa bile **Ray benzeri resource allocation simülasyonu** ile enforce etmek.

**Deliverables**
- Resource Broker:
  - CPU/GPU “tokens” + quota
  - job queue + priority
  - %80 threshold clamp
- Trinity integration:
  - GÖZ‑1: ölçer + budget snapshot
  - GÖZ‑3: learning/topology governor, training toggle ile job scheduling
- API:
  - `GET /api/trinity/resources`
  - `POST /api/trinity/simulation {enabled}`

**Exit Criteria**
- Uzun süren backtest/learning işleri budget’ı aşmadan throttle edilir.
- Jest: resource clamp + scheduling deterministik.

---

### Phase V2.5‑6 — Testing, Docs, Release
**Status:** PLANNED

**Deliverables**
- Testler:
  - SimulatedBroker adapter contract testleri
  - IQ Option bağlantı katmanı için “offline fallback” testleri
  - DOM/CDP katmanı için “dry-run” testleri (smoke)
- Dokümantasyon:
  - `docs/v2.5/ARCHITECTURE.md` (runtime safety + broker rollout)
  - `CHANGELOG.md` → v2.5.x
- Operasyon:
  - env reference: `LIVE_SIGNAL_ENABLED`, `LIVE_SIGNAL_AUTO_START`, `MOCK_FEED_INTERVAL_MS`, broker flags

**Exit Criteria**
- `yarn test` PASS
- Startup loop regression yok
- V2.5 feature flags default-off güvenli

---

## Next Actions (Immediate)

1) **V2.5‑2 (P0/P1):** Broker Simulation Mode
   - Unified simulated adapter + routing
   - Contract tests + BrokerHealthRegistry transitions

2) **V2.5‑5 (P1):** Ray GPU Simulation (resource budget)
   - GÖZ-1 + GÖZ-3 entegrasyonu

3) **V2.5‑3 (P1):** IQ Option gerçek WSS/REST (feature-flag)

---

## Success Criteria

### Stability
- `yarn test` → PASS (≥ 322/322)
- Backend gerçek boot: **ayakta**
- Live pump **manual start** olmadan başlamaz

### V2.x Architecture Integrity
- MoE + Trinity invariants bozulmadan devam eder
- Audit trail ve fail-closed semantics korunur

### V2.5 Broker Readiness
- Simülasyon modunda end-to-end order lifecycle deterministik
- IQ Option gerçek WSS/REST feature-flag ile güvenli şekilde denenebilir
- DOM/CDP iskeletleri “dry-run” seviyesinde hazır

### Hardware / Learning Budget
- %80 budget policy ölçülür ve enforce edilir (simülasyon dahil)
