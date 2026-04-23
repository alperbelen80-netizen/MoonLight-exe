# MoonLight Trading OS — v1.9 (Stable) → **v2.x Evrimsel Öğrenen AI Mimarisi (MoE + Trinity Oversight)** → **v2.5 Runtime + Broker Layer (DONE)** → **v2.6 Windows .exe Productionization (IN PROGRESS)**

> Repo kökü: `/app/moonlight/` (Backend: NestJS + SQLite + Redis, Desktop: Electron + React).
> Mimari prensip: **Core‑First** + **Fail‑Safe (Fail‑Closed)** + deterministik FSM + auditability.
>
> Güncel gerçeklik:
> - **V2.0 → V2.4 tamamlandı** (MoE beyinler, Global Orchestrator/Ensemble, Trinity Oversight, StrategyFactory, 100 indikatör registry, Closed‑Loop Scheduler, DB persist, CSV export, BrokerHealthRegistry).
> - **V2.5 yol haritası TAMAMEN bitti** ✅: V2.5‑1/2/3/4/5/6 **COMPLETED**.
> - Backend gerçek boot stabil + canlı smoke doğrulandı (`/api/healthz` 200, CPU stabil).
> - Doküman: `docs/v2.5/ARCHITECTURE.md` + `.env` referans güncellemeleri.
> - **V2.6‑1 tamamlandı** ✅: Electron ↔ Backend bundling, BackendManager spawn/health/shutdown, IPC bridge, electron-builder `extraResources`, bundle-safe config resolver, smoke PASS.
> - **V2.6‑2 tamamlandı** ✅: Credentials Vault (keytar + AES-256-GCM fallback), localhost-only secrets API, vault‑first broker credentials + packaged strict policy, Electron IPC vault bridge, Settings UI vault panel.
> - Test durumu:
>   - Backend Jest: **387/387 PASS** ✅
>   - Desktop main Vitest (BackendManager): **9/9 PASS** ✅
>   - Bundled spawn smoke: **PASS** ✅
>
> Sıradaki ana hedef (kullanıcı ihtiyacı):
> - **Windows .exe olarak “çift tıkla çalışsın”** (Desktop + Backend birlikte paketlenmiş) ✅ *temel bundling tamam*
> - **güvenli secrets vault** ✅ *(V2.6‑2 bitti; packaged strict policy aktif)*
> - **installer + (opsiyonel) code signing** 🔜 (**V2.6‑3 NEXT**)
> - **crash reporter + auto‑update** 🔜 (**V2.6‑4**)
> - (opsiyonel) IQ Option gerçek WSS hardening + DOM live click hardening + payout stream + router tuning 🔜 (**V2.6‑5/6**)

---

## Objectives

### A) Stabiliteyi kilitle (v1.9 baseline + v2.x çekirdeğini koru)
- Backend + Desktop build **yeşil**.
- Testler **tam yeşil**:
  - Backend Jest: **387/387 PASS** ✅
  - Desktop main Vitest: **9/9 PASS** ✅
  - Bundled spawn smoke: **PASS** ✅
- Runtime stabilitesi:
  - Backend gerçek boot **başarılı** ✅
  - Startup sırasında **CPU lock/loop yok** ✅
  - LiveSignal pump **fail‑safe**: manuel start edilmeden başlamaz ✅
  - Broker live yolları **default‑off** ✅
  - Packaged modda secrets **fail‑closed** (vault yoksa env kabul edilmez) ✅
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
  - (V2.5‑5) CPU/GPU token broker + queue/priority + simulation toggle ✅

### C) Broker katmanı hedefleri (kademeli rollout)
- Simulation Mode (deterministic/replayable) ✅
- DOM Automation (Playwright) skeleton + dry‑run safety ✅
- IQ Option real WSS feature‑flag guard ✅
- **Windows prod hedefinde**: broker erişimi ve secrets güvenliği “default‑off / opt‑in” kalacak.

### D) v2.6 ana hedef: Windows .exe “gerçek kullanıcı makinesinde” sorunsuz çalıştırma
- Tek kurulum paketi: Desktop + Backend birlikte. ✅ *(V2.6‑1 payload hazır)*
- Backend process yönetimi: spawn/health check/restart/shutdown. ✅ *(V2.6‑1)*
- Güvenli secrets storage (OS keychain) + fallback. ✅ *(V2.6‑2)*
- Installer (NSIS) + opsiyonel code signing. 🔜 *(V2.6‑3)*
- Crash reporting + auto update. 🔜 *(V2.6‑4)*

---

## Implementation Steps

### Phase 1 — Core Flow POC (Isolation)
**Status:** COMPLETE ✅

### Phase 2 — V1 App Development (Backend + Desktop around proven core)
**Status:** COMPLETE ✅

### Phase 3 — Testing & Hardening
**Status:** COMPLETE ✅
- Backend Jest: **387/387 PASS**

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

## **v2.6 Roadmap — Windows .exe Productionization (IN PROGRESS)**

> Amaç: MoonLight Owner Console’un Windows’ta tek kurulumla (installer) çalışması.
> “Çift tıkla çalıştır” deneyimi: Desktop açılır, backend otomatik başlar, health kontrol edilir,
> port/URL yönetilir, kapanışta backend kapatılır.

### Phase V2.6‑1 — Electron + Backend Bundling (P0)
**Status:** COMPLETE ✅

**Problem**
- Desktop (Electron) sadece renderer’ı açıyordu; backend process’i paketlenmiyor/başlamıyordu.
- Backend bazı config dosyalarını `process.cwd()/src/...` üzerinden okuyordu; packaged/bundled CWD değişince boot çöküyordu.

**Deliverables (Delivered)**
- Backend packaging:
  - `esbuild` ile **single-file backend bundle**: `dist-bundle/backend.js`
  - External (native/bundle-hostile) deps runtime’da `backend/node_modules` üzerinden resolve
  - `bundle:backend` ve `bundle:backend:prod` scriptleri
- Electron main process:
  - `BackendManager` (spawn + health-check + port conflict çözümü + shutdown)
  - Log forwarding: `app.getPath('logs')/backend.log`
  - IPC bridge: `window.moonlight.getBackendPort()` + `restartBackend()`
  - Renderer `api-client` dinamik port çözümleme
- electron-builder:
  - `extraResources`: `dist-bundle/` + `backend/node_modules/` + `.env.example`
  - NSIS x64 config
- Bundle-safe config resolution:
  - `resolveConfigPath()` / `resolveConfigDir()` helper
  - `hardware-profile`, `policy-loader`, `indicator-registry`, `preset-loader` bundle-safe hale getirildi
- Testler:
  - Desktop main Vitest: **9/9 PASS**
  - Bundled spawn smoke: **PASS**
  - Backend Jest: **366/366 PASS** (V2.6‑1 snapshot)

**Exit Criteria**
- Backend bundle üretilebilir ve Electron tarafından spawn edilerek `/api/healthz` yeşile döner ✅

### Phase V2.6‑2 — Credentials Vault (P0/P1)
**Status:** COMPLETE ✅

**Problem**
- Secrets `.env` üzerinden plaintext; Windows `.exe` için prod-grade güvenlik şart.

**Deliverables (Delivered)**
- Backend vault:
  - `SecretsStoreService` (dual backend)
    - `keytar` primary (OS keychain/DPAPI) **lazy require**
    - AES‑256‑GCM encrypted-file fallback (machine-bound scrypt key)
  - Audit trail (set/get/delete/list/has) + actor + reason
- REST API (localhost-only):
  - `GET /api/secrets/health`
  - `GET /api/secrets` (masked list)
  - `GET /api/secrets/:key/exists`
  - `PUT /api/secrets/:key {value}`
  - `DELETE /api/secrets/:key`
  - `GET /api/secrets/audit/trail`
- Policy (fail‑closed):
  - `BrokerCredentialsService` vault-first + cache + `refresh()`
  - Packaged default strict: `MOONLIGHT_PACKAGED=true` → env-only secrets **refused**
  - Override: `MOONLIGHT_VAULT_STRICT=true|false`
- Electron:
  - preload: `window.moonlight.vault.*`
  - main: IPC handlers → backend `/api/secrets` proxy via Electron `net.request`
- Desktop UI:
  - Settings → `CredentialsVaultPanel` (masked previews + set/delete)

**Tests (Delivered)**
- Backend Jest: **387/387 PASS** ✅ (V2.6‑2 final)
  - 21 yeni test (vault + broker-credentials strict/vault-first)
- Runtime smoke: secrets set/list/exists/audit/delete doğrulandı ✅

**Exit Criteria**
- Secrets plaintext dosyada tutulmadan kullanılabilir ✅
- Packaged modda vault yoksa secrets fail‑closed ✅

### Phase V2.6‑3 — Windows Installer + Code Signing (P1)
**Status:** PLANNED (NEXT)

**Deliverables**
- Windows build pipeline (gerçek Windows host veya Wine CI):
  - `yarn package:desktop:win` çalıştırılır
  - çıktılar: NSIS installer + portable (opsiyonel)
- NSIS hardening:
  - uninstall doğrulama
  - per-user install, shortcut’lar
  - logs/data dizinleri
  - upgrade path (mevcut install üstüne kurulum)
- Code signing pipeline (opsiyonel ama önerilir):
  - sertifika temini
  - build step + imzalama

**Exit Criteria**
- Windows’ta installer ile kurulum + çift tıkla açılış sorunsuz
- Defender/SmartScreen friction minimize

### Phase V2.6‑4 — Auto‑Update + Crash Reporter (P1)
**Status:** PLANNED

**Deliverables**
- `electron-updater` ile update kanalı
- Crash reporting:
  - electron crash dumps
  - backend crash logs + last error reason
- Minimum telemetry: version, uptime, last crash reason

### Phase V2.6‑5 — Real Payout Matrix Stream + Live Paths Observation (P1/P2)
**Status:** PLANNED

**Deliverables**
- IQ Option (real) payout stream parsing + caching
- DOM brokers payout read (best-effort)
- PayoutMatrixService canlı veri ile güncellenir
- **Observation window**:
  - IQ Option real WSS: `BROKER_IQOPTION_REAL_ENABLED=true` ile paper/low-stake
  - DOM: `BROKER_DOM_AUTOMATION_ENABLED=true` ile 1 hafta dry-run; sonra (opsiyonel) `BROKER_DOM_LIVE_ORDERS=true`

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

1) ✅ **V2.6‑1:** Electron + Backend bundling (DONE)
2) ✅ **V2.6‑2:** Credentials Vault (DONE)
3) 🔜 **V2.6‑3:** Windows NSIS installer gerçek build + (opsiyonel) code signing (NEXT)
4) 🔜 **V2.6‑4:** Auto-update + crash reporter

---

## Success Criteria

### Stability
- `cd /app/moonlight/backend && yarn test` → PASS (≥ **387/387**) ✅
- Backend boot: stable, `/api/healthz` 200 ✅
- Bundled boot: BackendManager spawn + health check + shutdown ✅

### Windows .exe readiness
- Single installer ships Desktop + Backend ✅ *(payload hazır; V2.6‑3 gerçek Windows build pipeline gerekiyor)*
- App double-click: Desktop launches, backend auto-starts, UI connects ✅ *(V2.6‑1 wiring hazır)*
- Secrets stored in OS keychain / encrypted vault ✅ *(V2.6‑2)*

### Production safety
- Real broker connections remain opt‑in (feature flags default OFF) ✅
- Dry‑run defaults preserved; live order flags require explicit operator opt‑in ✅
- Packaged mode: secrets fail‑closed without vault ✅
