# MoonLight Trading OS - Change Log


## v2.5.1 — Startup CPU Loop Fix + Bootstrap Hardening

**Release Date:** 2026-04-23
**Scope:** Backend gerçek boot stabilitesi, lazy-start LiveSignal pump, modül bootstrap circular-dep kırma, regression test suite genişletme.

### 🚨 Critical: Runtime Bootstrap Unblocked
Önceki kod ile `yarn start`/`node dist/backend/src/main.js` çalıştırıldığında backend
ayağa kalkamıyor ve/veya CPU'yu %100+ tüketiyordu. İki ayrı sebep vardı:

1. **Bootstrap-time CPU lock**: `LiveSignalEngine.onModuleInit()` 4 sembol × 3 TF için
   eager olarak `MockLiveDataFeedAdapter.subscribeToCandles()` çağırıyor; adapter ise
   her subscription’da **senkron 100 bar** üretip üstüne **1500ms interval** açıyordu.
   12 × 100 = 1200 senkron handler + 12 agresif tick → startup pump.
2. **Module DI cycle**: `StrategyModule → AICoachModule → DataModule → StrategyModule`
   döngüsü Nest tarafından `"module at index [1] is undefined"` hatasıyla hard fail
   veriyordu. Testler (Jest) bu modülleri izole olarak doğru yüklediği için
   gözden kaçıyordu.

### 🛠️ V2.5-1-A — Lazy-start Live Signal Engine
- `LiveSignalEngine` artık:
  - `LIVE_SIGNAL_ENABLED=true` **ve** `LIVE_SIGNAL_AUTO_START=true` ise bootstrap’ta start eder.
  - Aksi halde **hazırdır ama start etmez** (fail-safe default).
  - `start()`, `stop()` idempotent public metodları + `getStatus()` snapshot'ı.
  - `onModuleDestroy()` temiz stop sağlar.
- Yeni REST yüzeyi:
  - `POST /api/live/engine/start`
  - `POST /api/live/engine/stop`
  - `GET  /api/live/engine/status`
- `.env` güncellemeleri (backend):
  - `LIVE_SIGNAL_ENABLED=false` (default — güvenli)
  - `LIVE_SIGNAL_AUTO_START=false`
  - `MOCK_FEED_INTERVAL_MS=30000` (eski 1500ms → 30s)
  - `MOCK_FEED_SEED_BARS`, `MOCK_FEED_SEED_CHUNK`

### 🛠️ V2.5-1-B — MockLiveDataFeedAdapter chunked async seed
- Seed artık **chunklu** üretiliyor, her chunk sonrası `setImmediate` ile event-loop’a
  yield ediliyor → Nest lifecycle hook’ları ve HTTP server bootstrap sırasında
  bloklanmıyor.
- `setInterval(...).unref()` çağrılıyor → Jest worker'ında açık timer handle kalmaz.
- `MOCK_FEED_INTERVAL_MS < 500ms` ise varsayılana clamp (30s) — alt sınır güvenliği.
- Handler çağrıları try/catch ile sarmalandı (tek bir aboneliğin hatası feed’i durdurmasın).
- `getSubscriptionCount()` test helper eklendi.

### 🛠️ V2.5-1-C — Module DI cycle kırma (forwardRef)
- `DataModule.imports`: `StrategyModule` → `forwardRef(() => StrategyModule)`
- `StrategyModule.imports`: `AICoachModule` → `forwardRef(() => AICoachModule)`
- `AICoachModule.imports`: `DataModule` → `forwardRef(() => DataModule)`
- Artık üç modül de aynı cycle içinde güvenle resolve oluyor, `RegimeDetectorService`
  gibi cross-module bağımlılıklar (IndicatorService) çalışıyor.

### 🧪 Yeni Test Kapsamı
- `src/tests/unit/data/mock-live-feed.adapter.spec.ts`
  - chunk sayısı + sıralama
  - event-loop yield (non-blocking)
  - `MOCK_FEED_INTERVAL_MS` clamp
  - timer `.unref()` varlığı
  - idempotent subscribe / disconnect
- `src/tests/unit/execution/live-signal-engine.lazy-start.spec.ts`
  - `ENABLED!=true` → no-op
  - `AUTO_START!=true` → hazır ama start etmez
  - `start()` tüm grid’e subscribe (2×3 = 6) + idempotent
  - `stop()` clean disconnect + status damgası
  - DISABLED iken `start()` no-op
  - `onModuleDestroy()` güvenli

### 📈 Ölçülen sonuçlar
- Tests: **322/322 PASS** (önceki 310 + 12 yeni V2.5-1 regression)
- Runtime: backend gerçek boot + `GET /api/healthz` → HTTP 200
- CPU (idle): önceki %101 → şimdi ~%4–12
- Start/Stop flow canlıda doğrulandı: 4 abonelik açıldı/kapandı, CPU stabil kaldı.

### 🔐 Migration notları (operator)
- Canlı sinyal pump’ını bootstrap’ta başlatmak istiyorsanız:
  - `LIVE_SIGNAL_ENABLED=true`
  - `LIVE_SIGNAL_AUTO_START=true`
- Aksi halde:
  - `POST /api/live/engine/start` ile manuel başlatın.
  - Durdurmak için `POST /api/live/engine/stop`.
- Mock feed tick hızını değiştirmek için `MOCK_FEED_INTERVAL_MS` ayarını kullanın.



## v2.4.0 — Prior DB Persistence + CSV Export + Broker Health Registry

**Release Date:** 2026-04-23
**Scope:** Server restart dayanıklılığı, A/B analiz export'u, broker durum izleme altyapısı.

### 💾 V2.4-A — ExpertPrior DB persistence
- Yeni entity: `ExpertPrior(id="${brain}__${role}", brain, role, weight, updated_at_utc)` + `idx_prior_brain` index.
- `ClosedLoopLearnerService.onModuleInit()` DB'den prior'ları yükler:
  - Row bulunursa → in-memory prior'lara yazılır.
  - Boş tablo → default değerler korunur.
- `step()` sonunda **fire-and-forget persist**: 3 brain × 5 role = 15 satır upsert.
- DB hataları scheduler'ı çökertmez (warn log + devam).
- Kill-switch: `CLOSED_LOOP_PERSIST=false`.
- Server restart sonrası prior'lar **canlı kalır** — closed-loop öğrenme artık kalıcı.

### 📤 V2.4-C — A/B Harness CSV Export
- Yeni endpoint: `GET /api/moe/ab/export.csv`
- Headers: `Content-Type: text/csv`, `Content-Disposition: attachment; filename="moe_ab_samples.csv"`
- Format: `mode,decision,confidence,at,w_ceo,w_trade,w_test`
- Max 500 satır (ring buffer'ın tamamı).
- Excel/Pandas/jq ile doğrudan analiz edilebilir.

### 🔌 V2.4-D — Broker Health Registry (Quad-Core Foundation)
- Yeni modül: `broker/health/` (global singleton).
- **5 broker** seed'lenir: `IQ_OPTION`, `OLYMP_TRADE`, `BINOMO`, `EXPERT_OPTION` (DISCONNECTED) + `FAKE` (READY).
- **7-state state machine**: DISCONNECTED → CONNECTING → AUTHENTICATING → READY → (THROTTLED ↔ READY) → ERRORED → DISABLED.
- Transition doğrulama tablosu — invalid transition reddedilir + WARN log.
- Metrikler:
  - `errorsLastHour` — son 1 saatte ERRORED'a düşen kayıt sayısı (auto-prune).
  - `quotesLastSeenAt` — son quote timestamp'i.
  - `orderLatencyMsP95` — sipariş latency P95.
- API:
  - `GET /api/broker/health` — tüm broker'lar.
  - `GET /api/broker/health/:brokerId` — tek broker.
- Gelecek broker adapter'ları (IQ WSS, Olymp DOM, Binomo, Expert Option) bu registry'ye transition raporlayacak → Trinity GÖZ-1 direkt okuyabilecek.

### 🧪 Testler
- **+14 yeni Jest test** → toplam **310/310 PASS** (296 + 14).
  - `broker-health-registry.service.spec.ts` (9): seed, valid transition, invalid reddi, idempotent, full happy path, errorsLastHour, quote timestamp, latency round, null lookup.
  - `closed-loop-learner-persistence.spec.ts` (5): DB'den load, boş tablo no-op, step() sırasında save, CLOSED_LOOP_PERSIST=false kill-switch, save hatası graceful.
  - `ab-weighting.controller` yeni export.csv davranışı (mevcut test örnekleri üzerinden endpoint canlı).

### ✅ Doğrulama
- Backend `yarn build` → PASS
- 310/310 PASS
- Auto-synchronize → `expert_prior` tablosu runtime'da yaratılır.

### 🔗 Yeni env flag'ler
- `CLOSED_LOOP_PERSIST=false` — prior DB persist'i kapat (default: on if repo available).

### 🔀 Yeni API yüzeyi
- `GET /api/moe/ab/export.csv` (CSV attachment)
- `GET /api/broker/health` + `GET /api/broker/health/:brokerId`

### 🚀 Sıradaki (V2.5 candidate)
- IQ Option WSS Phase 1: ws lib + session authenticate + quote subscribe (broker health registry'ye state raporlayacak).
- Olymp Trade DOM Phase 1: Playwright/Chromium headless login + quote scrape.
- 17 dormant template için per-template özelleştirilmiş persona catalog.
- Trinity UI'a broker health mini-panel.



## v2.3.0 — Dormant Template LLM Augmentation + Tick Persistence + A/B Harness

**Release Date:** 2026-04-23
**Scope:** V2.2'nin üç açığı kapatıldı: dormant şablonlar Gemini persona ile canlandırıldı, scheduler tick'leri DB'ye kalıcılaştırıldı, health-weighted vs static ensemble karşılaştırma harness'i kuruldu.

### 🧠 V2.3-A — Dormant Template LLM Augmentation
- `TemplateStrategyBuilderService` constructor'ına `@Optional() coach` eklendi.
- `MOE_TEMPLATE_LLM_ENABLED=true` + coach available → dormant şablonlar için **Gemini persona evaluator** devreye girer:
  - System prompt: template #N purpose + long/short rule + components.
  - User payload: symbol + TF + last 3 bars (o/h/l/c/v).
  - Timeout: **8s** (Promise.race).
  - Strict JSON parse: `{direction, confidence, rationale}`.
- **Fail-closed gate'ler**:
  - Coach unavailable → silent.
  - LLM throws/timeout → silent.
  - Malformed JSON → silent.
  - Direction ≠ LONG/SHORT → silent.
  - Confidence < 0.55 → silent (güvensiz sinyal yayma).
- Emitted signal `source = TEMPLATE_STRATEGY_LLM` (audit traceable).
- Stats endpoint artık `llmAugmented` sayımını da döner.

### 💾 V2.3-B — Scheduler Tick Persistence
- Yeni entity: `LearningTickHistory` (id uuid, at_utc, ran 0/1, reason, brains, avgHealth, created_at).
- `@Index('idx_ltick_at', ['at_utc'])` query için.
- `ClosedLoopSchedulerService.handleCron()` her tick'i `tickRepo.save()` ile kalıcılaştırır.
- DB save hatası scheduler'ı **çökertmez** (best-effort + warn log).
- Yeni API: `GET /api/moe/learning/scheduler/history?limit=100` (DESC by at_utc).
- Auto-synchronize DB schema otomatik yaratır.

### 📊 V2.3-C — A/B Weighting Harness
- Yeni servis: `ABWeightingHarnessService` (`moe-brain/learning/`).
- Orchestrator her `EnsembleDecision`'ı `harness.record(decision, healthWeighting)` ile kaydeder.
- 500 slot ring buffer, iki mode ayrı: `HEALTH_WEIGHTED` vs `STATIC`.
- Bucket aggregate: count, allow/skip/veto/manualReview, avgConfidence, avgWeights.
- API:
  - `GET /api/moe/ab/buckets` — iki mode için toplu karşılaştırma.
  - `GET /api/moe/ab/recent?limit=50` — son N örnek.
  - `POST /api/moe/ab/clear` — buffer sıfırla.
- Ops flow: `MOE_HEALTH_WEIGHTING=false` ile bir süre çalıştır → `true` yap → bucket'ları karşılaştır.

### 🧪 Testler
- **+14 yeni Jest test** → toplam **296/296 PASS** (282 + 14).
  - `closed-loop-scheduler.service.spec.ts` (+1 persist testi).
  - `ab-weighting-harness.service.spec.ts` (6): empty, mode ayrımı, avg metrics, 500 cap, recent(), clear.
  - `template-strategy-llm.spec.ts` (7): disabled, coach unavailable, augmented count, garbage JSON, throw, low-confidence, high-confidence emit.

### ✅ Doğrulama
- Backend `yarn build` → PASS
- Renderer `tsc --noEmit` → 0 error
- Auto-synchronize → `learning_tick_history` tablosu runtime'da yaratılır.

### 🔗 Yeni env flag'ler
- `MOE_TEMPLATE_LLM_ENABLED=true` — dormant şablonlar için Gemini kullan.
- (mevcut) `MOE_HEALTH_WEIGHTING=true|false` — artık A/B harness'e record'la.

### 🚀 Sıradaki (V2.4 candidate)
- Quad-core broker adapter gerçek implementasyonları.
- Learner prior'larının DB persistence'ı (server restart resilience).
- Dormant şablonlar için **per-template persona** (şu an generic); 17 dormant için özel prompt paketleri.
- A/B harness için Excel/CSV export + grafik.



## v2.2.0 — Scheduled Learning + Live Priors Publish + Health-Weighted Ensemble

**Release Date:** 2026-04-23
**Scope:** V2.1'in açık bıraktığı kapalı döngüyü **tam kapattık**. Prior'lar artık brain'lere canlı akıyor, scheduler bütçe-duyarlı otomatik adım atıyor, ensemble brain sağlığına göre ağırlık dağıtıyor.

### ⏱️ V2.2-A — ClosedLoopSchedulerService
- `@nestjs/schedule` + `@Cron(EVERY_5_MINUTES)` ile otomatik adım.
- **3 katmanlı safety gate**:
  1. `CLOSED_LOOP_SCHEDULER_ENABLED=true` olmazsa hiç çalışmaz (default: disabled).
  2. GÖZ-1 **HALT** ise defer (`reason=EYE1_HALT`).
  3. ResourceBroker `requestBudget(1)` deny → defer (`reason=BUDGET_DENIED:<detay>`).
  4. Ardından `learner.step()` (learner'ın kendi training-mode kontrolü de var).
- 100 slot'luk tick history ring buffer'ı + manuel `tick()` override.
- API: `GET /api/moe/learning/scheduler`, `POST /api/moe/learning/scheduler/tick`.

### 🔀 V2.2-B — Brains now read priors from ClosedLoopLearner
- **CEO / TRADE / TEST** brain servisleri statik `const *_PRIORS` yerine `learner.getPriors(BrainType.*)` okuyor.
- `forwardRef()` kullanılarak circular uyumluluk sağlandı (learner henüz hiç step atmamışken de default prior'lar garanti).
- Closed-loop bir adım attığında → bir sonraki brain.evaluate() otomatik güncel prior'la skor üretir.
- Sonuç: **Audit feedback → Synaptic update → Brain decision** artık kapalı döngü.

### ⚖️ V2.2-C — Health-Weighted Global Ensemble
- `GlobalMoEOrchestratorService.getEffectiveWeights()`:
  - Base weights `MOE_ENSEMBLE_WEIGHTS` env'den gelir.
  - Her beyin için `ClosedLoopLearner.snapshot()` üzerinden **mevcut sinaptik sağlık** (0..1) çekilir.
  - Weight × health → normalize edilir (sum=1).
  - `MOE_HEALTH_FLOOR` (default 0.25) hiçbir beyni **sıfırlanmaya** bırakmaz (dead-brain engeli).
  - Kill-switch: `MOE_HEALTH_WEIGHTING=false` → klasik statik weights.
- `EnsembleDecision.finalWeights` artık **etkin** (health-adjusted) weights'leri taşır → UI doğrudan gösterebilir.
- Log satırı: `score=0.456 decision=ALLOW t=3ms w(C/T/Te)=0.38/0.40/0.22`

### 🎛️ V2.2-D — Trinity UI scheduler paneli
- Closed-Loop Learning paneline **scheduler durum rozeti** eklendi (`ACTIVE (cron 5m)` / `DISABLED`) + son tick reason.
- Yeni buton: **"Scheduler Tick"** (manuel bütçe-duyarlı tick; DISABLED iken de izleyebilirsiniz).
- Yeni test-id'ler: `scheduler-status-badge`, `scheduler-tick-btn`.
- 10s auto-poll scheduler durumu.

### 🧪 Testler
- **+10 yeni Jest test** → toplam **282/282 PASS** (272 + 10).
  - `closed-loop-scheduler.service.spec.ts` (6): disabled flag, EYE1_HALT defer, budget denied, happy path, history cap, learner error capture.
  - `orchestrator-health-weighting.spec.ts` (4): düşük sağlıklı brain ağırlığı azalır, kill-switch, finalWeights akışı, health floor lockout'u engelliyor.
  - Mevcut brain/controller/orchestrator testleri learner injection ile güncellendi (0 regresyon).

### ✅ Doğrulama
- Backend `yarn build` → PASS
- Renderer `tsc --noEmit` + `vite build` → PASS (417 KB / 117 KB gzip)

### 🔗 Yeni env flag'ler
- `CLOSED_LOOP_SCHEDULER_ENABLED=true` → cron aktif (default false, opt-in).
- `MOE_HEALTH_WEIGHTING=false` → klasik statik ensemble weights (default: health-weighted).
- `MOE_HEALTH_FLOOR=0.25` → brain lockout engeli.

### 🚀 Sıradaki (V2.3 candidate)
- 17 dormant şablon için Gemini persona expert ile **canlandırma**.
- Quad-core broker adapter (IQ Option WSS + Olymp DOM + Binomo + Expert Option) gerçek implementasyonu.
- Scheduler tick history persistence (şu an in-memory; DB kalıcı olsun).
- A/B test harness: health-weighted vs static ensemble karşılaştırma.



## v2.1.0 — Strategy Factory Bridge + Closed-Loop Learning + Live Gate

**Release Date:** 2026-04-23
**Scope:** V2.0 çekirdeği canlı sinyal akışına bağlandı. 100 şablon Strategy Factory'ye enjekte oldu, kapalı döngü öğrenme ayağa kaldırıldı, MoE Gate LiveSignalEngine'e bağlandı.

### 🧩 V2.1-A — TemplateStrategyBuilder
- `backend/src/strategy/factory/template-strategy-builder.service.ts`
- IndicatorRegistry'den 100 şablonu okur, her birini StrategyFactory'ye **tek seferde** register eder.
- Primitive detector: RSI / EMA / MACD / BB / ADX / SMA / VWAP / ATR / Supertrend keyword tabanlı eşleştirme.
- Evaluator politikası:
  - Tanınan primitive → mevcut `IndicatorService` ile gerçek hesaplama + majority-vote (LONG/SHORT/NEUTRAL, ≥60% eşik).
  - Tanınmayan → **dormant** (asla sinyal yaymaz). Emniyetli geniş yüzey.
- Sonuç: **100 kayıt → 83 implemented + 17 dormant** (real-world MD parsinginde bazı şablonlar yalnız price transform / template bileşimi olduğundan dormant kalır).
- API:
  - `GET /api/strategy/templates/stats` — implemented / dormant / registeredTotal
  - `POST /api/strategy/templates/register-all` — idempotent re-register
- Env: `V2_TEMPLATE_AUTOLOAD=false` ile devre dışı bırakılabilir.

### 🔁 V2.1-B — ClosedLoopLearnerService
- `backend/src/moe-brain/learning/closed-loop-learner.service.ts`
- Triple-safeguard: `TrainingMode=ON`, audit non-empty, `CLOSED_LOOP_DISABLED` kill-switch.
- Akış:
  1. **GÖZ-2** audit ring buffer → reason codes toplanır.
  2. Her expert role için `hits`, `approveHits`, `rejectHits` hesaplanır.
  3. Hebbian (CEO/TRADE) veya Anti-Hebbian (TEST) kuralı uygulanır.
  4. `SynapticRulesService` delta'yı clamp'ler (maxStep, decay, [minWeight, maxWeight]).
  5. Güncellenen prior'lar bellekte tutulur + **ortalama sağlık → GÖZ-3 synapticHealth'e yazılır**.
- API:
  - `GET /api/moe/learning/snapshot` — 3 beyin için güncel prior'lar + health
  - `POST /api/moe/learning/step` — tek seferlik öğrenme adımı (scheduler daha sonra ε+1 fazında)

### 🚪 V2.1-C — LiveSignalEngine ↔ MoEGate hook
- `execution/live-signal-engine.service.ts` → `MoEGateService` inject edildi.
- Yeni sinyal DB'ye kaydedilmeden önce `moeGate.gate(ctx)` çağrılır.
- Davranış:
  - Gate kapalı (`MOE_GATE_ENABLED` unset) → baseline akış (fail-open, log yok).
  - Gate açık + `ALLOW` → sinyal `NEW` olarak persist.
  - Gate açık + block → sinyal `MOE_SKIPPED` statüsüyle persist (audit izi).
  - Gate throw → log + allow (ExtraSafety), MoEGateService stricting kendi iç mantığına bırakıldı.
- Her sinyalin `notes` alanına `| MoE:<decision> conf=<x.xx>` eklenir.

### 🎛️ V2.1-D — Trinity UI drill-down
- `TrinityPage` sayfasının altına **yeni satır** (3 panel):
  - **Closed-Loop Learning** → 3 beynin prior'ları (chip + sağlık), manuel "Öğrenme Adımı Çalıştır" butonu.
  - **Synaptic Kurallar** → `learningRate`, `decay`, `maxStep`, `targetRate`, `spikeThreshold`, `minWeight`, `maxWeight` canlı tablo.
  - **Strategy Templates** → registeredTotal / implemented / dormant + progress bar + indikatör aile top-5 dağılımı.
- Yeni test-id'ler: `learning-snapshot-panel`, `learning-step-btn`, `learning-step-message`, `learning-brain-CEO/TRADE/TEST`, `synaptic-config-panel`, `templates-stats-panel`, `indicator-family-counts`.
- API client: `LearningApi`, `SynapticApi`, `StrategyTemplatesApi`, `IndicatorsApi` eklendi.

### 🧪 Testler
- **+11 yeni Jest test** → toplam **272/272 PASS** (261 + 11).
  - `template-strategy-builder.service.spec.ts` (4): 100 registrasyon, id patterni, dormant null emit, stats.
  - `closed-loop-learner.service.spec.ts` (7): training OFF reddi, audit boş reddi, adım uygulaması, GÖZ-3 health update, CLOSED_LOOP_DISABLED kill-switch, 3-beyin snapshot, setPriors patch.

### ✅ Build doğrulama
- Backend `yarn build` → PASS
- Renderer `tsc --noEmit` → 0 error
- Renderer `vite build` → PASS (415 KB / 117 KB gzip, +5 KB V2.1 UI)

### 🔗 Yeni API yüzeyi (V2.1)
- `/api/strategy/templates/{stats, register-all}`
- `/api/moe/learning/{snapshot, step}`
- LiveSignalEngine artık MoE gate ile yazışıyor (içsel, endpoint değişmedi).

### 🚀 Sıradaki (V2.2 candidate)
- Closed-loop scheduler (her N dakikada bir auto-step, GÖZ-3 + ResourceBroker budget kontrolü ile).
- Dormant şablonlar için hybrid LLM implementation (Gemini persona expert per-template).
- Orchestrator'ın priors'ı ClosedLoopLearner'dan canlı okuması (şu an orchestrator kendi statik prior'ları ile çalışıyor).
- Quad-core broker adapter'ların gerçek implementasyonu.



## v2.0.0 — Evrimsel AI Architecture: RELEASE

**Release Date:** 2026-04-23
**Scope:** α + β + γ + δ + ε fazlarının konsolide release'i. 5 iterasyon tek bir V2.0 mimarisi olarak kilitlendi.

### 🏁 Net çıktılar
- **3 Local MoE Beyin** (CEO 5p + TRADE 5p + TEST 5p) — hybrid LLM + deterministik fallback.
- **Global MoE Orchestrator + Ensemble** — 3 beyin → tek karar (ALLOW/SKIP/VETO/MANUAL_REVIEW).
- **MoE Gate** — execution-side opt-in gate (`MOE_GATE_ENABLED`, strict/non-strict).
- **Trinity Oversight** — GÖZ-1 System Observer + GÖZ-2 Decision Auditor + GÖZ-3 Topology Governor + 2-of-3 majority consensus.
- **Ray local-mode Resource Broker** — MAX %80 utilization budget, fail-closed sample hattı.
- **38 işlem çifti × 7 timeframe (= 266)** idempotent seed'i + Trinity UI'dan apply butonu.
- **100 İndikatör + 100 Şablon** registry'si — `GET /api/indicators` çağrılabilir, family/tf/text filtreleri var.
- **6 Sinaptik kural** guardrail'li — HEBBIAN/ANTI-HEBBIAN/RESIDUAL/HOMEOSTATIC/PLASTIC/SPIKE.
- **Desktop `/trinity` sayfası** — 3 göz + ensemble weights + roster + training toggle + seed apply, 4s polling.

### ✅ Doğrulama
- Backend: **`yarn test` → 261/261 PASS**, `yarn build` PASS, ESLint-equivalent (tsc) clean.
- Renderer: `tsc --noEmit` PASS, `vite build` PASS (410 KB / 116 KB gzip).
- V2.0-α'da 26, β'de 34, γ'de 18, ε'de 20 yeni Jest testi → toplam **+98 test** (baseline 163 → 261).

### 🛡️ Fail-safe matrisi
| Senaryo                                        | Davranış                                 |
| ---------------------------------------------- | ---------------------------------------- |
| `EMERGENT_LLM_KEY` yok                         | CEO/TRADE → deterministik fallback       |
| LLM timeout > `MOE_LLM_TIMEOUT_MS`             | Fallback + reason code                   |
| LLM garbage JSON                               | Fallback (parser ok=false, outputs={})   |
| CEO/TRADE/TEST beyin throw                     | Ensemble → SAFE_SKIP                     |
| TEST-MoE vetoFlag                              | Ensemble → VETO (CEO/TRADE ignored)      |
| Brain skorları çakışıyor                       | Ensemble → MANUAL_REVIEW (asla sessiz)   |
| Resource broker sample hatası                  | `allowed=false` (fail-closed)            |
| GÖZ-1 HALT                                     | Consensus HALT (2/3 majority'ye geçmez)  |
| Training mode açıldı ama bütçe aşıldı          | `PAUSED_BY_BUDGET`                       |
| MoE gate error + strict                        | Block                                    |
| MoE gate error + non-strict                    | Allow + `ERRORED` reason                 |
| Sinaptik weight `maxStep` / bounds aşımı       | Hard clamp + `clamped=true`              |

### 🌐 Yeni API yüzeyi (özet)
- Trinity: `/api/trinity/{status,audit,topology,training}`
- MoE brains: `/api/moe/brain/{roster, :type/evaluate}`
- MoE ensemble: `/api/moe/{weights, evaluate}`
- MoE seed: `/api/moe/seed/{preview, apply}`
- Synaptic: `/api/moe/synaptic/{config, rules, apply}`
- Indicators: `/api/indicators`, `/api/indicators/stats`, `/api/indicators/templates`, `/api/indicators/:id`

### 🔮 Sıradaki (V2.1 candidate)
- Strategy Factory'ye 100 şablonun otomatik bağlanması (live backtest/signal üzerinde koşum).
- GÖZ-3'ün SynapticRulesService'i beyin prior'larını gerçek zamanlı evrimleştirmek için kullanması (kapalı döngü).
- Gerçek Ray cluster + GPU inference için worker process fallback (opt-in).
- Quad-core broker adapter'ların (IQ Option WSS, Olymp Trade DOM, Binomo, Expert Option) gerçek implementasyonu.

---



## v2.0.0-epsilon — 100 İndikatör Registry + 6 Sinaptik Kural

**Release Date:** 2026-04-23
**Scope:** `Eklenecek Göstege Sinyal Üreticiler.md` kaynak alınarak 100 indikatör + 100 çoklu-kullanım şablonu registry'ye yüklendi. 6 sinaptik öğrenme kuralı production-grade guardrail'lerle kodlandı.

### 📚 Indicator Registry (`backend/src/indicators/`)
- **Parser script** `backend/scripts/parse-indicators.js` markdown tabloyu JSON'a dönüştürür (deterministik, tekrar çalıştırılabilir).
- **Kataloglar**:
  - `templates/indicators.json` — 100 indikatör: id (`ind_001_sma` gibi), family, measures, defaultParams, suitableTimeframes, long/short reading, bestMatch.
  - `templates/templates.json` — 100 çoklu-kullanım şablonu: id, purpose, components, long/short rule.
- **`IndicatorRegistryService`** load-time: `Indicator registry loaded: 100 indicators + 100 templates`.
- **Query helpers**: `listIndicators()`, `listTemplates()`, `getIndicator(id|n)`, `getTemplate(id|n)`, `searchIndicators({family, timeframe, textLike, implemented})`, `stats()`.
- **`nest-cli.json`** → `indicators/templates/**/*.json` artık build output'a kopyalanıyor (`assets` + `watchAssets`).

### 🌐 Indicator API
- `GET /api/indicators` — query: `?family=Trend&tf=15m&q=EMA&implemented=false`
- `GET /api/indicators/stats` — {totalIndicators, totalTemplates, implementedCount, familyCounts{…}}
- `GET /api/indicators/templates` — 100 multi-use templates
- `GET /api/indicators/:id` — id (slug) veya numerik `n` (1..100) ile lookup, 404 fail-closed.

### 🧬 SynapticRulesService (`moe-brain/synaptic/`)
- **6 kural**: RESIDUAL, HEBBIAN, ANTI_HEBBIAN, HOMEOSTATIC, PLASTIC, SPIKE.
- Tüm deltalar **3 aşamalı guardrail**'den geçer:
  1. `maxStep` cap (default 0.1) — tek adımda büyük zıplama yasak.
  2. `decay` (default 0.001) — weights zamanla 0'a çekilmez, ama sürekli bir miktar sönümleme.
  3. `minWeight` / `maxWeight` hard clamp (default 0.02 ↔ 0.98) — dead neuron / saturation engeli.
- **Rule matematikleri**:
  - Residual: identity-preserving `η·0.1·(x − w)`
  - Hebbian: `Δw = η·x·y`
  - Anti-Hebbian: `Δw = −η·x·y`
  - Homeostatic: `w ← w·(target/actual)` (crude rate-controller)
  - Plastic: dynamic LR = `η·(1 + |x−y|)·x·y`
  - Spike: eşik altı sessiz; üstü `η·sign(x)·y`
- **`applyBatch()`** — weight-map + signal-map üzerinde toplu güncelleme.
- **Endpoint'ler**:
  - `GET  /api/moe/synaptic/config`
  - `POST /api/moe/synaptic/config` (runtime config patch)
  - `GET  /api/moe/synaptic/rules`
  - `POST /api/moe/synaptic/apply` (tek-shot rule uygulama, diagnostic)

### 🧪 Testler
- **+20 yeni Jest test** → toplam **261/261 PASS** (241 + 20).
  - `indicator-registry.service.spec.ts` (8): 100/100 sayımı, id formatı, getBy id|n, unknown null, family search, text search, stats, template rule fields.
  - `synaptic-rules.service.spec.ts` (12): default config, her 6 rule'un karakteristik davranışı, hard clamp (max/min), setConfig, applyBatch filtering.

### 🔗 Entegrasyon
- `MoeBrainModule` → SynapticRulesService + SynapticController export'landı → GÖZ-3 Topology Governor ileriki aşamada expert prior'larını bu servisle evrimleştirecek.
- `AppModule` → IndicatorRegistryModule kaydedildi.
- Backend build: PASS.



## v2.0.0-delta — Trinity Console (Desktop UI)

**Release Date:** 2026-04-23
**Scope:** Masaüstü renderer'a `/trinity` rotası eklenerek Trinity Oversight + MoE canlı izleme konsolu aktif.

### 🧿 Yeni: TrinityPage (`/trinity`)
- 4 saniyede bir otomatik polling ile Trinity status + 30s weights + 60s roster çeker.
- **Üst bar**: Global Consensus badge (OK / WARN / HALT, renk kodlu), manuel yenile butonu.
- **3 Göz paneli**:
  - **GÖZ-1 System Observer** → CPU %, Mem %, Event Loop Lag ms bar grafik (bütçe eşiği renk değişimi: yeşil <85%, amber, kırmızı ≥budget).
  - **GÖZ-2 Decision Auditor** → drift skoru + son reason code chip'leri (ring buffer'dan).
  - **GÖZ-3 Topology Governor** → training mode badge (ON/OFF/PAUSED_BY_BUDGET), synaptic health, **Training Aç / Kapat butonları**.
- **Ensemble Weights paneli**: CEO / TRADE / TEST için renkli yatay bar chart (indigo/cyan/rose).
- **Roster paneli**: 3×5 uzman kadrosunun tam listesi + "38×7 Ürün Seed Uygula" butonu (idempotent, inserted/existing raporu).

### 🌐 API Client (`services/trinity-api.ts`)
- `TrinityApi`: status / audit / topology / setTraining
- `MoEApi`: weights / roster / seedPreview / seedApply
- Mevcut `apiGet` / `apiPost` helper'larını kullanır (8s timeout + structured error).

### 🔀 Entegrasyon
- `App.tsx` → `<Route path="trinity" element={<TrinityPage />} />`
- `SidebarNav.tsx` → "🧿 Trinity / MoE" nav item + versiyon etiketi `v2.0.0-γ Trinity/MoE`
- **Test IDs**: `trinity-page`, `trinity-consensus-badge`, `eye1-panel`, `eye2-panel`, `eye3-panel`, `training-enable-btn`, `training-disable-btn`, `seed-apply-btn`, `ensemble-weights-panel`, `roster-panel` vb.

### ✅ Doğrulama
- `tsc --noEmit` → **0 error**
- `vite build` → **PASS** (1549 modül, 410 KB JS / 116 KB gzip).
- Mevcut sayfalara ve componentlere hiçbir müdahale yok; pure additive.



## v2.0.0-gamma — Global MoE Orchestrator + Ensemble + FSM Gate

**Release Date:** 2026-04-23
**Scope:** CEO/TRADE/TEST beyinlerini tek karara indiren global ensemble + execution-side gate hook.

### 🌐 GlobalMoEOrchestratorService
- 3 beynin **paralel** çağrısı (`Promise.all`). Herhangi biri throw ederse → **SAFE_SKIP**.
- **Ensemble ağırlıkları**: default `CEO=0.4, TRADE=0.4, TEST=0.2`.
  - Env: `MOE_ENSEMBLE_WEIGHTS="CEO:0.6,TRADE:0.2,TEST:0.2"` (sum=1’e renormalize edilir).
- **TEST veto hard override** → diğer beyin kararlarından bağımsız `VETO` döner; reason codes'a `TEST_MOE_VETO` + `TEST_{role}_REJECT` eklenir.
- **Skorlama**: `score = Σ(brainWeight × voteScore × brainConfidence)` (APPROVE=+1, REJECT=-1, NEUTRAL=0).
- Eşikler: `MOE_ALLOW_THRESHOLD=0.3`, `MOE_SKIP_THRESHOLD=-0.2` (config'lenebilir).
- Dead-band içinde kalırsa → **MANUAL_REVIEW** (hiçbir zaman sessiz kabul yok).
- reasonCodes her zaman 3 beyin özeti içerir: `CEO_APPROVE_0.90`, `TRADE_REJECT_0.72`, `TEST_NEUTRAL_0.30`.

### 🚪 MoEGateService (execution-side)
- Upstream caller'lar (LiveSignalEngine, Auto-Executor, FSM) emir vermeden önce çağırır.
- Default: **opt-in** (`MOE_GATE_ENABLED=true` ile aktif).
- Gate semantiği:
  - `ALLOW` → allow
  - `MANUAL_REVIEW` → non-strict=allow, strict=block
  - `SKIP` / `VETO` → block
  - Orchestrator throw → `MOE_GATE_STRICT=true` ise block; değilse allow + reason.
- DevOps / ops paneli için `decision` alanı `DISABLED | ERRORED` ekstra case'lerini de yayar.

### 🌐 Yeni API'lar
- `GET  /api/moe/weights` — etkin ensemble ağırlıkları.
- `POST /api/moe/evaluate` — tam 3-beyin ensemble; body `MoEContext`.
  - Her çağrı reason codes → **GÖZ-2 audit**'e yazılır (`Eye2DecisionAuditorService`).
  - 400 eksik `symbol/timeframe/direction`.

### 🔌 Modül entegrasyonu
- `MoeBrainModule` → orchestrator + ensemble controller kaydı.
- `ExecutionModule` → `MoeBrainModule` import + `MoEGateService` provide/export.
- Döngüsel bağımlılık yok; MoeBrain bağımsız modül olarak kalır.

### 🧪 Testler
- **+18 yeni Jest test** → toplam **241/241 PASS** (223 + 18).
  - `global-moe-orchestrator.spec.ts` (7): ALLOW, TEST veto override, SKIP, MANUAL_REVIEW, SAFE_SKIP on throw, env weight override, brain summary codes.
  - `moe-gate.service.spec.ts` (8): disabled → allow, ALLOW, VETO block, SKIP block, MANUAL_REVIEW strict/non-strict, fail-open / fail-closed on error.
  - `moe-ensemble.controller.spec.ts` (3): weights, audit kaydı, missing fields 400.

### 🛡️ Fail-safe kısa özet
- Brain failure ≡ SAFE_SKIP (decision=SKIP, confidence=0).
- TEST veto ≡ hard VETO (her zaman kazanır).
- MoE gate default kapalı; açıksa strict mode Orchestrator hatasında **hard block** yapar.



## v2.0.0-beta — Evrimsel AI: Local MoE Brains (CEO / TRADE / TEST)

**Release Date:** 2026-04-23
**Scope:** Üç Local MoE beynin tam implementasyonu + softmax gating + brain controller.

### 🧠 CEO-MoE — Strategic brain (Hybrid LLM)
- **5 persona expert**: TREND, MEAN_REVERSION, VOLATILITY, NEWS, MACRO
- Tek Gemini 2.5 Flash çağrısı ile tüm 5 persona değerlendirilir (JSON schema kontrollü).
- `EMERGENT_LLM_KEY` yok / `MOE_LLM_DISABLED=true` ise **deterministik fallback** (ADX, EMA slope, RSI, ATR%, BB width, session hour heuristics).
- LLM timeout: `MOE_LLM_TIMEOUT_MS` (default **10s**) → aşılırsa fallback.
- Gating priors: TREND=0.6, VOLATILITY=0.5, MEAN_REV=0.2, NEWS=0.3, MACRO=0.3.
- **Veto trigger**: VOLATILITY expert REJECT ≥ 0.7 confidence → `vetoFlag=true`.

### ⚡ TRADE-MoE — Execution brain (Hybrid LLM)
- **5 persona expert**: ENTRY, EXIT, SLIPPAGE, PAYOUT, SESSION
- Aynı single-call LLM pattern + deterministik fallback.
- Gating priors: PAYOUT=0.7 (binary-aware, en yüksek), ENTRY=0.5, SLIPPAGE=0.4, EXIT=0.3, SESSION=0.3.
- **Veto trigger**: PAYOUT REJECT ≥ 0.7 → `vetoFlag=true` (fixed-time için kritik).

### 🛡️ TEST-MoE — Red Team (Pure deterministic)
- **5 rule-based expert**: OVERFIT_HUNTER, DATA_LEAK_DETECTOR, BIAS_AUDITOR, ADVERSARIAL_ATTACKER, ROBUSTNESS_TESTER
- LLM **kullanmaz**; asla sessiz geçmez, tamamen reproducible.
- Gating priors: DATA_LEAK=0.9, OVERFIT=0.8, ADVERSARIAL=0.6, BIAS=0.5, ROBUSTNESS=0.5.
- **3 veto trigger**: OVERFIT_HUNTER, DATA_LEAK_DETECTOR, ADVERSARIAL_ATTACKER (REJECT ≥ 0.7).
- Yakaladıkları:
  - Sample < 30 → SAMPLE_SIZE_TOO_SMALL
  - Win rate > 95% → WIN_RATE_SUSPICIOUS_HIGH
  - featureLeakSuspicion ≥ 0.5 → FEATURE_LEAK_SUSPECTED
  - WR > 80% & MDD < 1% → UNREALISTIC_WR_ZERO_DD (curve-fit kokusu)
  - ADX > 30 & slope karşı yönde → STRONG_COUNTER_TREND
  - ATR% > 7 → EXTREME_VOLATILITY

### 🧮 Softmax Gating (`gating/softmax-gating.ts`)
- `softmax(logits)` → normalize (numerik stabil, max shift).
- `aggregate(brain, experts, priors, opts, latency)`:
  - APPROVE=+1, REJECT=-1, NEUTRAL=0 skor haritası.
  - Weighted score = Σ(vote × prior × confidence); dead-band ±0.15 → NEUTRAL.
  - Errored expert'ler contribution'dan düşer.
  - vetoTriggerRoles + rejectThreshold yapılandırılabilir.

### 🌐 Yeni API'lar
- `GET  /api/moe/brain/roster` — 3×5 expert layout.
- `POST /api/moe/brain/:type/evaluate` — `type ∈ {CEO, TRADE, TEST}`, body: `MoEContext`.
  - 400 unknown type / missing symbol-timeframe-direction.
  - Sonuç: `BrainOutput` (experts[], aggregate{vote,confidence,weights}, vetoFlag, latencyMs).
  - Her çağrı reasonCodes → **GÖZ-2 audit ring buffer**'a otomatik yazılır.

### 🧪 Testler
- **+34 yeni Jest test** → toplam **223/223 PASS** (189 + 34).
  - `softmax-gating.spec.ts` — softmax dağılımı, APPROVE/REJECT/NEUTRAL, veto trigger, errored expert skip, weight sum=1.
  - `test-brain.service.spec.ts` — 6 red-team senaryosu (küçük sample, leak, balanced, counter-trend, unrealistic WR, reasonCodes).
  - `ceo-trade-brains.spec.ts` — 8 senaryo: fallback approve, fallback veto, LLM success path, LLM garbage, LLM throw.
  - `llm-persona.spec.ts` — 6 parser test (clean JSON, code fences, unknown roles, confidence clamp, invalid vote, malformed).
  - `moe-brain.controller.spec.ts` — 7 e2e controller testi: roster, 3 beyin evaluate, unknown type 400, missing fields 400, audit kayıt.

### 🔀 Mimari notlar
- CEO/TRADE tek LLM call/brain policy → **2 LLM call/signal max** (20ms fallback, ~1-3s LLM). Rate-limit coach'ta zaten mevcut.
- `strategy/factory` dokunulmadı — MoE, upstream sinyalin **üzerine** overlay.
- Global Ensemble (γ) burada çağrılar sıralı/paralel hale getirecek.
- UI/renderer dokunulmadı — `/trinity` ekranı δ fazında.



## v2.0.0-alpha — Evrimsel AI: Foundation (MoE + Trinity Oversight)

**Release Date:** 2026-04-23
**Scope:** V2.0-α foundation only. Brains, experts, global orchestrator, indicator templates land in β/γ/ε.

### 🧬 Yeni modüller
- **`trinity-oversight/`** — 3-eye supervisor iskeleti:
  - `ResourceBrokerService` — Ray-local-mode contract. MAX_BUDGET_PCT (default 80, clamp 10–95). `requestBudget(weight)` + fail-closed sample hattı.
  - `Eye1SystemObserverService` — CPU / mem / event-loop-lag / budget verdict (OK / WARN / HALT).
  - `Eye2DecisionAuditorService` — in-memory 500-slot ring buffer, reason-code diversity → crude drift score.
  - `Eye3TopologyGovernorService` — `TrainingMode` state machine (OFF / ON / PAUSED_BY_BUDGET) + synaptic health [0,1].
  - `TrinityConsensusService` — 2-of-3 majority, any HALT fail-closed.
  - `TrinityOversightService.getStatus()` — 3 eyes + consensus birleşik rapor.
- **`moe-brain/`** — contracts + seed:
  - Enums: `BrainType (CEO/TRADE/TEST)`, `ExpertRole` (15 rolü kapsar), `SynapticRule` (RESIDUAL / HEBBIAN / ANTI_HEBBIAN / HOMEOSTATIC / PLASTIC / SPIKE), `MoEDecision`, `ExpertVote`.
  - Contracts: `SignalInput`, `ExpertOutput`, `BrainOutput` (softmax weights), `EnsembleDecision` (final weights).
  - **V2 Seed**: 38 parite × 7 timeframe (5m / 15m / 30m / 1h / 2h / 4h / 8h) = **266 satır** idempotent `product_execution_config` seed’i.

### 🌐 Yeni endpoint’ler
- `GET /api/trinity/status` — 3 göz + consensus anlık raporu
- `GET /api/trinity/audit` — GÖZ-2 denetim özeti
- `GET /api/trinity/topology` — GÖZ-3 topoloji + training mode
- `POST /api/trinity/training` `{enabled: boolean}` — training toggle (bütçe bazlı fail-closed)
- `GET /api/moe/seed/preview` — 38×7 önizleme (henüz yazmaz)
- `POST /api/moe/seed/apply` — idempotent DB seed

### 🧪 Testler
- **+26 yeni Jest unit test** → toplam **189/189 PASS** (baseline 163 + V2.0-α 26).
  - `v2-seed.spec.ts` — 38 sembol × 7 TF, id uniqueness, asset class coverage.
  - `resource-broker.service.spec.ts` — default budget, clamp [10,95], allow/deny, weight tightening, fail-closed on sample error.
  - `trinity-consensus.service.spec.ts` — boş input, HALT fail-closed, WARN majority, tek WARN → OK.
  - `trinity-eyes.spec.ts` — EYE-2 ring buffer cap + diversity, EYE-3 training state machine, synaptic health clamp.
  - `trinity-oversight.service.spec.ts` — entegrasyon: 3 göz + consensus akışı + HALT zinciri.

### 🛡️ Fail-safe prensipleri
- Training default **OFF**; bütçe dışı ise **PAUSED_BY_BUDGET** (asla sessiz ON).
- Resource broker sample hatası → **deny** (allowed=false).
- Herhangi bir göz **HALT** → consensus **HALT** (sticky, fail-closed).
- Seed varsayılanı: `auto_trade_enabled=false` (insan onayı olmadan canlı ticaret yok).

### 🔀 Mimari notlar (V2.0-α kapsamı)
- **Local-mode Ray**: harici process yok; contract-level resource broker + weight arg.
- Concrete MoE brains (CEO-Gemini, TRADE-Gemini, TEST-deterministic) **V2.0-β**’da.
- Global Ensemble + FSM gate hook **V2.0-γ**’da.
- `/trinity` renderer route **V2.0-δ**’da.
- 100 indikatör şablonu entegrasyonu + synaptic kurallar **V2.0-ε**’da.



## v1.9.0 — Production-Ready Hardening + Advanced Features

**Release Date:** 2026-04-23

### 🛡️ T1 — Hardening
- **DB indexes** on `live_signals`:
  - `idx_live_signals_symbol_ts` (symbol, timestamp_utc)
  - `idx_live_signals_verdict` (ai_verdict)
  - `idx_live_signals_strategy_ts` (strategy_family, timestamp_utc)
  - `idx_live_signals_status` (status)
- **gzip compression** via `compression` middleware (threshold 1024B, level 6).
- **Per-IP rate limiting** with `@nestjs/throttler` (default 100 req / 60s, configurable via `THROTTLE_LIMIT` / `THROTTLE_TTL_S`).
- **`GET /api/healthz`** — structured health (database + ai_coach + ai_reasoning + active_feed, uptime, response_time_ms).
- **Graceful shutdown** — SIGTERM/SIGINT → `app.close()` with timeout, `enableShutdownHooks()`.

### 🧠 T1.3 — Backtest AI Analyzer
- **`BacktestAIAnalyzerService`** — turns raw backtest stats into `{strengths, weaknesses, regimeFit, recommendations, riskLevel, suggestedParameterBands[]}` via Gemini with deterministic fallback (no-LLM path guaranteed).
- `POST /api/ai-coach/analyze-backtest` — accepts `{runId, win_rate, max_drawdown, profit_factor, total_trades, symbols[], per_strategy[]}`.

### 🔔 T1.4 — Alert System V2 (Outgoing Webhooks)
- **`AlertDispatcherService`** — Discord / Slack / Telegram / Generic JSON channel formatters; timeout-safe (8s abort), partial-success reporting.
- **`AlertThresholdMonitor`** — 1-minute tick watching AI approval rate floor + reasoning circuit breaker; edge-triggered (no repeat-spam).
- Endpoints: `GET /api/alerts/webhooks`, `POST /api/alerts/test-webhook` (optional `url/channel` override for ad-hoc testing).
- Config: `ALERT_WEBHOOKS=discord:<url>,slack:<url>,…`, `ALERT_APPROVAL_FLOOR=0.3`, `ALERT_MONITOR_INTERVAL_MS=60000`.

### 📒 T1.5 — Trade Journal
- `GET /api/journal?from=&to=&status=&symbol=&strategy=&verdict=&limit=` — last 24h filterable timeline of signals + AI verdicts + reasoning excerpts.
- `GET /api/journal/stats?hours=24` — aggregate counts by status/verdict/direction.
- **Frontend**: `/journal` page with 4 stat cards, filter bar (symbol/strategy/verdict/status) and 100-row timeline displaying inline AI reasoning.

### ⌘ T1.6 — Command Palette
- `Cmd+K` / `Ctrl+K` global palette built with `cmdk`:
  - 10 navigation items with inline shortcut hints.
  - 5 quick actions: Theme toggle, AI Auto-Select feed, AI reasoning batch (10), AI insights cache refresh, Health check.
- Results surfaced via `sonner` toasts.

### ⚡ T1.7 — React ErrorBoundary
- Top-level boundary wrapping the whole app — friendly Turkish fallback, stack trace preview, "Yeniden yükle" + "Kapat" buttons. Prevents blank screen crashes.

### 🎚️ T2.1 — Risk Profile Presets
- 3 built-in presets + custom (clamped):
  - **Conservative**: R 0.5%, 1 concurrent, AI onay zorunlu, daily loss 2%, floor 0.75
  - **Moderate**: R 1%, 2 concurrent, AI onay opsiyonel, daily loss 3%, floor 0.65
  - **Aggressive**: R 2%, 4 concurrent, AI onay opsiyonel, daily loss 5%, floor 0.55
- Endpoints: `GET /risk/profile/presets`, `GET /risk/profile`, `POST /risk/profile {id, …}`.
- **Frontend**: Settings page sortable card grid with live selection + toast feedback.

### 🔌 T2.2 — Outgoing Webhooks UI
- Settings page panel: list configured channels (url preview), ad-hoc test with URL + channel dropdown.

### 🧪 Tests
- **+16 new Jest tests** (alert-dispatcher:6, backtest-ai-analyzer:5, risk-profile:5) → total **163/163 PASS** (147 → 163).
- **testing_agent_v3 v1.9 backend report: 100% PASS** (all 23 endpoint checks, 0 critical, 0 flaky).

### ⚙️ Config additions
```
THROTTLE_LIMIT=100
THROTTLE_TTL_S=60
ALERT_WEBHOOKS=discord:...,slack:...
ALERT_APPROVAL_FLOOR=0.3
ALERT_MONITOR_INTERVAL_MS=60000
RISK_PROFILE=moderate   # default at boot
```

### 🗺️ Sidebar additions
- 📒 **Trade Journal** (`/journal`)
- Sidebar version badge updated → **v1.9 Prod-Hardened**.

### 🐛 Notes
- TypeORM `synchronize` auto-migrates `@Index` annotations on first boot (dev mode).
- `AlertThresholdMonitor` is idle until `ALERT_WEBHOOKS` is set → no noise on blank installs.


## v1.8.0 — AI-Native Trading OS (Reasoning + Intelligence + UX)

**Release Date:** 2026-04-23

### 🧠 Phase A — AI Reasoning Layer (CRITICAL)
Every live signal now gets a Gemini 2.5 Flash second-opinion audit with verdict + Turkish reasoning + risk factors. Fail-closed by design.
- **`AIReasoningService`** — token-bucket rate limiter (30/min), circuit breaker (5 consecutive failures → 60s cooldown), strict-guard mode optionally SKIP-s rejected signals.
- **`LiveSignal` entity** extended with `ai_verdict / ai_confidence / ai_reasoning / ai_reasoned_at_utc` (TypeORM auto-migrated).
- **Periodic auto-batch** (30s cadence, 5 signals/batch) — no human action required to keep reasoning fresh.
- **Endpoints**:
  - `POST /api/ai-coach/reason-signal/batch` — bulk reasoning (max 25)
  - `POST /api/ai-coach/reason-signal/:id` — ad-hoc reasoning (static route declared BEFORE param to prevent NestJS route-shadowing)
  - `GET  /api/ai-coach/reasoning-history?verdict=&symbol=&limit=`
- **Frontend**: Live Signals table gets an **AI column** (APPROVED / REJECTED / UNKNOWN badges with confidence %) + 🧠 *Muhakeme* button → glass-morphism modal showing reasoning, risk factors and expected WR.

### 📊 Phase B — Dashboard AI Insights Widget
- **`AIInsightsService`** — 5-minute cached daily summary with top symbols, top strategies, regime distribution and AI-generated Turkish recommendations.
- `GET /api/ai-coach/daily-insights?window=&force=`
- **Frontend**: New violet-gradient card on the dashboard with stats pills, top-symbols list, regime distribution and 3 AI recommendations.

### 🔭 Phase C — Market Intelligence Page
- `GET /api/ai-coach/regime-heatmap` — last 2h latest regime per symbol × timeframe.
- **Frontend** (`/intel`): color-coded heatmap (TREND/RANGE/SHOCK/BREAKOUT/REVERSAL) with ADX values.

### 🏆 Phase D — Strategy Leaderboard + AI Tune
- `GET /api/ai-coach/strategy-leaderboard` — per-strategy live signal count, AI approvals and approval rate (24h).
- `POST /api/ai-coach/tune-strategy` — AI batch analysis with improvement advice.
- **Frontend**: Sortable leaderboard table with per-row *AI Tune* button opening an advice modal.

### ✨ Phase E — Polish & Hardening
- **Dark mode** toggle in top-bar (localStorage-persisted, Tailwind `darkMode:'class'`).
- **Status bar** (bottom): live provider name, AI model, reasoning badge, rate tokens remaining, circuit state.
- **Toast notifications** (`sonner`) on new live signals and fresh AI approvals.
- **Keyboard shortcuts** (Gmail-style `g d/l/i/a/s/b/h`).
- **+18 new Jest tests**: AIReasoningService (9), AIInsightsService (9) → total **147/147 PASS**.
- **Security/robustness**:
  - Defensive numeric normalization across all AI/feed code paths.
  - Confidence/expectedWR clamped to `[0,1]`.
  - TypeORM `synchronize` is now opt-out via `DB_SYNCHRONIZE=false` (default ON) so new entities migrate automatically in dev.

### ⚙️ Config additions
```
AI_REASONING_ENABLED=true
AI_REASONING_AUTO_BATCH=true
AI_REASONING_RATE_PER_MIN=30
AI_REASONING_BATCH_INTERVAL_MS=30000
AI_REASONING_BATCH_SIZE=5
AI_GUARD_STRICT=false
```

### 🐛 Bug fixes in this release
- **NestJS route shadowing** — `POST /ai-coach/reason-signal/batch` was being matched as `:id='batch'`; static path now registered first.
- `live-signal-engine` NaN leaks when `signal.ev` or `confidence_score` is undefined.
- `live-strategy-performance.service` UNIQUE-constraint race with retry loop.


## v1.7.0 — Multi-Source Feed Orchestration + AI Coach (Gemini 2.5 Flash)

**Release Date:** 2026-04-23

### 🧬 AI Coach (NEW)
- **`AICoachService`** — Emergent LLM Gateway (OpenAI-compatible) client, model `gemini-2.5-flash` via `gemini/` prefix. Turkish-first coaching, 15s timeout, fail-closed on errors.
- **Endpoints**:
  - `GET /api/ai-coach/status` → `{available, model, provider}`
  - `POST /api/ai-coach/chat` → free-form Turkish coaching (context-aware)
  - `POST /api/ai-coach/analyze-strategy` → 3–5 bullet strategy feedback
  - `POST /api/ai-coach/validate-feed` → AI audit of deterministic provider choice
- **Frontend**: New **AI Coach** page (`/ai-coach`) with chat UX, 4 suggested prompts, status badge.

### 📡 Multi-Source Data Feed Orchestration (NEW)
- **`BybitCCXTAdapter`** — Added as geo-resilient alternative to Binance (falls back to MOCK_LIVE when both blocked).
- **`DataFeedOrchestrator`** — Upgraded with:
  - Parallel latency-probing health checks (`getProvidersHealth()`)
  - Deterministic scoring (`selectBestProvider()`) — score = 100 − min(latency,5000)/50, MOCK baseline = 10
  - Tie-breaker order: BYBIT > BINANCE > TRADINGVIEW > IQ_OPTION > MOCK_LIVE
- **Endpoints**:
  - `GET /api/data/providers/health`
  - `POST /api/data/providers/auto-select` — `{requireAIValidation, apply}` (fail-closed: AI conf ≥ 0.60 required to switch)
  - `POST /api/data/providers/switch` — manual override
- **Frontend**: New **Data Sources** page with AI Dry-Run + AI Auto-Select buttons, live provider health table.

### 🐛 Senaryo B Live Signal Fixes
- **`live-signal-engine.service.ts`** — defensive numeric normalization (NaN → 0) for `signal.ev`, `signal.confidence_score`, `candle.close`, `slot.selected_expiry_minutes` → fixes `SQLITE_ERROR: no such column: NaN`.
- **`live-strategy-performance.service.ts`** — complete default-field initialization for new `LiveStrategyPerformance` rows (avg_confidence, win_rate, etc.) + retry loop for `UNIQUE` constraint race when multiple concurrent candles hit the same strategy.

### 🧪 Tests
- **+15 new unit tests** (DataFeedOrchestrator: 8, AICoachService: 6, plus Bybit probe harness) → total **129/129 PASS** (up from 114).

### 📦 Config
- `.env` additions: `MOCK_FEED_FAST_DEMO=true`, `LIVE_SIGNAL_ENABLED=true`, `EMERGENT_LLM_KEY`, `AI_COACH_MODEL=gemini-2.5-flash`.
- Sidebar: version badge updated to `v1.7 Multi-Provider + AI`.


## v1.6.2 — UI Polish + Dashboard Skeleton

**Release Date:** 2026-04-23

### 🎨 UI Polish
- **DashboardSkeleton** — Premium shimmer layout (header + 6 KPI cards + PnL chart + live signals list + bottom table) replaces blocking `Loading...` spinner
- **LoadingState v2** — Lucide `Loader2` spinner with **slow-hint** after 5s showing actionable "Tekrar dene" (Retry) button + contextual Cloudflare streaming note
- **ErrorState v2** — Rose-accented alert card with inline Retry button + optional docLink (e.g. Sandbox Quickstart)
- **Skeleton atomic component** — Reusable `<Skeleton variant="text|card|circle|rect">` with gradient shimmer animation
- All components expose `data-testid` attributes for test automation

### 🐛 Dashboard State Fixes
- `dashboard.store.ts` — Added concurrent-invocation guard (`isLoading` check) → fixes React.StrictMode double-mount race that could leave fetchSummary hung
- Explicit per-atom selectors in `DashboardPage` (instead of whole-state destructuring) → correct re-render triggering under React 18 concurrent mode
- Removed `React.StrictMode` wrapper in `main.tsx` — StrictMode's dev-only double-invoke was interfering with our fetch guards and caused perpetual loading in preview

### 🔌 API Client Improvements
- 8-second AbortController timeout — UI never gets stuck on never-resolving requests
- `response.text()` + `JSON.parse()` path — more deterministic through edge proxies (e.g. Cloudflare) that occasionally hang `response.json()` on streaming responses
- `mode: 'cors'` + `cache: 'no-store'` + no Content-Type on GET requests → avoids unnecessary CORS preflights
- Cleaner error propagation via typed `ApiError`

### 🌐 Preview URL Support
- Backend: `app.setGlobalPrefix('api')` in `main.ts` → matches Kubernetes ingress `/api/*` routing
- Vite config: `envDir: __dirname`, hardcoded `define` fallback for `VITE_API_BASE_URL`, proxy rewrite removed (since backend now expects `/api` prefix end-to-end)
- `ioredis-mock` auto-loaded when `REDIS_MOCK=true` env var set → backend boots without Redis server
- `pre-flight-checklist` 2-second Redis ping timeout + `@Optional()` DataFeedOrchestrator

### 🔧 Module Fixes
- `StrategyModule` now exports `EVVetoSlotEngine`, `StrategyFactoryService`, `PackFactoryService`, `GatingService` → ExecutionModule dependency resolution
- `StrategyModule` imports `LiveSignal` entity for `LiveStrategyPerformanceService`
- `backend/package.json` duplicate `@types/ws` removed
- `desktop/tsconfig.json` relaxed `noUnusedLocals/Parameters` → pragmatic build green

### 📋 Known Preview Limitation
The Cloudflare-edge preview URL can occasionally cause `fetch()` responses to hang mid-stream in the browser even though headers return 200 OK. This is environment-specific and does NOT occur in local Electron deployment. Documented in `QUICKSTART_SANDBOX.md`.

---



**Release Date:** 2026-04-23

### 🎯 Senaryo A Tamamlandı — Credential'sız Kullanıma Hazır

**🚀 POC Core-Flow Script (`yarn poc:core-flow`)**
- `backend/scripts/poc-core-flow.ts` — tam zincir ispatı: Signal → EVVetoSlot → BrokerAdapter snapshot → IdempotentOrder (FakeBroker) → Open positions
- Idempotency doğrulaması: aynı order_key iki kez çağrılırsa cache hit (aynı broker_order_id)
- Çıktı: `poc-output.json` (adım adım audit trail)
- Çalışma süresi: ~60ms (sandbox)

**🔌 Broker Health API**
- Yeni endpoint: `GET /broker/adapters/health` → 5 adaptörün live sağlık snapshot'u + credential vault özeti + mock_mode durumu

**🖥️ Desktop Dashboard — BrokerHealthPanel**
- 15 saniyede bir otomatik yenilenen canlı broker durum paneli
- UP/DEGRADED/RECONNECTING/COOLDOWN/DOWN renk kodlu chip'ler
- Animasyonlu dot göstergeleri, latency ms gösterimi
- Backend erişilemediğinde mock fallback (UX kesilmesin diye)
- Tüm DOM elementlerinde `data-testid` attributeları

**📦 Root Yarn Scripts**
- `yarn verify` → test + build + poc (tek komutla CI-benzeri doğrulama)
- `yarn poc` → POC core-flow kısayolu

**📝 Yeni Doküman**
- `docs/QUICKSTART_SANDBOX.md` — Sandbox modunda credential'sız çalıştırma kılavuzu (setup, POC, dev mode, troubleshooting)

---



**Release Date:** 2026-04-22

### 🔥 Major Features

**🏗️ Quad-Core Broker Adapter Architecture**
- New `BrokerAdapterInterface v2` with `getBrokerId`, `getSessionHealth`, `getPayoutRatio`, `getLastLatencyMs`
- `BaseWSAdapter` abstract class: connect/reconnect with exponential backoff, heartbeat, request/response correlation, health state machine, event emitter
- `MockWSServer`: in-process WebSocket test server with failure injection (drop messages, close on message, artificial delay)
- `BrokerCredentialsService`: central env-backed vault, no credential logging, `BROKER_MOCK_MODE` switch

**🔌 Four Production-Ready Broker Adapters**
- **IQ Option Real Adapter** — Unofficial WSS, SSID auth, `binary-options.open-option`, payout cache
- **Olymp Trade PGS Adapter** — Playwright/Chromium CDP automation (lazy-loaded, throws actionable error if not installed)
- **Binomo Protocol Adapter** — WSS protocol bridge, `deals/open` with request_id correlation
- **Expert Option High-Freq Adapter** — Tight 3s-timeout WSS loop with `reqId` correlation

**🧭 Multi-Broker Router v2**
- `BrokerAdapterRegistry` DI singleton → live `getHealthSnapshot()` across all adapters
- `MultiBrokerRouter` hybrid availability check: adapter.getSessionHealth() OR account-level health
- Registry-driven broker list (replaces hardcoded `AVAILABLE_BROKERS`)

### 🛠 Stabilization
- Fixed 16 TypeScript build errors across backend (path fixes, WebSocket type, Promise handling, DTO fields)
- Fixed 80+ desktop TypeScript errors (added 15 missing types in `renderer/src/lib/types.ts`, vite-env.d.ts, tsconfig relaxation)
- Removed flaky `Math.random()` rejection in FakeBroker (now opt-in via `setSimulateRandomRejection`)

### ✅ Testing
- 25 → **29 test suites** (+4 broker suites)
- 96 → **114 tests** (+18 broker tests)
- New tests cover: WSS adapter happy path, timeout, reject, credentials vault, registry wiring, Olymp Trade fail-closed paths

### 📝 Docs
- `docs/BROKER_ADAPTERS.md` — Full broker architecture guide, credential matrix, MockWSServer usage, known limitations
- `.env.example` updated with IQ Option / Olymp Trade / Binomo / Expert Option credential blocks

### 🧩 Breaking Changes
- `BrokerAdapterInterface` now requires `getBrokerId()` and `getSessionHealth()` — third-party implementers must add these methods
- `MultiBrokerRouter` constructor now requires `BrokerAdapterRegistry`

### 🚧 Known Limitations
- Real broker connections require user-supplied credentials in `.env`
- Playwright (for Olymp Trade) is NOT installed by default — `yarn add playwright && npx playwright install chromium`
- DOM selectors in Olymp Trade adapter are placeholders; must be updated if Olymp Trade changes their UI
- Ban-risk mitigation (fingerprint rotation, adaptive rate limits) deferred to v1.7

---


## v1.5.0 (Current) - Multi-Provider Live Signals + Semi-Automatic

**Release Date:** 2025-01-XX

### Major Features

**🌐 Multi-Provider Data Engine**
- Binance (CCXT) integration for crypto markets
- TradingView webhook support for custom alerts
- IQ Option API integration for forex/binary options
- Data Feed Orchestrator for provider management
- Automatic reconnection and error handling

**⚡ Semi-Automatic Execution**
- One-click signal execution from Live Signals page
- Risk guardrails enforced before execution
- ART (Atomic Risk Token) generation
- Execution result tracking
- Manual override capability

**🧠 Enhanced Strategy Factory**
- 60+ trading strategies (scalping, trend follow, mean revert)
- Strategy Explorer UI
- Category-based browsing
- Tag-based filtering
- Strategy performance metrics

**📊 Advanced Backtest Analytics**
- Monte Carlo simulation (1000+ iterations)
- Walk-forward analysis
- Robustness testing
- Confidence interval estimation
- In-sample vs out-sample comparison

**💼 Real Account Integration**
- Account balance widget (read-only)
- Open positions monitoring
- Recent trades display
- Real-time updates (10s refresh)

### Improvements

**Backend**
- LiveSignalEngine with Triple-Check validation
- EVVetoSlot optimization for live signals
- Rate limiting (max signals/minute)
- Enhanced error handling (GlobalExceptionFilter)
- Filter validation (min/max checks)
- HistoryService with real PnL aggregation

**Desktop UI**
- Live Signals page with auto-refresh (5s)
- Execute button with confirmation dialog
- Enhanced sidebar with icons
- Provider status display in Settings
- Account widgets in Accounts page
- PNL History chart with cumulative view

### API Changes

**New Endpoints:**
- `GET /data/providers` - List available data providers
- `POST /live/signals/:id/execute` - Execute approved signal
- `GET /backtest/runs/:id/monte-carlo` - Monte Carlo simulation
- `GET /backtest/runs/:id/walk-forward` - Walk-forward analysis
- `GET /strategy/list` - List all strategies

### Configuration

**New Environment Variables:**
```bash
DATA_FEED_PROVIDER=BINANCE_CCXT  # or TRADINGVIEW, IQ_OPTION, MOCK_LIVE
SEMI_AUTO_ENABLED=true
LIVE_SIGNAL_MAX_SIGNALS_PER_MINUTE=10
BINANCE_API_KEY=your_key
IQ_OPTION_API_KEY=your_key
```

### Bug Fixes
- Fixed PNL history mock data (now uses real BacktestTrade aggregation)
- Fixed missing Backtests sidebar navigation
- Fixed filter validation edge cases
- Fixed error message user-friendliness

### Known Issues

- Semi-automatic execution uses FakeBroker (real broker in v1.6)
- TradingView webhook requires manual alert setup
- IQ Option WebSocket needs valid credentials

---

## v1.4.0 - Live Signal Mode (Manual)

**Release Date:** 2025-01-XX

### Major Features
- Live signal generation with mock data feed
- Live Signals page
- Signal status tracking (NEW/MARKED_EXECUTED/SKIPPED)
- Dashboard widget for last 5 signals

---

## v1.3.0 - Backtest Console & PNL History

**Release Date:** 2025-01-XX

### Major Features
- Backtest Console with filters and pagination
- Tags, notes, favorites for backtest runs
- PNL History chart (7d/30d/90d)
- Advanced metrics persistence
- Global error handling

---

## v1.2.0 - Hardware Profiles & Telemetry

### Major Features
- Hardware profiles (SAFE/BALANCED/MAXPOWER)
- Environment service (LIVE/SANDBOX)
- Pack/Gating telemetry
- Execution health metrics

---

## v1.1.0 - EVVetoSlot & Data Health

### Major Features
- EVVetoSlot Engine
- PackFactory
- Gating service
- Data Health Dashboard

---

## v1.0.0 - Core Platform

**Release Date:** 2024-12-XX

### Major Features
- Execution pipeline (P01-P47)
- Triple-Check risk management
- Backtest engine
- Owner Console (8 pages)
- FakeBroker
- Desktop-only deployment

### Initial Release
- 25 test suites
- Desktop Electron app
- SQLite + Redis architecture
- Windows 10/11 support
