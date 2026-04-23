# MoonLight Owner Console — Windows `.exe` Build Guide (v2.6-3)

> Bu belge, kullanıcının bilgisayarında **çift tıklanarak kurulabilen**
> Windows NSIS installer'ını (`.exe`) nasıl üreteceğini anlatır.
> **Resmi/önerilen yol:** GitHub Actions `windows-latest` runner.
> **Geliştirici yolu (best-effort):** Linux + Wine (kırılgan).

---

## 1) Nasıl çalışıyor (mimari özet)

MoonLight iki parçadan oluşur:

1. **Backend** — NestJS + TypeORM (SQLite) + Redis (opsiyonel) + Bull.
   - `backend/src/**` → `backend/dist/**` (TypeScript compile)
   - `backend/dist/backend/src/main.js` → `dist-bundle/backend.js`
     ( `esbuild` ile tek dosya ~5 MB paket; native/hostile deps external )
2. **Desktop** — Electron + React (Vite) + Tailwind.
   - `desktop/main/*.ts` → `desktop/dist-electron/**`
   - `desktop/renderer/src/**` → `desktop/dist-renderer/**`

Paketleme aşamasında `electron-builder`:

- Electron main + preload + renderer'ı `resources/app.asar` içine koyar.
- `dist-bundle/backend.js`, `backend/node_modules` ve `backend/src/config` +
  `backend/src/indicators/templates` dizinlerini `resources/backend-bundle/`
  altına `extraResources` olarak **asar dışına** kopyalar. Bu, Node
  alt-işleminin bu dosyaları doğrudan `require`/`readFile` ile okuyabilmesi
  için zorunludur.
- NSIS installer (`.exe`) üretir.

Çalışma zamanında **Electron main** `BackendManager` üzerinden:

- Boş bir port ayarlar (varsayılan 8001, meşgulse bir sonraki).
- `process.execPath` ( = Electron binary'si ) + `ELECTRON_RUN_AS_NODE=1`
  ile `backend.js`'i spawn eder.
- `cwd` olarak `resources/backend-bundle/` verir, böylece bundle-safe
  config resolver `src/config/*.yaml` dosyalarını yerel olarak bulur.
- `MOONLIGHT_CONFIG_DIR` env'i de aynı dizine işaret eder (belt-and-suspenders).
- `/api/healthz` yeşile dönene kadar sağlık kontrolü yapar.
- Renderer'a seçilen port IPC ile bildirilir: `window.moonlight.getBackendPort()`.

**Secrets (SSID vb.) asla paketlenmez**; kullanıcı UI'da Settings → Vault
üzerinden girer. Packaged modda **fail-closed** prensibi gereği `.env`
plaintext secret kabul edilmez.

---

## 2) Resmi yol: GitHub Actions Windows runner

### 2.1. Gereksinimler
- GitHub repo'da write izni.
- (Opsiyonel) Code-signing sertifikası için `CSC_LINK` + `CSC_KEY_PASSWORD`
  repo secret'ları.

### 2.2. Release alma
1. Yerelde:
   ```bash
   git tag v2.6.3
   git push origin v2.6.3
   ```
2. GitHub Actions → **Release Windows Installer** workflow'u otomatik başlar.
3. Adımlar (yaklaşık 8-12 dakika):
   - Node 20 + yarn kurulumu
   - `yarn install --frozen-lockfile` (root + desktop)
   - `yarn build:backend` (TS compile)
   - `yarn bundle:backend:prod` (esbuild minify → `dist-bundle/backend.js`)
   - `cd backend && npm install --omit=dev --no-package-lock`
     (izole runtime deps; `sqlite3` vs. Windows x64 binary'leri indirilir)
   - `npx @electron/rebuild -m ../backend/node_modules -o sqlite3,keytar,...`
     (native modüller Electron ABI için rebuild edilir)
   - `yarn build:desktop` (renderer + main)
   - `cd desktop && yarn dist:win` (NSIS x64 installer)
4. Çıktı:
   - `desktop/dist/MoonLight-Owner-X.Y.Z-win-x64.exe`
   - `desktop/dist/MoonLight-Owner-X.Y.Z-win-x64.exe.sha256`
   - Workflow artifact olarak (30 gün)
   - Tag push ile **GitHub Release**'e otomatik eklenir.

### 2.3. Manuel tetikleme
GitHub Actions UI → **Run workflow** butonu. Tag zorunlu değil.

---

## 3) Geliştirici yolu: Linux + Wine (best-effort)

> **Uyarı:** Bu yol kırılgan, yavaş ve bazı native modüllerde başarısız olabilir.
> Ciddi release'ler için mutlaka GitHub Actions tercih edin.

```bash
cd /path/to/moonlight
./scripts/wine-build-win.sh
```

Script şunları yapar:
1. Wine + NSIS + mono'yu yüklemeye çalışır (sudo apt-get).
2. Backend'i derler ve bundle'lar.
3. Backend için izole `npm install` yapar.
4. Desktop'ı derler.
5. `electron-builder --win nsis --x64` ile `.exe` üretir.

Script'i `SKIP_WINE_INSTALL=1` ile çalıştırırsanız apt adımı atlanır.

---

## 4) Yerel geliştirme (development)

### 4.1. Full stack dev
```bash
# Root
yarn install

# Terminal 1: Backend
cd backend && yarn start:dev

# Terminal 2: Desktop (renderer)
cd desktop && yarn dev

# Terminal 3: Electron (spawn backend off, renderer'dan fetch eder)
cd desktop && MOONLIGHT_SPAWN_BACKEND=false electron .
```

### 4.2. Lokal paketlenmiş smoke (Linux)
```bash
cd /path/to/moonlight

# Backend + bundle + desktop + electron-builder --dir
cd desktop && yarn dist:dir

# Packaged backend'i doğrula
node scripts/smoke-packaged.js
```

Bu script `desktop/dist/linux-arm64-unpacked/resources/backend-bundle/backend.js`'i
plain `node` ile spawn eder, `/api/healthz` ve `/api/secrets/health`'ı ping'ler,
sonra temiz SIGTERM yapar. PASS görüyorsanız Windows build'in de başarılı
olma ihtimali çok yüksek.

### 4.3. Test matrisi
```bash
# Backend Jest (hedef: 387/387 PASS)
cd backend && yarn test

# Desktop Vitest (BackendManager contract, hedef: 9/9 PASS)
cd desktop && yarn test

# Bundle spawn smoke (dev bundle)
yarn smoke:bundle

# Packaged smoke (dist/linux-*-unpacked sonrası)
node scripts/smoke-packaged.js
```

---

## 5) Sık Karşılaşılan Hatalar

### 5.1. `Cannot compute electron version from installed node modules`
**Çözüm:** `desktop/package.json` → `build.electronVersion` alanında
Electron sürümü sabitlenmiş olmalı (örn. `"28.3.3"`). Workflow'da
`yarn install --frozen-lockfile` da **desktop** workspace'inde koşmalı.

### 5.2. `ENOENT: no such file or directory … src/config/hardware-profiles.yaml`
**Sebep:** Backend `process.cwd()` tabanlı path kullanıyor ama spawn cwd yanlış.
**Çözüm:** `BackendManager` artık `cwd = bundleDir` ve
`MOONLIGHT_CONFIG_DIR = bundleDir/src` set ediyor. Kendi özel spawn
yazıyorsan aynısını yap.

### 5.3. `sqlite3: bindings file not found`
**Sebep:** Native binary Electron ABI ile uyumsuz veya hiç yüklenmemiş.
**Çözüm:** CI'da `@electron/rebuild` çalıştırılıyor. Yerelde:
```bash
cd desktop
npx @electron/rebuild -m ../backend/node_modules -o sqlite3 -f
```

### 5.4. `keytar not available — falling back to AES-256-GCM file vault`
**Normal davranış.** Keytar opsiyonel; yoksa MoonLight kendi
şifreli vault dosyasını kullanır (machine-bound scrypt key). Windows'ta
keytar genelde otomatik çalışır; Linux'ta `libsecret-1-dev` + D-Bus gerekir.

### 5.5. `SmartScreen: Windows protected your PC`
**Sebep:** Installer code-signed değil.
**Çözüm:** "More info" → "Run anyway". Veya kod imzalama sertifikası
temin edip `CSC_LINK` / `CSC_KEY_PASSWORD` secret'larını ekle.

### 5.6. `EACCES/EPERM` dosya yazma hatası kurulumda
**Sebep:** `perMachine: true` varken kullanıcı admin değil.
**Çözüm:** Mevcut config `perMachine: false` (AppData altına kurulur);
admin gerektirmez. Değiştirdiysen `allowElevation: true` eklenmeli.

---

## 6) Dosya/Yol Envanteri

| Konu | Yol |
| --- | --- |
| Electron-builder config | `desktop/package.json` → `build` |
| Pre-package doğrulama | `desktop/scripts/prepackage-check.js` |
| AfterPack hook | `desktop/scripts/after-pack.js` |
| İkonlar | `desktop/build/icon.ico` + `icon.png` |
| Backend bundler | `scripts/bundle-backend.js` |
| Packaged smoke | `scripts/smoke-packaged.js` |
| Wine build script | `scripts/wine-build-win.sh` |
| CI workflow | `.github/workflows/ci.yml` |
| Release workflow | `.github/workflows/release.yml` |
| Electron spawn logic | `desktop/main/backend-manager.ts` |
| Bundle-safe config resolver | `backend/src/shared/utils/resolve-config-path.ts` |

---

## 7) Kullanıcı Deneyimi (Son Kullanıcı Flow'u)

1. Kullanıcı `MoonLight-Owner-X.Y.Z-win-x64.exe`'yi indirir.
2. Çift tıklar → NSIS kurulum sihirbazı açılır.
3. Kurulum dizinini seçer (varsayılan: `%LOCALAPPDATA%\Programs\MoonLight Owner Console`).
4. Masaüstü + Başlat Menüsü kısayolları oluşur.
5. "Finish" → MoonLight Owner Console açılır.
6. Electron **`BackendManager`** backend'i arkada başlatır (10-20 sn).
7. UI bağlantı kurduğunda **Dashboard** yüklenir.
8. Settings → Vault → Credentials → `IQ_OPTION_SSID` vb. girilir
   (keytar OS keychain'e, yoksa AES-256-GCM dosyaya şifrelenir).
9. Mode → **Sandbox** (default) veya **Live** seçilir;
   broker flag'leri **opt-in** olarak kullanıcı tarafından açılır.

---

## 8) Sonraki Adımlar (V2.6-4+)

- **V2.6-4:** `electron-updater` ile otomatik güncelleme (GitHub Releases feed).
- **V2.6-4:** Electron `crashReporter` + backend crash log telemetry.
- **V2.6-5:** IQ Option WSS gerçek hardening + DOM live click hardening.
- **V2.6-6:** Multi-broker intelligent routing skor tuning.

---

_Bu dosya `v2.6-3` sürümüyle oluşturuldu._
