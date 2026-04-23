# MoonLight Trading OS — v1.9 (Stable) → **v2.x Evrimsel Öğrenen AI (MoE + Trinity Oversight)** → **v2.5 Runtime + Broker Layer (DONE)** → **v2.6 Windows .exe Productionization (V2.6-3 DONE ✅)**

> Repo kökü: `/app/moonlight/`  \
> Backend: **Node.js 20 + NestJS 10 + TypeScript + SQLite (+Redis opsiyonel) + esbuild bundling**  \
> Desktop: **Electron + React 18 + Vite + Tailwind + electron-builder (NSIS)**  \
> Mimari prensip: **Core‑First** + **Fail‑Safe (Fail‑Closed)** + deterministik FSM + auditability.
>
> Güncel gerçeklik:
> - **V2.0 → V2.4 tamamlandı** ✅ (MoE beyinler, Trinity Oversight, 100+ indikatör registry, closed‑loop scheduler, auditability).
> - **V2.5 tamamlandı** ✅ (Simulation Mode 4 broker, Playwright DOM skeleton, IQ Option WSS guard, ResourceBroker).
> - **V2.6‑1 tamamlandı** ✅ (backend single-file bundle + Electron BackendManager spawn/health/IPC).
> - **V2.6‑2 tamamlandı** ✅ (Credentials Vault: keytar + AES‑256‑GCM fallback, REST + IPC + UI).
> - **V2.6‑3 tamamlandı** ✅ (**Windows NSIS Installer + CI/CD + packaged smoke**): üretim seviyesi electron-builder config, GitHub Actions Windows runner release pipeline, CI zenginleştirme, prepackage/afterPack hook’ları, packaged smoke PASS.
>
> Test durumu:
> - Backend Jest: **387/387 PASS** ✅
> - Desktop main Vitest: **9/9 PASS** ✅
> - Bundled spawn smoke (`yarn smoke:bundle`): **PASS** ✅
> - Packaged Linux smoke (`yarn smoke:packaged`): **PASS** ✅ *(yeni)*
>
> Kullanıcının ana hedefi (Windows’ta “çift tıkla çalışsın”) açısından:
> - **Windows .exe dağıtım pipeline’ı hazır** ✅  \
>   Kullanıcı artık **tag push (`vX.Y.Z`)** ile GitHub Actions üzerinden `.exe` installer alabilir.
>
> Durum raporu (yaklaşık):
> - Core Engine (FSM, Risk, Strategy, MoE, Trinity): **%100**
> - Backtest / Live Signal / Semi‑Auto / Full‑Auto (çekirdek akış): **%100**
> - Simulation Mode (4 broker, deterministik/replayable): **%100**
> - Windows .exe Packaging & Distribution: **%95** *(installer/CI/smoke tamam; code-signing opsiyonel)*
> - Real Broker Integration (live WSS/DOM): **%25** *(skeleton + feature flags; gerçek hardening + live test bekliyor)*
> - Genel: **~%92**

---

## Objectives

### A) Stabiliteyi kilitle (v1.9 baseline + v2.x çekirdeğini koru)
- Backend + Desktop build **yeşil**.
- Testler **tam yeşil**:
  - Backend Jest: **387/387 PASS** ✅
  - Desktop main Vitest: **9/9 PASS** ✅
  - Bundled spawn smoke: **PASS** ✅
  - Packaged smoke: **PASS** ✅
- Runtime stabilitesi:
  - Backend gerçek boot **başarılı** ✅
  - Startup sırasında **CPU lock/loop yok** ✅
  - LiveSignal engine **fail‑safe**: manuel başlatma olmadan çalışmaz ✅
  - Broker live yolları **default‑off** ✅
  - Packaged modda secrets **fail‑closed** ✅
- Dağıtım stabilitesi:
  - **CI + Release pipeline deterministik ve tekrarlanabilir** ✅
  - Paket içeriği doğrulaması (afterPack) ile **broken installer üretimi engellenir** ✅

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
- Tek kurulum paketi: Desktop + Backend birlikte ✅
- Backend lifecycle: spawn/health check/restart/shutdown ✅
- Güvenli secrets storage (OS keychain + fallback) ✅
- **NSIS installer + CI/CD release pipeline + checksum + packaged smoke** ✅ *(V2.6‑3)*
- (Opsiyonel) Code signing altyapısı: **hazır/opt‑in** ⏳
- Crash reporting + auto update 🔜 *(V2.6‑4)*

---

## Implementation Steps

### Phase 1 — Core Flow POC (Isolation)
**Status:** COMPLETE ✅

### Phase 2 — V1 App Development (Backend + Desktop around proven core)
**Status:** COMPLETE ✅

### Phase 3 — Testing & Hardening
**Status:** COMPLETE ✅
- Backend Jest: **387/387 PASS** ✅

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

### Phase V2.5‑2 — Broker Simulation Mode (P0/P1)
**Status:** COMPLETE ✅

### Phase V2.5‑3 — IQ Option Real WSS/REST (Guard)
**Status:** COMPLETE ✅

### Phase V2.5‑4 — DOM Automation Skeleton (Playwright/CDP)
**Status:** COMPLETE ✅

### Phase V2.5‑5 — Ray GPU Simulation / Resource Broker
**Status:** COMPLETE ✅

### Phase V2.5‑6 — Testing, Docs, Release
**Status:** COMPLETE ✅

---

## **v2.6 Roadmap — Windows .exe Productionization**

> Amaç: MoonLight Owner Console’un Windows’ta tek kurulumla (installer) çalışması.
> “Çift tıkla çalıştır” deneyimi: Desktop açılır, backend otomatik başlar, health kontrol edilir,
> port/URL yönetilir, kapanışta backend kapatılır.

### Phase V2.6‑1 — Electron + Backend Bundling (P0)
**Status:** COMPLETE ✅

### Phase V2.6‑2 — Credentials Vault (P0/P1)
**Status:** COMPLETE ✅

### Phase V2.6‑3 — Windows Installer + Native Rebuild + CI/CD + Packaged Smoke (P0/P1)
**Status:** COMPLETE ✅

**Deliverables (Delivered)**
- **electron-builder production config** (`desktop/package.json`):
  - `asar: true` + `asarUnpack` (native `.node` ve kritik modüller asar dışı)
  - `electronVersion` pinned (workspace/CI determinism)
  - NSIS polish (oneClick=false, perMachine=false, shortcut/menu)
  - `extraResources` düzeltmeleri:
    - `dist-bundle/` → `resources/backend-bundle/`
    - `backend/node_modules/` → `resources/backend-bundle/node_modules/`
    - `backend/src/config` → `resources/backend-bundle/src/config`
    - `backend/src/indicators/templates` → `resources/backend-bundle/src/indicators/templates`
- **Prepackage + AfterPack hook’ları**:
  - `desktop/scripts/prepackage-check.js` (bundle yoksa auto bundle; payload preflight)
  - `desktop/scripts/after-pack.js` (payload validation + `version.json` manifest)
- **GitHub Actions Release pipeline** (`.github/workflows/release.yml`):
  - windows-latest runner
  - backend build → bundle:prod
  - `backend` workspace için izole `npm install --omit=dev` (Windows native prebuild)
  - `@electron/rebuild` ile Electron ABI rebuild (sqlite3/keytar/…)
  - NSIS `.exe` + SHA256 + artifact upload + GitHub Release attach
- **CI pipeline** (`.github/workflows/ci.yml`):
  - Backend Jest + Desktop Vitest
  - bundle smoke
  - Linux `--dir` packaging best-effort smoke + artifact
- **Best-effort Wine script**: `scripts/wine-build-win.sh`
- **BackendManager spawn hardening**:
  - spawn `cwd=bundleDir`
  - `MOONLIGHT_CONFIG_DIR=bundleDir/src`
- **Packaged smoke test**: `scripts/smoke-packaged.js` (gerçek packaged build üzerinde PASS)
- **Docs**: `docs/BUILD_WINDOWS.md`
- **Branding placeholders**: `desktop/build/icon.png` + `icon.ico`

**Exit Criteria (Met)**
- Tag push ile Windows NSIS `.exe` otomatik üretilir ve release’e eklenir ✅
- Pakette backend payload doğrulanır (broken build fail-fast) ✅
- Packaged layout’ta backend boot + health + vault smoke PASS ✅

### Phase V2.6‑4 — Auto‑Update + Crash Reporter (P1)
**Status:** PLANNED

**Deliverables (Planned)**
- Auto-update:
  - `electron-updater` entegrasyonu
  - Feed: GitHub Releases (`latest.yml` + artifacts)
  - Kanal: stable/beta (opsiyonel)
- Crash reporting:
  - Electron crash dumps toplama
  - Backend crash log + lastError + restart reason codes
  - Minimum telemetry (opt‑in): version, uptime, last crash reason
  - (opsiyonel) Sentry entegrasyonu

### Phase V2.6‑5 — Broker Hardening + Live Observation Window (P1/P2)
**Status:** PLANNED

> Bu fazda implementation feature‑flag arkasında tamamlanır; gerçek SSID/live test kullanıcı tarafından yapılır.

**Deliverables (Planned)**
- IQ Option WSS hardening:
  - heartbeat/ping
  - reconnect/backoff
  - subscription restore
  - payout stream parsing + caching
- DOM brokers hardening (Olymp/Binomo/Expert):
  - selector drift guard
  - pre-flight safety checks
  - dry-run → live gate (iki aşamalı flag)

### Phase V2.6‑6 — Multi‑Broker Intelligent Routing Tuning (P2)
**Status:** PLANNED

**Deliverables (Planned)**
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
3) ✅ **V2.6‑3:** Windows NSIS installer + CI/CD + packaged smoke (DONE)
4) 🔜 **V2.6‑4:** Auto-update + crash reporter
5) 🔜 **V2.6‑5/6:** Broker hardening + routing tuning (feature-flag)

---

## Success Criteria

### Stability
- `cd /app/moonlight/backend && yarn test` → PASS (**387/387**) ✅
- `cd /app/moonlight/desktop && yarn test` → PASS (**9/9**) ✅
- `yarn smoke:bundle` → PASS ✅
- `yarn smoke:packaged` → PASS ✅

### Windows .exe readiness
- Tag push (`vX.Y.Z`) → GitHub Actions Windows runner → NSIS `.exe` artifact + GitHub Release ✅
- Installer ile:
  - Desktop launch ✅
  - backend auto-start + health ✅
  - UI ↔ backend port handshake ✅
- Secrets OS keychain / encrypted vault ✅

### Production safety
- Real broker connections opt‑in (feature flags default OFF) ✅
- Dry-run defaults preserved; live order flags explicit operator opt‑in ✅
- Packaged mode: secrets fail‑closed without vault ✅

### Release/Distribution
- SHA256 checksum artifact üretilir ve yayınlanır ✅
- Code signing **opsiyonel/opt‑in** (sertifika gelince aktif edilecek) ⏳
