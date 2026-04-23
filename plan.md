# MoonLight Trading OS — v1.9 (Stable) → **v2.x Evrimsel Öğrenen AI Mimarisi (MoE + Trinity Oversight)** → **v2.5 Runtime + Broker Layer (DONE)** → **v2.6 Windows .exe Productionization (NEXT)**

> Repo kökü: `/app/moonlight/` (Backend: NestJS + SQLite + Redis, Desktop: Electron + React).
> Mimari prensip: **Core‑First** + **Fail‑Safe (Fail‑Closed)** + deterministik FSM + auditability.
>
> Güncel gerçeklik:
> - **V2.0 → V2.4 tamamlandı** (MoE beyinler, Global Orchestrator/Ensemble, Trinity Oversight, StrategyFactory, 100 indikatör registry, Closed‑Loop Scheduler, DB persist, CSV export, BrokerHealthRegistry).
> - **V2.5 yol haritası TAMAMEN bitti** ✅: V2.5‑1/2/3/4/5/6 **COMPLETED**.
> - Jest testleri: **366/366 PASS** ✅.
> - Backend gerçek boot stabil + canlı smoke doğrulandı (`/api/healthz` 200, CPU stabil).
> - Yeni doküman: `docs/v2.5/ARCHITECTURE.md` + `.env` referans güncellemeleri.
>
> Sıradaki ana hedef (kullanıcı ihtiyacı):
> - **Windows .exe olarak “çift tıkla çalışsın”** (Desktop + Backend birlikte paketlenmiş)
> - güvenli secrets vault
> - installer + (opsiyonel) code signing
> - crash reporter + auto‑update
> - (opsiyonel) IQ Option gerçek WSS hardening + DOM live click hardening + payout stream + router tuning

---

## Objectives

### A) Stabiliteyi kilitle (v1.9 baseline + v2.x çekirdeğini koru)
- Backend + Desktop build **yeşil**.
- Jest testleri **tam yeşil** (**366/366 PASS**).
- Runtime stabilitesi:
  - Backend gerçek boot **başarılı**.
  - Startup sırasında **CPU lock/loop yok**.
  - LiveSignal pump **fail‑safe**: manuel start edilmeden başlamaz.
- Core invariants:
  - deterministik loglar + reason codes
  - idempotency
  - fail‑closed defaultlar

### B) V2.x: Hedge‑fund grade “Evrimsel Öğrenen AI” çekirdeğini işlet (korunacaklar)
- 3 Local MoE beyin:
  - **CEO‑MoE (Strateji)**
  - **TRADE‑MoE (Uygulama/Timing)**
  - **TEST‑MoE (Denetim/Saldırı – deterministic red team)**
- Üst orkestratör:
  - **Global MoE + Ensemble**
- **Trinity Oversight**:
  - **GÖZ‑1 System Observer** (donanım/latency/%80 bütçe)
  - **GÖZ‑2 Decision Auditor** (trace + drift)
  - **GÖZ‑3 Topology & Learning Governor** (sinaptik kurallar + training toggle)
- Donanım/öğrenme:
  - **Max %80 kaynak kullanımı**
  - (V2.5‑5) CPU/GPU token broker + queue/priority + simulation toggle

### C) Broker katmanı hedefleri (kademeli rollout)
- Simulation Mode (deterministic/replayable) ✅
- DOM Automation (Playwright) skeleton + dry‑run safety ✅
- IQ Option real WSS feature‑flag guard ✅
- **Windows prod hedefinde**: broker erişimi ve secrets güvenliği “default‑off / opt‑in” kalacak.

### D) v2.6 ana hedef: Windows .exe “gerçek kullanıcı makinesinde” sorunsuz çalıştırma
- Tek kurulum paketi: Desktop + Backend birlikte.
- Backend process yönetimi: spawn/health check/restart/shutdown.
- Güvenli secrets storage (OS keychain).
- Installer (NSIS) + opsiyonel code signing.
- Crash reporting + auto update.

---

## Implementation Steps

### Phase 1 — Core Flow POC (Isolation)
**Status:** COMPLETE ✅

### Phase 2 — V1 App Development (Backend + Desktop around proven core)
**Status:** COMPLETE ✅

### Phase 3 — Testing & Hardening
**Status:** COMPLETE ✅
- Jest: **366/366 PASS**

### Phase 4 — Next Direction (post‑stable checkpoint)
**Status:** COMPLETE ✅

---

## **v2.0 → v2.4 Roadmap — Evrimsel Öğrenen AI Architecture (MoE + Trinity Oversight)**
**Status:** COMPLETE ✅

---

## **v2.5 Roadmap — Runtime Stabilization + Broker Connectivity + Ray GPU Simulation**

> Kullanıcı onayı ile başlayan V2.5 yol haritası **tamamlandı**.

### Phase V2.5‑1 — Startup CPU Loop Fix (P0)
**Status:** COMPLETE ✅
- LiveSignal lazy‑start
- Mock feed chunked seed + `.unref()`
- Bootstrap circular‑dep (Data↔Strategy↔AICoach) forwardRef
- Endpoints: `/api/live/engine/start|stop|status`

### Phase V2.5‑2 — Broker Simulation Mode (P0/P1)
**Status:** COMPLETE ✅
- Deterministic PRNG (`DeterministicPrng` + `gaussianSample`)
- Unified `SimulatedBrokerAdapter` + profiles
- `BrokerSimRegistry` + BrokerModule wiring
- Endpoints: `/api/broker/sim/state|reset|configure`

### Phase V2.5‑3 — IQ Option Real WSS/REST (Guard)
**Status:** COMPLETE ✅ (Guard/Fail‑safe)
- `BROKER_IQOPTION_REAL_ENABLED` default OFF
- Flag off: connect throws `IQ_OPTION_REAL_DISABLED`, sendOrder REJECT `REAL_DISABLED`

### Phase V2.5‑4 — DOM Automation Skeleton (Playwright/CDP)
**Status:** COMPLETE ✅
- Lazy Playwright loader + selector registry (versioned)
- 3 adapters: Olymp/Binomo/Expert
- Two‑tier safety flags: `BROKER_DOM_AUTOMATION_ENABLED`, `BROKER_DOM_LIVE_ORDERS`
- Endpoints: `/api/broker/dom/status|connect|disconnect`

### Phase V2.5‑5 — Ray GPU Simulation / Resource Broker
**Status:** COMPLETE ✅
- CPU/GPU token bucket + queue/priority
- Endpoints: `/api/trinity/resources`, `/api/trinity/simulation`

### Phase V2.5‑6 — Testing, Docs, Release
**Status:** COMPLETE ✅
- `docs/v2.5/ARCHITECTURE.md`
- `.env` reference updated
- Backend runtime smoke verified

---

## **v2.6 Roadmap — Windows .exe Productionization (NEXT)**

> Amaç: MoonLight Owner Console’un Windows’ta tek kurulumla (installer) çalışması.
> “Çift tıkla çalıştır” deneyimi: Desktop açılır, backend otomatik başlar, health kontrol edilir,
> port/URL yönetilir, kapanışta backend kapatılır.

### Phase V2.6‑1 — Electron + Backend Bundling (P0)
**Status:** PLANNED

**Problem**
- Desktop (Electron) şu an sadece renderer’ı açıyor; backend process’i paketlenmiyor/başlamıyor.

**Deliverables**
- Backend packaging stratejisi (seçim):
  - A) `pkg` ile Node backend’i tek binary 
  - B) `node` runtime + `dist/` bundle’ı `extraResources` ile paketlemek
- Electron main process:
  - `child_process.spawn` ile backend başlatma
  - health‑check loop (`/api/healthz`) + port conflict çözümü
  - graceful shutdown (app quit → backend kill)
  - log forwarding (backend stdout/stderr → file)
- `electron-builder` config:
  - `extraResources` / `files` düzeni
  - windows target: `nsis` + `portable` (opsiyonel)

**Exit Criteria**
- `yarn desktop:dist` (veya eşdeğer) çıktısı Windows’ta backend ile birlikte çalışır.

### Phase V2.6‑2 — Credentials Vault (P0/P1)
**Status:** PLANNED

**Deliverables**
- `node-keytar` ile OS keychain/DPAPI entegrasyonu
- UI’dan secrets set/get (minimum):
  - IQ Option SSID
  - broker DOM email/password
  - (opsiyonel) exchange API keys
- `.env` plaintext credentials kullanımını prod modunda disable eden politika

**Exit Criteria**
- Secrets plaintext dosyada tutulmadan kullanılabilir.

### Phase V2.6‑3 — Windows Installer + Code Signing (P1)
**Status:** PLANNED

**Deliverables**
- NSIS installer:
  - install dir
  - start menu shortcut
  - uninstall
- Code signing pipeline (opsiyonel ama önerilir):
  - sertifika, build step

**Exit Criteria**
- Windows Defender/SmartScreen friction minimize.

### Phase V2.6‑4 — Auto‑Update + Crash Reporter (P1)
**Status:** PLANNED

**Deliverables**
- `electron-updater` ile update kanalı
- Crash reporting:
  - electron crash dumps
  - backend crash logs
- Minimum telemetry: version, uptime, last crash reason

### Phase V2.6‑5 — Real Payout Matrix Stream (P1/P2)
**Status:** PLANNED

**Deliverables**
- IQ Option (real) payout stream parsing + caching
- DOM brokers için payout read (best-effort)
- PayoutMatrixService canlı veri ile güncellenir

### Phase V2.6‑6 — Multi‑Broker Intelligent Routing Tuning (P2)
**Status:** PLANNED

**Deliverables**
- Routing scoring policy:
  - latency p95
  - reject rate
  - payout
  - health state
- Trinity audit reason codes: “why broker X chosen?”

---

## Next Actions (Immediate)

1) **V2.6‑1:** Electron + Backend bundling (spawn + health check + electron-builder)
2) **V2.6‑2:** Credentials Vault (keytar)
3) **V2.6‑3:** NSIS installer + (opsiyonel) code signing

---

## Success Criteria

### Stability
- `cd /app/moonlight/backend && yarn test` → PASS (≥ 366/366)
- Backend boot: stable, `/api/healthz` 200

### Windows .exe readiness
- Single installer ships Desktop + Backend
- App double-click: Desktop launches, backend auto-starts, UI connects
- Secrets stored in OS keychain

### Production safety
- Real broker connections remain opt‑in (feature flags default OFF)
- Dry‑run defaults preserved; live order flags require explicit operator opt‑in
