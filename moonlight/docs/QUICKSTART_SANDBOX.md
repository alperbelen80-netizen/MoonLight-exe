# MoonLight — Sandbox Quickstart

**Hedef:** Hiçbir broker credential'ı olmadan MoonLight'ı yerel makinenizde çalıştırıp tam sinyal→order→reconcile döngüsünü görmek.

## ✅ Ön Koşullar
- **Node.js ≥ 20** (`node -v`)
- **Yarn** (`yarn -v`)
- **Redis** (Backend kuyrukları için) — lokal kurulumu yoksa `docker run -p 6379:6379 redis:7-alpine`

## 1️⃣ Kurulum
```bash
cd /app/moonlight
yarn install                 # root + backend + desktop bağımlılıkları
cp backend/.env.example backend/.env
```

`backend/.env` dosyasında sandbox için **hiçbir broker credential'ı doldurmanız gerekmiyor** — default ayarlar FakeBroker + MOCK_LIVE data feed ile çalışır.

## 2️⃣ Smoke Test — POC Core-Flow
```bash
cd /app/moonlight/backend
yarn poc:core-flow
```

**Ne yapar?**  Çekirdek işlem zincirini uçtan uca koşturur:
1. Canonical signal üretir
2. EVVetoSlot kararı (slot seçimi, EV hesabı)
3. 5 broker adapter'ın sağlık durumu
4. Credential vault özeti
5. FakeBroker'a idempotent order (2 kez: 2.'si cache hit olmalı)
6. Open positions okuma
7. JSON raporu `poc-output.json`

**Beklenen çıktı (özet):**
```
🔹 Step 2 — EVVetoSlot Decision: decision=ACCEPT
🔹 Step 3 — Broker Adapter Registry Snapshot:
   FAKE             health=DOWN  ...
   IQ_OPTION        health=DOWN  ...
   OLYMP_TRADE      health=DOWN  ...
   BINOMO           health=DOWN  ...
   EXPERT_OPTION    health=DOWN  ...
🔐 Credential Vault: hasCredentials=false (4 broker)
🔹 Step 4 — Idempotent Order: idempotent: ✅ PASS
✅ POC CORE-FLOW OK
```

## 3️⃣ Backend'i Başlatma (Dev Mode)
```bash
cd /app/moonlight/backend
yarn start:dev
```
Backend `http://localhost:8001` üzerinden çalışır. Test:
```bash
curl http://localhost:8001/owner/dashboard/summary
```

## 4️⃣ Desktop App'i Başlatma
```bash
cd /app/moonlight/desktop
yarn dev                 # Vite dev server + Electron
```
Veya sadece tarıcıda görmek için:
```bash
cd /app/moonlight/desktop
yarn dev                 # Vite sayfasını http://localhost:5173'te açın
```

## 5️⃣ Tam Stack (Tek Komut)
Root dizinden:
```bash
cd /app/moonlight
yarn dev                 # concurrently backend + desktop
```

## 6️⃣ Doğrulama Listesi ✅
- [ ] `yarn test` → 114/114 PASS
- [ ] `yarn build` (backend) → 0 error
- [ ] `yarn build` (desktop) → 0 error
- [ ] `yarn poc:core-flow` → ✅ POC CORE-FLOW OK
- [ ] Desktop app Dashboard açılıyor
- [ ] Live Signals sayfası mock data ile sinyal gösteriyor
- [ ] Execution Matrix sayfası symbol/tf flag'lerini gösteriyor

## 🚀 Sonraki Adım — Senaryo B (Live Signals)
Gerçek piyasa datasıyla canlı sinyal üretmek için:
1. `BINANCE_API_KEY` ve `BINANCE_API_SECRET` alın → `backend/.env`
2. `DATA_FEED_PROVIDER=BINANCE_CCXT` olarak değiştirin
3. Backend'i restart: `yarn start:dev`
4. Detaylar için: `docs/LIVE_SIGNAL_SETUP.md` (yakında)

## 🤖 Sonraki Adım — Senaryo C (AI-Powered Full-Auto)
Gemma E4B entegrasyonu ile tam otomatik AI trading için v1.7+ hedeflenir. Detaylar için `docs/AI_COACH_INTEGRATION.md` (yakında).

## Sorun Giderme

**Redis bağlantı hatası:**
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```
→ Redis çalışmıyor: `redis-server` veya `docker run -p 6379:6379 redis:7-alpine`

**Port 8001 meşgul:**
```
Error: listen EADDRINUSE: address already in use :::8001
```
→ Önce diğer instance'ı durdurun: `pkill -f 'node.*nest'`

**POC core-flow REJECT döndü:**
→ EV düşük çıkmış olabilir. Script tekrar çalıştırın; signal random EV olmadığı için deterministik ama payout provider'ın durumuna bağlı.
