# MoonLight Trading OS — v1.9 (Stable) → **v2.0 Evrimsel Öğrenen AI Mimarisi (MoE + Trinity Oversight)**

> Repo kökü: `/app/moonlight/` (NestJS + Electron + SQLite + Redis).  
> Mimari prensip: **Core-First** + **Fail-Safe (Fail-Closed)** + deterministik FSM.  
> V2.0 kararları (kullanıcı onayı): **Ray local-mode**, **Hibrit experts (CEO/TRADE = Gemini, TEST = deterministik)**, **38 parite seed (yaygın set)**, **100 indikatör tek seferde**, **Trinity UI ayrı `/trinity` route**.

---

## Objectives

### A) Stabiliteyi kilitle (v1.9 baseline)
- Backend + Desktop build **yeşil**.
- Jest testleri **tam yeşil** (mevcut rapor: **163/163 PASS**).
- Core invariants:
  - deterministik loglar + reason codes
  - idempotency
  - fail-closed defaultlar

### B) V2.0: Hedge-fund grade “Evrimsel Öğrenen AI” çekirdeğini kur
- 3 Local MoE beyin:
  - **CEO-MoE (Strateji)**
  - **TRADE-MoE (Uygulama/Timing)**
  - **TEST-MoE (Denetim/Saldırı – deterministic red team)**
- Üst orkestratör:
  - **Global MoE + Ensemble** (3 beyin çıktısını tek nihai karara dönüştürür)
- **Trinity Oversight**:
  - **GÖZ-1 System Observer** (donanım/latency/%80 bütçe)
  - **GÖZ-2 Decision Auditor** (trace + drift)
  - **GÖZ-3 Topology & Learning Governor** (sinaptik kurallar + training toggle)
- Sinaptik akış kuralları: **Residual, Hebbian, Anti-Hebbian, Homeostatic, Plastic, Spike**
- Donanım/öğrenme:
  - **Max %80 kaynak kullanımı**
  - **Ray local-mode** (tek process, thread pool) + resource broker
  - runtime **Training Mode toggle**

### C) Piyasalar: kapsam genişletme
- **38 işlem çifti** (Forex + Kripto + Emtia) + seed
- **7 timeframe**: `5m, 15m, 30m, 1h, 2h, 4h, 8h`
- **100 indikatör şablonu** (tek seferde) → StrategyFactory entegrasyonu

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
- Backend Jest: **163/163 tests PASS**.
- Backend build: PASS
- Desktop build: PASS

**Known expected constraints**
- Binance CCXT → HTTP 451 geo‑block in cluster
- Bybit CCXT → HTTP 403 geo‑block in cluster
- TradingView webhook requires external alert configuration

---

### Phase 4 — Next Direction (post‑stable checkpoint)

**Status:** COMPLETE for v1.8/v1.9. Moving to v2.0

#### Track A — Scenario B: Live Signals Demo
**Status:** COMPLETE

**Deliverables (done)**
- Live Signals demo works in K8s/restricted environments using Mock feed.

#### Track B — Multi‑Source Data Feed + AI Auto‑Selection
**Status:** COMPLETE (minor open discrepancy)

**Deliverables (done)**
- `GET /api/data/providers/health`
- `POST /api/data/providers/auto-select` (AI dry‑run + apply)
- `POST /api/data/providers/switch`
- Desktop: **Data Sources** page (`/data-sources`) showing provider health + AI buttons.

**Known minor issue (P2)**
- `/api/data/providers/health` sometimes returns 4 vs 5 providers due to benign timing/cache miss.
  - Next checklist: `backend/src/data/data-providers.controller.ts` and orchestrator cache.

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

## **v2.0 Roadmap — Evrimsel Öğrenen AI Architecture (MoE + Trinity Oversight)**

> V2.0 hedefi: mevcut üretim çekirdeğini bozmadan, AI karar mekanizmasını **tekil reasoning → MoE (CEO/TRADE/TEST) + Trinity Oversight** yapısına refactor etmek.

### Phase V2.0‑α — Foundation (IN PROGRESS)
**Goal:** V2.0 iskeleti + veri kapsamı + kaynak yönetimi.

**Deliverables**
- **NestJS modülleri (iskelet):**
  - `backend/src/moe-brain/` (Local brains + global orchestrator contracts)
  - `backend/src/trinity-oversight/` (Eyes + consensus)
  - (opsiyonel) `backend/src/training/` (toggle + job registry)
- **Ray local-mode bootstrap:**
  - tek process, thread pool benzeri actor modeli
  - %80 donanım bütçe politikası (GÖZ‑1 ölçer, governor enforce eder)
- **DB seed (idempotent):**
  - `product_execution_config` → 38 parite + 7 TF (`5m,15m,30m,1h,2h,4h,8h`)
- **Enum/contract tanımları:**
  - `BrainType`, `ExpertRole`, `TrinityEye`, `SynapticRule`
- **Docs:** `docs/v2/` altında mimari taslak

**Exit Criteria**
- `yarn test` PASS
- Seed script tekrar çalıştırılınca duplicate üretmemeli
- `/api/trinity/status` stub endpoint ayakta (health + resource snapshot)

---

### Phase V2.0‑β — Local MoE Brains
**Goal:** 3 beynin (CEO/TRADE/TEST) çalışır gating + expert çağrı zinciri.

**Deliverables**
- **CEOBrainService (Gemini 2.5 Flash / persona experts):**
  - TrendExpert, MeanReversionExpert, VolatilityExpert, NewsExpert, MacroExpert
- **TRADEBrainService (Gemini 2.5 Flash / persona experts):**
  - EntryExpert, ExitExpert, SlippageExpert, PayoutExpert, SessionExpert
- **TESTBrainService (Deterministic / rule-based):**
  - OverfitHunter, DataLeakDetector, BiasAuditor, AdversarialAttacker, RobustnessTester
- **Per-brain gating network:**
  - softmax weights (başlangıç heuristics + telemetry-driven adjust)
- **Trace model:** her expert çıktısı + skor + reason codes persist edilir (GÖZ‑2 ile uyumlu)

**Exit Criteria**
- `POST /api/moe/brain/:type/evaluate` çalışır (CEO/TRADE/TEST)
- TEST-MoE veto/flag üretebilir

---

### Phase V2.0‑γ — Global Orchestrator + Ensemble
**Goal:** 3 beyin çıktısını tek karar haline getirip FSM’e bağlamak.

**Deliverables**
- `GlobalMoEOrchestrator`:
  - CEO + TRADE + TEST outputs → weighted ensemble
  - TEST veto/circuit semantics (fail-closed)
- FSM entegrasyonu:
  - `execution` katmanında MoE gate hook
  - sinyal → karar → (ALLOW / SKIP / VETO / MANUAL_REVIEW)
- Endpoint:
  - `POST /api/moe/evaluate` (signal in → decision out)

**Exit Criteria**
- Live signal üretimi MoE değerlendirme ile “overlay” edilebilir (strict off by default)
- MoE failure durumunda deterministik fallback: SAFE_SKIP

---

### Phase V2.0‑δ — Trinity Oversight (GÖZ‑1/2/3)
**Goal:** İzleme, denetim, topology/learning governor katmanını işletmek.

**Deliverables**
- **GÖZ‑1 System Observer**
  - CPU/RAM/event-loop lag/queue depth/latency sampling
  - %80 budget threshold + throttling önerisi
- **GÖZ‑2 Decision Auditor**
  - per-signal decision trace (inputs, experts, weights, final)
  - drift: KS-test/PSI stub (sonradan genişler)
- **GÖZ‑3 Topology & Learning Governor**
  - synaptic weight update hooks (V2.0‑ε’ye temel)
  - training toggle state machine (on/off)
- **Consensus service:** 2‑of‑3 majority, 3‑of‑3 critical veto
- **Endpoints:**
  - `GET /api/trinity/status`
  - `GET /api/trinity/audit`
  - `GET /api/trinity/topology`
- **Frontend (Electron renderer):**
  - yeni `/trinity` route
  - paneller: System Health, Decision Audit Timeline, Topology Graph (v1)

**Exit Criteria**
- Trinity ekranı canlı veriyle doluyor (mock telemetry dahil)
- MoE kararları için audit trace UI’da izlenebilir

---

### Phase V2.0‑ε — Indicators + Synaptic Rules
**Goal:** 100 indikatörü StrategyFactory’ye sokmak + sinaptik kuralları kodlamak.

**Deliverables**
- **100 indikatör tek seferde entegrasyon:**
  - `docs/v2/100-indicators.md` kaynak
  - `backend/src/indicators/templates/` altında YAML + TS pair
  - StrategyFactory injection + backtest/live compatibility
- **Synaptic rules service:**
  - Residual, Hebbian, Anti-Hebbian, Homeostatic, Plastic, Spike
  - ağırlık güncelleme “guardrail” (clamp, decay, max step)
- **Training toggle endpoint:**
  - `POST /api/trinity/training {enabled: boolean}`

**Exit Criteria**
- Tüm indikatörler registry’den load edilebilir
- En az 20 örnek strateji kombinasyonu “compile” edilebilir

---

### Phase V2.0‑RC — Tests + Docs + Release
**Goal:** Kurumsal seviyede doğrulama, dokümantasyon ve sürümleme.

**Deliverables**
- **+80 Jest test**:
  - brain gating, consensus, veto semantics
  - seed idempotency
  - synaptic rule clamps
  - deterministic TEST-MoE audit
- Backend testing agent full run
- `CHANGELOG.md` → v2.0.0
- `docs/v2/ARCHITECTURE.md` (MoE + Trinity + fail-safe + resource model)

**Exit Criteria**
- Testler tam yeşil, regressions yok
- V2.0 feature flags ile güvenli rollout (default-off)

---

## Next Actions (Immediate)
1. **V2.0‑α:** `moe-brain` + `trinity-oversight` NestJS modül iskeletlerini oluştur
2. **V2.0‑α:** 38 parite + 7 TF için idempotent seed script ekle (`product_execution_config`)
3. **V2.0‑α:** Ray local-mode resource broker stub (max %80 budget) + GÖZ‑1 telemetry
4. **V2.0‑α:** `/api/trinity/status` stub endpoint + minimal DTO’lar
5. (P2) `/api/data/providers/health` discrepancy için cache/timing kontrolü

---

## Success Criteria

### Stability
- `yarn test` → PASS
- Backend + Desktop build → PASS

### V2.0 Architecture
- 3 Local MoE beyin + Global Orchestrator contracts hazır
- Trinity (GÖZ‑1/2/3) status/audit/topology endpointleri ayakta
- Training toggle iskeleti + %80 resource policy çalışır

### Market Coverage
- 38 parite + 7 timeframe seed edilmiş ve UI/engine tarafından görülebilir

### AI Quality & Safety
- TEST-MoE deterministik veto hattı mevcut
- Fail-closed: AI/Ray/LLM hata durumunda SAFE_SKIP / MANUAL_REVIEW
