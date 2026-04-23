# MoonLight Trading OS - Change Log


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
