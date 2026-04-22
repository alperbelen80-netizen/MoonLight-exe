# MoonLight Quad-Core Broker Adapters

Bu doküman v1.6'nın en kritik yeniliği olan **Quad-Core Broker Adapter** mimarisini anlatır. Hedef: tek bir `BrokerAdapterInterface v2` sözleşmesi altında, 4 farklı binary-options brokerını (**IQ Option, Olymp Trade, Binomo, Expert Option**) production-ready standartlarda sürmek.

---

## 1) Mimari

```
┌─────────────────────────────────────────────────┐
│              BrokerAdapterRegistry              │
│  (DI-singleton; listeler + getHealthSnapshot)   │
└──┬──────┬──────────────┬──────────────┬─────────┘
   │      │              │              │
   ▼      ▼              ▼              ▼
┌─────┐ ┌──────────┐ ┌────────────┐ ┌──────────┐
│ IQ  │ │  Olymp   │ │   Binomo   │ │  Expert  │
│ WSS │ │  CDP/RPA │ │   WSS      │ │  Option  │
└──┬──┘ └─────┬────┘ └──────┬─────┘ │   WSS    │
   │         │              │       └─────┬────┘
   │         │              │             │
   ▼         ▼              ▼             ▼
┌────────────────────────────────────────────────┐
│              BaseWSAdapter                     │
│  connect/reconnect/heartbeat/pending-request   │
│  (IQ, Binomo, Expert Option extend this)       │
└────────────────────────────────────────────────┘

(Olymp Trade, Playwright tabanlı CDP akışı için ayrı bir katman kullanır.)
```

### Ortak Sözleşme — `BrokerAdapterInterface`

Her adaptör MUST:

- `getBrokerId()` — stabil kimlik (`IQ_OPTION` | `OLYMP_TRADE` | `BINOMO` | `EXPERT_OPTION` | `FAKE`)
- `getSessionHealth()` — Hiç throw etmez, `UP | DEGRADED | RECONNECTING | COOLDOWN | DOWN`
- `connectSession(accountId)` — Başarısızlıkta throw
- `disconnectSession(accountId)` — Throw etmez
- `sendOrder(request)` — Her zaman `ACK | REJECT | TIMEOUT` ile resolve; asla hang etmez
- `getOpenPositions(accountId)`
- `getBalance(accountId)` — 0 döndürür eğer session authenticated değilse
- _(opsiyonel)_ `getPayoutRatio(symbol, expiry)`
- _(opsiyonel)_ `getLastLatencyMs()`

### Fail-Closed Politikaları

| Durum | Davranış |
|---|---|
| Credentials eksik & `BROKER_MOCK_MODE != true` | `REJECT(NOT_CONFIGURED)` |
| Session `DOWN/DEGRADED/RECONNECTING` | `REJECT(SESSION_DOWN)` |
| WS response timeout | `TIMEOUT(TIMEOUT)` |
| Broker reject | `REJECT(BROKER_REJECT)` + reason |

---

## 2) Credentials (`.env`)

`BrokerCredentialsService` hepsini tek noktada okur. `.env.example` içinde tam liste mevcut.

| Broker | Gerekli ENV |
|---|---|
| **IQ Option** | `IQ_OPTION_SSID`, `IQ_OPTION_BALANCE_ID` |
| **Olymp Trade** | `OLYMP_TRADE_EMAIL`, `OLYMP_TRADE_PASSWORD` |
| **Binomo** | `BINOMO_AUTH_TOKEN` |
| **Expert Option** | `EXPERT_OPTION_TOKEN` |
| **Mock Mode** | `BROKER_MOCK_MODE=true` (credentials check'i atlar, MockWSServer ile test için) |

**🔒 Güvenlik**: Credentials asla log'lanmaz. `BrokerCredentialsService.summary()` yalnızca `hasCredentials` boolean'ı verir.

---

## 3) Test Stratejisi — MockWSServer

`src/broker/adapters/testing/mock-ws-server.ts` — gerçek broker'lara bağlanmadan lokal test.

```ts
const server = new MockWSServer();
const port = await server.start();
server.setHandler((raw) => {
  const msg = JSON.parse(raw);
  if (msg.name === 'sendMessage') {
    return { name: 'binary-options.open-option', request_id: msg.request_id, msg: { id: 'POS_1', isSuccessful: true, price: 1.2 } };
  }
  return null;
});

process.env.IQ_OPTION_WS_URL = `ws://127.0.0.1:${port}`;
// ... adapter.connectSession() / sendOrder()
await server.stop();
```

Hata enjeksiyonu:
- `server.dropNextMessages(n)` — n mesajı yanıtlamadan yutar
- `server.closeClientOnNextMessage()` — socket'i aniden kapatır (reconnect testi)
- `server.setArtificialDelay(ms)` — latency simülasyonu

---

## 4) Adaptör Spesifik Notlar

### 🔸 IQ Option (`iq-option-real.adapter.ts`)
- **Protokol**: Unofficial WSS. Auth: `{ name: 'ssid', msg: '<SSID>' }`
- **Order**: `binary-options.open-option` with `request_id` correlation
- **Payout cache**: `instruments.binary.payout` event'i dinler, `getPayoutRatio()` ile expose eder
- **Reconnect**: Exponential backoff (1s → 30s cap), max 6 deneme → `COOLDOWN`

### 🔸 Olymp Trade (`olymp-trade-pgs.adapter.ts`)
- **Protokol**: Resmi API yok → **CDP + Playwright (Chromium)**
- **Kurulum**: `yarn add playwright && npx playwright install chromium`
- **Lazy-load**: Playwright kurulu değilse `PLAYWRIGHT_NOT_INSTALLED` hatası (kalan backend etkilenmez)
- **DOM selector'lar**: `[data-test="asset-selector"]`, `[data-test="amount-input"]`, `[data-test="buy-higher"]` vb. — Olymp Trade UI değişirse selector'lar güncellenmelidir
- **Headless/Headful**: `OLYMP_TRADE_HEADLESS=true` (default)

### 🔸 Binomo (`binomo-protocol.adapter.ts`)
- **Protokol**: WSS, JSON `{action, data, request_id}` formatı
- **Auth**: `{action: 'auth', data: {token, device_id}}`
- **Order**: `deals/open` → `deals/open/response` correlation via `request_id`

### 🔸 Expert Option (`expert-option-highfreq.adapter.ts`)
- **Protokol**: Yüksek frekanslı WSS (`reqId` tabanlı)
- **Heartbeat**: 15s (en agresif ping aralığı)
- **Timeout**: 3s (HFT odaklı)

---

## 5) Registry Kullanımı

```ts
constructor(private readonly registry: BrokerAdapterRegistry) {}

// Runtime'da broker seç:
const adapter = this.registry.get('IQ_OPTION');
await adapter.connectSession('ACC_1');
const ack = await adapter.sendOrder(request);

// Tüm brokerlar için sağlık durumu:
const snapshot = this.registry.getHealthSnapshot();
// [{ brokerId: 'IQ_OPTION', health: 'UP', latencyMs: 123 }, ...]
```

`MultiBrokerRouter` bu registry'yi tüketerek latency/payout/health skorlamasıyla en iyi brokerı seçer (v1.7 hedefi).

---

## 6) Bilinen Sınırlamalar

| Konu | Durum |
|---|---|
| Gerçek IQ/Binomo/Expert Option WSS'e bağlanma | Credentials + network ile **hazır** |
| Olymp Trade DOM selector'larının güncelliği | Manüel bakım gerekebilir |
| Ban-riski azaltıcı katman (fingerprint rotation, rate limit adaptif) | **v1.7** |
| Reconciliation worker'ın position close eventlerini dinlemesi | **v1.7** |
| Multi-broker intelligent routing (skorlama) | **v1.7** |
| Real payout matrix (live injection) | IQ Option'da `getPayoutRatio` mevcut; Binomo/Expert Option için v1.7 |

---

## 7) Test Matrisi

| Test Dosyası | Kapsam | Count |
|---|---|---|
| `broker-credentials.service.spec.ts` | ENV okuma, hasCredentials, mock mode | 4 |
| `wss-adapters.spec.ts` | IQ/Binomo/Expert Option happy + timeout + reject | 7 |
| `olymp-trade-pgs.adapter.spec.ts` | Creds missing, id, health | 3 |
| `broker-adapter.registry.spec.ts` | DI, list, get, snapshot | 4 |
| `idempotent-order.service.spec.ts` | Mevcut retry/cache | — |

**Toplam**: 23 yeni broker testi (114/114 total).

---

## 8) Quickstart — Gerçek Bir Broker'a Bağlanma

```bash
# 1) .env doldur (örn IQ Option)
echo 'IQ_OPTION_SSID=your_ssid_value' >> backend/.env
echo 'IQ_OPTION_BALANCE_ID=12345' >> backend/.env

# 2) Sunucuyu başlat
cd backend && yarn start:dev

# 3) Session test
curl -X POST http://localhost:8001/broker/session/connect \
  -H 'Content-Type: application/json' \
  -d '{"brokerId":"IQ_OPTION","accountId":"ACC_1"}'
```

⚠️ **Resmi olmayan API'ler ToS ihlali olabilir. Canlı kullanım öncesi broker'ın hizmet şartlarını inceleyin ve kendi sorumluluğunuzda işlem yapın.**
