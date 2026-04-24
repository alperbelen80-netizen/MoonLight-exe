# 🚀 BUILD_NOW.md — v2.7.4 Deployment Talimatları

> **Durum:** `v2.7.3` GitHub Actions `windows-latest` runner'da hâlâ `4m 15s`'de fail
> oldu. Annotation: `step:11:359 — Argument of type 'string | string[]' is not
> assignable to parameter of type 'string'.`
>
> **Kök sebep:** `@types/express 5.0.5 → 5.1.x` minor bump'ında `Request.headers[key]`
> tipi sıkılaştı. GitHub runner yarn.lock olmadığı için (repo'da `??` untracked) her
> install'da farklı patch çekti.
>
> **Çözüm (v2.7.4):** TypeScript type erasure pattern + pin edilmiş `@types/express`
> + defensive header extraction. Lokal doğrulama **PASS** (tsc 0 hata, nest build OK).
>
> **Ama BU DEĞİŞİKLİKLER HENÜZ GITHUB'A PUSH EDİLMEDİ.** Git durumu:
> ```
>  M moonlight/backend/package.json
>  M moonlight/backend/src/runtime-flags/runtime-flags.module.ts
> ?? moonlight/backend/yarn.lock     (kritik)
> ?? moonlight/desktop/yarn.lock     (kritik)
> ?? moonlight/yarn.lock             (kritik)
> ```

---

## ⚡ Kullanıcı için 2 yol var

### Yol 1 — Emergent UI (önerilen, kolay)

1. Emergent UI'da projenizin üst çubuğunda **"Save to GitHub"** veya **"Push to GitHub"**
   butonunu bulun ve tıklayın.
2. Commit mesajı: `v2.7.4: TS type erasure fix for Windows runner`
3. Push tamamlanınca Emergent UI'da sahip olduğunuz "Deploy/Release" aksiyonunu
   tetikleyin veya aşağıdaki Yol 2'nin **sadece tag adımını** çalıştırın.

### Yol 2 — Manuel terminal (kesin kontrol)

```bash
cd /app
# Tüm değişiklikleri ekle (yarn.lock'lar dahil)
git add moonlight/backend/package.json
git add moonlight/backend/src/runtime-flags/runtime-flags.module.ts
git add moonlight/yarn.lock moonlight/backend/yarn.lock moonlight/desktop/yarn.lock

# Commit
git commit -m "v2.7.4: TS type erasure + @types/express pin + yarn.lock tracked"

# Tag bas (v2.7.3 cache'lenmiş; yeni tag fresh runner için zorunlu)
git tag v2.7.4

# Push (hem main branch hem yeni tag)
git push origin main --tags
```

---

## ⏳ Push sonrası (tag → GitHub Actions)

Tag push'tan **~3-5 saniye sonra** https://github.com/alperbelen80-netizen/MoonLight-exe/actions
sayfasında **yeni bir run** başlar:

- Run adı: `MoonLight Windows Installer Build #5` (veya +1)
- Tag: `v2.7.4`
- Tahmini süre: **12-18 dk** (native rebuild + NSIS dahil)

### Başarılı tamamlanınca:

1. GitHub → Releases sayfasına git: https://github.com/alperbelen80-netizen/MoonLight-exe/releases
2. `v2.7.4` release'i altında:
   - `MoonLight-Owner-2.7.4-win-x64.exe` (≈ 150-250 MB)
   - `MoonLight-Owner-2.7.4-win-x64.exe.sha256`
   - `latest.yml`
3. `.exe`'yi Windows PC'ne indir, **çift tıkla** → NSIS sihirbazı açılır
4. Windows 10+ kontrolü otomatik
5. Kurulum dizinini seç (default: `%LOCALAPPDATA%\Programs\moonlight-owner-console`)
6. Masaüstü + Başlat menüsü kısayolları oluşur
7. **Run after install** seçili ise uygulama otomatik başlar
8. İlk açılışta **Onboarding Wizard** tetiklenir → SSID/vault/flags yapılandır

---

## ❌ Eğer tekrar fail ederse

1. Actions sayfasında failed run'a tıkla → **Artifacts** sekmesi → `moonlight-build-logs-<run_id>`
   artifact'ini indir (14 gün retention, zipped).
2. `Failure summary` step annotation'ları asıl patlayan step ve mesajı gösterir.
3. Muhtemel sebepler + çözümleri: `moonlight/docs/TROUBLESHOOTING.md` (v2.7.3 rescue post-mortem dahil).

---

## 📊 Lokal doğrulama sonuçları (v2.7.4 öncesi)

| Check | Result |
|---|---|
| `yarn typecheck` (backend + desktop) | ✅ 0 hata |
| `yarn build:backend` (nest build) | ✅ 5.80s |
| `yarn bundle:backend:prod` | ✅ 5.24 MB (minified + integrity + metafile) |
| `yarn smoke:bundle` | ✅ backend 3s boot, healthz+sim+trinity 200 |
| `yarn dist:dir` (Linux arm64 local pack) | ✅ 17.8s, electron-builder 24.13.3 |
| Backend Jest kritik suite | ✅ 25/25 |
| Desktop Vitest | ✅ 17/17 |

---

## 🔐 Değişen dosyalar (v2.7.4 özet)

- `moonlight/backend/src/runtime-flags/runtime-flags.module.ts`
  - `@Req() req: Request` → `@Req() req: any` (4 kullanım)
  - Header extraction: `Array.isArray` + `typeof` check
  - `assertLoopback(req: any)`
  - Unused `Request` import kaldırıldı
- `moonlight/backend/package.json`
  - `@types/express`: `^5.0.5` → `5.0.5` (tam pin)
  - `@types/compression`: `^1.8.1` → `1.8.1` (tam pin)
  - Yeni: `@types/express-serve-static-core: 5.1.0` (tam pin)

---

## ✅ Başarı Kriterleri

- [x] Lokal tsc → 0 hata
- [x] Lokal nest build → SUCCESS
- [x] Lokal bundle:prod → 5.24 MB + integrity
- [x] Lokal smoke:bundle → PASS
- [x] Linux arm64 local pack → SUCCESS
- [ ] Push + tag bas (kullanıcı aksiyonu gerekli)
- [ ] GitHub Actions Windows run → SUCCESS
- [ ] `.exe` release'e düştü
- [ ] Kullanıcı PC'sinde kurulum + launch

Aksiyon sırada: **git push + git tag v2.7.4 + git push --tags**.
