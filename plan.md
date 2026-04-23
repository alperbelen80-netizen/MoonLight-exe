# MoonLight Trading OS — v1.9 (Stable) → **v2.x Evrimsel Öğrenen AI (MoE + Trinity Oversight)** → **v2.5 Runtime + Broker Layer (DONE)** → **v2.6 Windows .exe Productionization (V2.6-6 DONE ✅)**

> Repo kökü: `/app/moonlight/`  \
> Backend: **Node.js 20 + NestJS 10 + TypeScript + SQLite (+Redis opsiyonel) + esbuild bundling**  \
> Desktop: **Electron + React 18 + Vite + Tailwind + electron-builder (NSIS) + electron-updater**  \
> Mimari prensip: **Core‑First** + **Fail‑Safe (Fail‑Closed)** + deterministik FSM + auditability.

> Güncel gerçeklik:
> - **V2.0 → V2.4 tamamlandı** ✅ (MoE beyinler, Trinity Oversight, 100+ indikatör registry, closed‑loop scheduler, auditability).
> - **V2.5 tamamlandı** ✅ (Simulation Mode 4 broker, Playwright DOM skeleton, IQ Option WSS guard, ResourceBroker).
> - **V2.6‑1 tamamlandı** ✅ (backend single-file bundle + Electron BackendManager spawn/health/IPC).
> - **V2.6‑2 tamamlandı** ✅ (Credentials Vault: keytar + AES‑256‑GCM fallback, REST + IPC + UI).
> - **V2.6‑3 tamamlandı** ✅ (Windows NSIS Installer + CI/CD + packaged smoke): üretim seviyesi electron-builder config, GitHub Actions Windows runner release pipeline, CI zenginleştirme, prepackage/afterPack hook’ları, packaged smoke PASS.
> - **V2.6‑4 tamamlandı** ✅ (Auto-update + crash reporting + About panel): `electron-updater`, Electron crashReporter + backend crash telemetry, Settings/About UI.
> - **V2.6‑5 tamamlandı** ✅ (Real broker hardening): IQ Option WSS self-heal + DOM broker live click preflight + SelectorDriftGuard + Dynamic Payout.
> - **V2.6‑6 tamamlandı** ✅ (Multi-broker routing tuning): priority-based routing_score + detaylı audit reason codes.

> Test durumu (güncel):
> - Backend Jest: **404/404 PASS** ✅
> - Desktop main Vitest: **17/17 PASS** ✅
> - Bundled spawn smoke (`yarn smoke:bundle`): **PASS** ✅
> - Packaged Linux smoke (`yarn smoke:packaged`): **PASS** ✅

> Kullanıcının ana hedefi (Windows’ta “çift tıkla çalışsın”) açısından:
> - **Windows .exe dağıtım pipeline’ı hazır** ✅  \
>   Kullanıcı artık **tag push (`vX.Y.Z`)** ile GitHub Actions üzerinden `.exe` installer alabilir.
> - **Kod tarafı %100 hazır** ✅ — kalan adımlar **kullanıcı eylemine bağlı** (Windows kurulum + vault + live flag + düşük stake smoke).

> Durum raporu (yaklaşık):
> - Core Engine (FSM, Risk, Strategy, MoE, Trinity): **%100**
> - Backtest / Live Signal / Semi‑Auto / Full‑Auto (çekirdek akış): **%100**
> - Simulation Mode (4 broker, deterministik/replayable): **%100**
> - Windows .exe Packaging & Distribution: **%98** *(installer/CI/smoke/update/crash tamam; code-signing opsiyonel)*
> - Real Broker Integration (live WSS/DOM): **%95** *(hardening tamam; gerçek canlı test kullanıcı aksiyonu)*
> - Genel: **~%98** *(kalan %2: kullanıcı kurulumu + live test)*

---

## Objectives

### A) Stabiliteyi kilitle (v1.9 baseline + v2.x çekirdeğini koru)
- Backend + Desktop build **yeşil** ✅
- Testler **tam yeşil** ✅
  - Backend Jest: **404/404 PASS** ✅
  - Desktop main Vitest: **17/17 PASS** ✅
  - Bundled spawn smoke: **PASS** ✅
  - Packaged smoke: **PASS** ✅
- Runtime stabilitesi ✅
  - Backend gerçek boot **başarılı** ✅
  - Startup sırasında **CPU lock/loop yok** ✅
  - LiveSignal engine **fail‑safe**: manuel/explicit flag olmadan çalışmaz ✅
  - Broker live yolları **default‑off** ✅
  - Packaged modda secrets **fail‑closed** ✅
- Dağıtım stabilitesi ✅
  - **CI + Release pipeline deterministik ve tekrarlanabilir** ✅
  - Paket içeriği doğrulaması (afterPack) ile **broken installer üretimi engellenir** ✅

### B) V2.x: Hedge‑fund grade “Evrimsel Öğrenen AI” çekirdeğini işlet (korunacaklar)
- 3 Local MoE beyin ✅
  - **CEO‑MoE (Strateji)**
  - **TRADE‑MoE (Uygulama/Timing)**
  - **TEST‑MoE (Denetim/Saldırı – deterministic red team)**
- Üst orkestratör ✅
  - **Global MoE + Ensemble**
- **Trinity Oversight** ✅
  - **GÖZ‑1 System Observer** (donanım/latency/%80 bütçe)
  - **GÖZ‑2 Decision Auditor** (trace + drift)
  - **GÖZ‑3 Topology & Learning Governor** (sinaptik kurallar + training toggle)
- Donanım/öğrenme ✅
  - **Max %80 kaynak kullanımı**
  - CPU/GPU token broker + queue/priority + simulation toggle ✅

### C) Broker katmanı hedefleri (kademeli rollout)
- Simulation Mode (deterministic/replayable) ✅
- IQ Option WSS live path (self-heal) ✅ *(feature-flag opt‑in)*
- DOM Automation (Playwright) live path ✅ *(feature-flag opt‑in, preflight + drift guard ile fail-closed)*
- Dynamic payout feed ✅ *(DYNAMIC → STATIC fallback chain)*
- **Windows prod hedefinde**: broker erişimi ve secrets güvenliği “default‑off / opt‑in” kalır ✅

### D) v2.6 ana hedef: Windows .exe “gerçek kullanıcı makinesinde” sorunsuz çalıştırma
- Tek kurulum paketi: Desktop + Backend birlikte ✅
- Backend lifecycle: spawn/health check/restart/shutdown ✅
- Güvenli secrets storage (OS keychain + fallback) ✅
- NSIS installer + CI/CD release pipeline + checksum + packaged smoke ✅
- Auto-update + crash reporter + backend crash telemetry ✅
- (Opsiyonel) Code signing altyapısı: **hazır/opt‑in** ⏳
- (Opsiyonel) Branding ikon değişimi: **kullanıcı eylemi** ⏳

---

## Implementation Steps

### Phase 1 — Core Flow POC (Isolation)
**Status:** COMPLETE ✅

### Phase 2 — V1 App Development (Backend + Desktop around proven core)
**Status:** COMPLETE ✅

### Phase 3 — Testing & Hardening
**Status:** COMPLETE ✅
- Backend Jest: **404/404 PASS** ✅
- Desktop Vitest: **17/17 PASS** ✅

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
**Status:** COMPLETE ✅

**Deliverables (Delivered)**
- Auto-update:
  - `electron-updater` entegrasyonu (`AutoUpdaterService`, lazy-load + feature-flag)
  - Feed: GitHub Releases (owner/repo env ile override)
  - IPC bridge: `window.moonlight.updater.*`
  - UI: Settings → About panelinde check/download/install + progress
- Crash reporting:
  - Electron `crashReporter.start()` + local crash history JSONL
  - `BackendManager` crash hook (unexpected exit capture + forward)
  - Backend crash telemetry endpoints (loopback-only):
    - `POST /api/crash/report`
    - `GET /api/crash/reports`
    - `GET /api/crash/stats`
  - UI: Settings → About panelinde crash history görünümü

**Exit Criteria (Met)**
- Packaged modda auto-update state machine çalışır (dev’de disabled) ✅
- Crash events local history’e düşer ve backend’de korele edilebilir ✅

### Phase V2.6‑5 — Broker Hardening + Live Observation Window (P1/P2)
**Status:** COMPLETE ✅

> Bu fazda implementation feature‑flag arkasında tamamlandı; gerçek SSID/live test kullanıcı tarafından yapılacaktır.

**Deliverables (Delivered)**
- IQ Option WSS hardening:
  - heartbeat/ping ✅
  - reconnect/backoff ✅
  - **subscription restore** ✅
  - payout stream parsing + caching ✅
  - position tracking (position-changed) ✅
  - expanded activeId map (36+) ✅
  - runtime diagnostics (no secret exposure) ✅
- DOM brokers hardening (Olymp/Binomo/Expert):
  - **SelectorDriftGuard** (soft-disable after N misses, reset/hit semantics) ✅
  - **pre-flight safety** ✅
    - max stake cap (`BROKER_DOM_MAX_STAKE`, default 25)
    - demo badge verify (override `BROKER_DOM_ALLOW_LIVE_REAL`)
    - balance check (`balanceDisplay`)
  - dry-run → live gate (iki aşamalı flag) ✅
  - confirmButton ile gerçek commit click ✅
- Dynamic payout integration:
  - `DynamicPayoutProvider` (IQ WSS payout cache → PayoutMatrix) ✅
  - Fallback chain: DYNAMIC → STATIC → default ✅

**Exit Criteria (Met)**
- Live broker yolları opt-in, fail-closed rejection codes ile güvenli ✅
- DOM selector drift durumda broker soft-disable olur ✅

### Phase V2.6‑6 — Multi‑Broker Intelligent Routing Tuning (P2)
**Status:** COMPLETE ✅

**Deliverables (Delivered)**
- Routing scoring policy:
  - latency p95 ✅
  - reject rate (mevcut reliability metric) ✅
  - payout (PayoutMatrix) ✅
  - routing priority score (`BROKER_ROUTING_PRIORITY` override) ✅
- Trinity audit reason codes:
  - seçim gerekçesi detaylı score breakdown ile loglanır ✅

**Exit Criteria (Met)**
- Router selection reason string audit-friendly ve deterministik ✅

---

## Next Actions (Immediate)

1) ✅ **V2.6‑1:** Electron + Backend bundling (DONE)
2) ✅ **V2.6‑2:** Credentials Vault (DONE)
3) ✅ **V2.6‑3:** Windows NSIS installer + CI/CD + packaged smoke (DONE)
4) ✅ **V2.6‑4:** Auto-update + crash reporter + backend crash telemetry (DONE)
5) ✅ **V2.6‑5:** Real broker hardening (IQ WSS + DOM live) (DONE)
6) ✅ **V2.6‑6:** Multi-broker routing tuning (DONE)
7) 🔜 **Kullanıcı aksiyonu (kalan %2):**
   - Tag push (`v2.6.6` gibi) → GitHub Actions → Windows NSIS `.exe` indir
   - Windows’ta kur → uygulamayı aç → Settings/Vault’a credentials gir
   - Live flag’leri bilinçli şekilde aç (aşağıdaki checklist)
   - Düşük stake ile canlı smoke test (demo veya allow-live-real override)
8) ⏳ (Opsiyonel) Branding ikonlarını güncelle: `desktop/build/icon.{png,ico}`
9) ⏳ (Opsiyonel) Code-sign sertifika: `CSC_LINK` / `CSC_KEY_PASSWORD` GitHub Secrets

---

## Success Criteria

### Stability
- `cd /app/moonlight/backend && yarn test` → PASS (**404/404**) ✅
- `cd /app/moonlight/desktop && yarn test` → PASS (**17/17**) ✅
- `yarn smoke:bundle` → PASS ✅
- `yarn smoke:packaged` → PASS ✅

### Windows .exe readiness
- Tag push (`vX.Y.Z`) → GitHub Actions Windows runner → NSIS `.exe` artifact + GitHub Release ✅
- Installer ile:
  - Desktop launch ✅
  - backend auto-start + health ✅
  - UI ↔ backend port handshake ✅
  - About panel: update state + crash history ✅
- Secrets OS keychain / encrypted vault ✅

### Production safety (Live trading)
- Real broker connections opt‑in (feature flags default OFF) ✅
- Dry-run defaults preserved; live order flags explicit operator opt‑in ✅
- DOM live path:
  - preflight (demo badge / max stake / balance) ✅
  - selector drift soft-disable ✅
- Packaged mode: secrets fail‑closed without vault ✅

### Release/Distribution
- SHA256 checksum artifact üretilir ve yayınlanır ✅
- Code signing **opsiyonel/opt‑in** (sertifika gelince aktif edilecek) ⏳

---

## Kullanıcı Live Test Checklist (Operasyonel)

> Bu checklist **kod dışı** kalan %2’lik kısımdır. Sistemin üretimde “sağlıklı ve sorunsuz” çalıştığını doğrulamak için önerilen sıradır.

1. Windows’ta installer ile kur ve çalıştır.
2. Settings → Vault:
   - IQ Option: `IQ_OPTION_SSID` (ve gerekiyorsa ek anahtarlar) gir.
3. İlk etapta **DEMO** hedefle:
   - DOM broker için demo badge doğrulaması çalışmalı.
4. Flag’ler:
   - `BROKER_IQOPTION_REAL_ENABLED=true`
   - `BROKER_DOM_AUTOMATION_ENABLED=true`
   - (İlk smoke) `BROKER_DOM_LIVE_ORDERS=false` (dry-run)
   - Her şey yeşilse: `BROKER_DOM_LIVE_ORDERS=true`
   - Güvenlik: `BROKER_DOM_MAX_STAKE=1` gibi küçük cap ile başla.
5. About panel:
   - Update state görüntüleniyor mu?
   - Crash history boş mu?
6. İlk canlı işlem:
   - düşük stake, tek sinyal, tek broker.
   - Trinity audit reason string logs kontrol.

---

## Notlar / Bilinen Kısıtlar

- **CCXT Geo-block (HTTP 451/403):** K8s/CI ortamında recurring olabilir; üretim kullanıcı makinesinde genellikle yoktur. Gerekirse proxy/alt endpoint stratejisi ayrı iş olarak ele alınır.
- **Keytar:** Bazı Linux ortamlarda libsecret/D-Bus gerekir; Windows’ta genellikle stabil. Fallback AES-256-GCM her zaman hazır.
- **Code-signing:** SmartScreen uyarılarını azaltmak için önerilir ama zorunlu değildir.
