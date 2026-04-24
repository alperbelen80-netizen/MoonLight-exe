# MoonLight — Troubleshooting Guide (v2.7.0)

> Bu belge MoonLight Owner Console'un Windows `.exe` build ve dağıtım
> sürecinde karşılaşılan sık sorunları ve çözümlerini listeler. Her sorun
> için: **Belirti → Sebep → Çözüm** formatı kullanılmıştır.

---

## A. GitHub Actions Workflow


## 🚨 v2.7.3 Rescue Patch — `v2.7.2` fail post-mortem

**Belirti:** `v2.7.2` tag push'u → GitHub Actions → 5 dk 0 sn'de fail + "Failure summary" step 22 (Publish GitHub Release) skipped.

**6 Kök Sebep ve çözümleri** (hepsi v2.7.3'te otomatik düzeltildi):

| # | Sebep | Çözüm |
|---|-------|-------|
| 1 | `yarn install --frozen-lockfile` yarn.lock yok/uyumsuz | Workflow'dan `--frozen-lockfile` kaldırıldı |
| 2 | `yarn dist:win -- --publish never` arg-forwarding | `dist:win` script'ine `--publish never` gömüldü + yeni `dist:win:ci` |
| 3 | `electron-builder ^24.9.1` NSIS spawn hatası | Pin: `electron-builder@24.13.3` |
| 4 | NSIS `${DriveSpace}` makrosu makensis.exe fail | `installer.nsh` minimized (WinVer only) |
| 5 | `desktop/package.json version: 1.0.0` tag mismatch | Workflow step 4b tag'den versiyonu senkronize eder |
| 6 | `repository` / `author` alanları eksik | package.json'a eklendi |

**Kullanıcı aksiyonu:** Yeni tag `v2.7.3` (cache invalidation için), yarn.lock commit.

---


### A1. `yarn install` ağ zaman aşımı alıyor (`ESOCKETTIMEDOUT`, `ETIMEDOUT`)

**Belirti:**
```
error An unexpected error occurred: "https://registry.yarnpkg.com/...: ESOCKETTIMEDOUT"
```

**Sebep:** Yarn'in varsayılan network timeout'u (30s) GitHub runner'larında
paket indirmek için yetersiz kalıyor.

**Çözüm:**
- `release.yml` içinde her `yarn install` adımında zaten
  `--network-timeout 600000` (10 dakika) kullanıyor. Yine de başarısız
  olursa workflow otomatik `npm install --legacy-peer-deps` fallback'ine geçer.
- Eğer yine de başarısız olursa: runner bölgesinde geçici olarak Yarn
  registry sorunu olabilir; `Actions → Re-run failed jobs` ile yeniden deneyin.

---

### A2. `nick-fields/retry` action Windows'ta `cd` komutunu tanımıyor

**Belirti:** Windows runner'da `Working directory ... does not exist` benzeri.

**Sebep:** `nick-fields/retry@v2` `command:` input'unu iç bir shell içinde
koşturur ve Windows path ayracıyla çakışır.

**Çözüm:** v2.7.0 workflow'unda bu action **kullanılmıyor**. Her adım
doğrudan `run:` + `working-directory:` kullanıyor.

---

### A3. `@electron/rebuild` Windows runner'da sqlite3 compile ederken patlıyor

**Belirti:**
```
gyp ERR! stack Error: Could not find any Visual Studio installation to use
```

**Sebep:** Native compile için MSBuild gerekli. Windows runner'da var ama
bazı prebuilt binary yoksa kaynak derlemeye düşer.

**Çözüm:** Workflow adımı `continue-on-error: true` işaretli — rebuild
başarısız olsa bile release'i bloklamaz. sqlite3'ün hâlâ prebuild binary'si
paket içine gömülür. Gerçek bir kullanıcıda sorun çıkarsa installer
yeniden açılıp `npm rebuild sqlite3` çalıştırılır.

---

### A4. `.exe` üretilmiyor — `No .exe produced under moonlight/desktop/dist`

**Belirti:** Step 18 (`Verify installer .exe`) hata verir.

**Sebep:** `electron-builder` sessizce başarısız olmuştur (genelde asar
packing veya NSIS include script hatası).

**Çözüm:**
1. Workflow'u yeniden başlat → `workflow_dispatch → debug_mode=true`.
   Bu, `DEBUG=electron-builder` env'i set eder, detaylı log alırsınız.
2. `Artifacts → moonlight-build-logs-<run_id>` artifact'ini indirip
   `desktop/dist/builder-*.log` dosyalarına bakın.
3. En sık sebep: `desktop/build/installer.nsh` içinde syntax hatası.

---

## B. Backend (NestJS + esbuild bundle)

### B1. Bundle 5 MB civarında mı olması gerekiyor?

**Evet.** Minified production bundle (`yarn bundle:backend:prod`) ~5.2 MB
olur. Source map dahil değildir. `backend.meta.json` ile composition
analizi yapabilirsiniz.

**Tanı:** `dist-bundle/backend.meta.json` açılır, en büyük modüller
listelenir. 100 KB'tan küçük bundle üretilirse script zaten `exit 1` eder.

---

### B2. `Cannot find module 'sqlite3'` — runtime hatası

**Sebep:** `backend/node_modules/sqlite3` packaged installer'da yok.

**Çözüm:** Workflow step 13 (`Install backend runtime deps`) bu modülü
`npm install --omit=dev` ile kurar. Local build için:
```bash
cd moonlight/backend && npm install --omit=dev --no-package-lock
```

---

### B3. `NestJS bootstrap` sırasında port 8001 meşgul

**Belirti:** `EADDRINUSE: address already in use :::8001`

**Sebep:** Paralel çalışan bir dev-backend veya önceki session'dan kalma process.

**Çözüm:** Electron `BackendManager` aslında `pickFreePort()` ile boş port
bulur; eğer manuel çalıştırıyorsanız `PORT=8101 yarn dev:backend`.

---

## C. Desktop (Electron + Vite)

### C1. Vite `chunkSizeWarning` uyarısı (> 500 KB)

**Çözüm:** v2.7.0 ile `vite.config.ts` içinde `chunkSizeWarningLimit: 2000`
olarak ayarlandı + `manualChunks` ile vendor ayrıştırması yapıldı. Uyarı
gelmez.

---

### C2. Renderer beyaz ekran açılıyor / hata gösteriliyor

**Sebep:** JavaScript runtime hatası.

**Çözüm:** `ErrorBoundary` component'i App ağacının en üstüne sarılmış
durumda (`renderer/src/App.tsx`). Hata yakalanırsa kullanıcıya şu
gösterilir:
- Hata mesajı
- Stack trace (dev mode'da)
- "Reload" ve "Report" butonları

---

### C3. `electron-updater` güncelleme kontrolü başarısız

**Sebep:** `latest.yml` manifest dosyası release'e eklenmemiş.

**Çözüm:** Workflow step 22 (`Publish GitHub Release`) `latest.yml`'i
otomatik attach ediyor. Manuel yükleme yapıyorsanız `latest.yml`'i
unutmayın — `desktop/package.json build.publish.provider: github`
ayarı bu dosyayı üretir.

---

## D. NSIS Installer (Windows Kurulum)

### D1. Installer açılıyor ama "This app can't run on your PC"

**Sebep:** Windows 10 öncesi (Win 7/8/8.1) üzerinde çalıştırıldı.

**Çözüm:** `installer.nsh` preflight Win 10+ kontrolü yapıyor; Windows 7/8
üzerinde **açılışta** Türkçe mesajla iptal edilir. Eğer bu kontrol
atlanıyor gibi görünüyorsa NSIS include script'i paket içinde yok
demektir — `desktop/package.json build.nsis.include: build/installer.nsh`
kontrolünü yapın.

---

### D2. Kullanıcı "Admin yetkisi ister" diyor

**Sebep:** Eski release'lerde `perMachine: true` olabilir.

**Çözüm:** v2.7.0 `perMachine: false` (user-local install, admin istemez).
Kurulum dizini default: `%LOCALAPPDATA%\Programs\moonlight-owner-console`.

---

### D3. Masaüstü kısayolu oluşmuyor

**Sebep:** Kullanıcı kurulum sihirbazında "Desktop shortcut" kutusunu
kapatmış olabilir.

**Çözüm:** Varsayılan açık (`createDesktopShortcut: true`). İptal
edilmişse uninstall+reinstall ile geri alınır.

---

### D4. SmartScreen "Unknown publisher — prevented starting"

**Sebep:** Code-signing sertifikası yok.

**Çözüm (kullanıcı için, geçici):** `More info → Run anyway`.
**Çözüm (release için, kalıcı):**
1. EV Code Signing sertifikası alın (DigiCert / Sectigo / Certum).
2. Sertifika base64'ünü GitHub secrets'a `CSC_LINK` olarak ekleyin.
3. `CSC_KEY_PASSWORD` secret'ına parolayı ekleyin.
4. Workflow'da `CSC_IDENTITY_AUTO_DISCOVERY: 'false'` satırını kaldırın.

---

## E. Lokal Geliştirme

### E1. `yarn dev` çalışıyor ama backend'e `localhost:8001` bağlanamıyor

**Çözüm:** İlk açılışta backend spawn'ı 3-5 saniye sürüyor. Electron
ekranı "Backend starting…" loading state gösterir. 10 saniyede gelmezse
`desktop/main/backend-manager.ts` logları incele (`%APPDATA%\moonlight-owner-console\logs\backend.log`).

---

### E2. `yarn bundle:backend` → `esbuild not found`

**Çözüm:** Root `node_modules`'te esbuild olmalı (`/moonlight/node_modules/esbuild`).
```bash
cd /moonlight && yarn install
```
`bundle-backend.js` artık `require('esbuild')` fallback ile kendi içinde
düzgün hata mesajı veriyor.

---

### E3. Desktop vitest `os.tmpdir()` hatası

**Çözüm:** v2.7.0 öncesi testler `/tmp/...` hardcoded path kullanıyordu.
Şu an `os.tmpdir() + path.join` kullanıyor — Windows'ta `%TEMP%`, Linux'ta
`/tmp` otomatik resolve edilir.

---

## F. Genel Tavsiyeler

- **Her release'den önce:** `yarn typecheck && yarn test && yarn bundle:backend:prod`
  tam yeşil olmalı.
- **Tag'leme:** `git tag v2.7.0 && git push --tags` → workflow otomatik tetiklenir.
- **Re-run:** Hatalı bir step varsa `Actions → Re-run failed jobs`.
- **Manual release:** Tag yoksa `workflow_dispatch → publish_release=true`.
- **Debug log:** `workflow_dispatch → debug_mode=true` → detaylı
  electron-builder çıktısı.
