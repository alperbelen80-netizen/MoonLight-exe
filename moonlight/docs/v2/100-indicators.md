# 100 Benzersiz Gösterge + 100 Çoklu Kullanım Şablonu
Bu liste **mutlak en iyi** iddiası taşımaz. Bu, büyük platformlarda ve teknik analiz eğitim kaynaklarında sık geçen çekirdek ailelerden seçilmiş, **yaygın, güçlü, dengeli ve pratik** bir çalışma setidir. Ayarlar **başlangıç ayarıdır**; enstrüman, volatilite ve zaman dilimine göre optimize edilmelidir.

## Hızlı kullanım kuralları
1. Aynı aileden 3-4 göstergeyi üst üste yığma. En temiz kurulum: **1 trend + 1 momentum + 1 volatilite + 1 hacim/struktur**.
2. Önce rejimi belirle:
   - ADX düşük / Choppiness yüksek: range veya mean reversion.
   - ADX yüksek / chop düşük: trend veya breakout.
3. Kısa vadede (1m-5m) EMA, VWAP, Supertrend, RSI/Stoch, RVOL daha pratiktir.
4. Orta vadede (15m-4H) EMA/SMA, MACD, ADX, ATR, Ichimoku, Donchian daha dengelidir.
5. Uzun vadede (4H-1D+) SMA 50/200, Ichimoku, Coppock, PMO, Volume Profile daha faydalıdır.
6. Stop için çoğu zaman fiyatın rastgele bir noktasını değil, **ATR** veya net yapı seviyesini kullan.
7. Breakout işlemlerinde **hacim teyidi** yoksa yarım kalma riski yüksektir.
8. Binary/fixed-time için tek göstergeyle kör işlem açma. En azından:
   - yön filtresi,
   - momentum filtresi,
   - oynaklık filtresi kullan.
9. Trend piyasasında fade işlemlerini azalt; range piyasasında breakout kovalamayı azalt.
10. Bu dosya eğitim/araştırma amaçlıdır; canlı kullanım öncesi test şarttır.

## Parametre ayarlama mantığı
- **Daha kısa periyot** = daha hızlı sinyal, daha çok gürültü.
- **Daha uzun periyot** = daha geç sinyal, daha az gürültü.
- **Daha yüksek multiplier / std dev** = daha az ama daha sert sinyal.
- **Daha düşük multiplier / std dev** = daha fazla ama daha kirli sinyal.

## Zaman dilimi kısa rehberi
- 1m–3m: scalp / fixed-time / mikro breakout
- 5m–15m: intraday trend ve pullback
- 30m–4H: swing girişleri
- 1D+: pozisyon ve rejim takibi

## 100 gösterge listesi

| # | Gösterge | Tür | Ne ölçer | Başlangıç ayarı | Uygun TF | Long/pozitif okuma | Short/negatif okuma | En iyi eşleşme |
|---:|---|---|---|---|---|---|---|---|
| 1 | SMA | Trend | Fiyatın basit ortalaması; rejim ve dinamik destek/direnç | 20 / 50 / 200 | 15m–1D | Fiyat SMA üstü ve SMA yukarı eğimli | Fiyat SMA altı ve SMA aşağı eğimli | EMA, RSI, ADX |
| 2 | EMA | Trend | Son fiyatlara daha fazla ağırlık verir; daha hızlı trend takibi | 9 / 21 / 50 | 5m–1D | Hızlı EMA yavaş EMA üstüne geçer | Hızlı EMA yavaş EMA altına iner | MACD, ATR, VWAP |
| 3 | WMA | Trend | Yakın barları daha fazla ağırlıklandıran ortalama | 20 | 5m–4H | WMA yukarı kırılır | WMA aşağı kırılır | RSI, CCI |
| 4 | VWMA | Trend+Volume | Hacim ağırlıklı ortalama; hacimli trendi daha iyi gösterir | 20 | 5m–1D | Fiyat VWMA üstü ve hacim artıyor | Fiyat VWMA altı ve hacim zayıf | OBV, CMF |
| 5 | HMA | Trend | Düşük gecikmeli ortalama; kısa-orta vade trend | 21 / 55 | 3m–4H | HMA yukarı dönüp fiyat üstte kalır | HMA aşağı dönüp fiyat altta kalır | ADX, RSI |
| 6 | KAMA | Adaptive Trend | Volatiliteye uyumlu hareketli ortalama | 10,2,30 | 15m–1D | KAMA yukarı ve fiyat üstte | KAMA aşağı ve fiyat altta | ATR, ADX |
| 7 | T3 | Trend | Üçlü yumuşatma ile daha pürüzsüz trend çizgisi | 5 veya 8 | 5m–4H | T3 yukarı eğimli ve fiyat üstte | T3 aşağı eğimli ve fiyat altta | MACD, ATR |
| 8 | DEMA | Trend | Çift EMA; EMA’dan daha hızlı tepki | 20 | 5m–4H | DEMA yukarı kırılım | DEMA aşağı kırılım | RSI, ADX |
| 9 | TEMA | Trend | Üçlü EMA; kısa swing ve momentum takibi | 20 | 5m–4H | TEMA yukarı kıvrılır | TEMA aşağı kıvrılır | MACD, ROC |
| 10 | TRIMA | Trend | Üçgensel ortalama; daha yumuşak yapı | 20 | 15m–1D | Fiyat TRIMA üstü ve eğim pozitif | Fiyat TRIMA altı ve eğim negatif | ATR, RSI |
| 11 | ZLEMA | Trend | Lag azaltılmış EMA | 20 | 3m–4H | ZLEMA yukarı dönüyor | ZLEMA aşağı dönüyor | ADX, CMO |
| 12 | McGinley Dynamic | Adaptive Trend | Piyasa hızına uyumlu ortalama | 14 | 15m–1D | McGinley üstünde kapanışlar | McGinley altında kapanışlar | ATR, RSI |
| 13 | Bollinger Bands | Volatility | 20 SMA etrafında standart sapma bantları | 20,2 | 5m–1D | Band orta çizgi üstü güçlü yürüyüş | Orta çizgi altı zayıflama | RSI, BandWidth |
| 14 | Bollinger %B | Volatility | Fiyatın band içindeki konumunu verir | 20,2 | 5m–1D | %B > 0.8 trend/rally teyidi | %B < 0.2 zayıflık | BandWidth, RSI |
| 15 | Bollinger BandWidth | Volatility | Band genişliği; sıkışma/patlama tespiti | 20,2 | 5m–1D | Düşükten yukarı açılıyorsa breakout riski | Yüksekten daralıyorsa momentum sönüyor | Keltner, RSI |
| 16 | Keltner Channel | Volatility+Trend | EMA etrafında ATR tabanlı kanal | 20 EMA, 2 ATR | 5m–1D | Üst kanal üstü trend devamı | Alt kanal altı düşüş devamı | ATR, Squeeze |
| 17 | Donchian Channel | Breakout | n bar en yüksek/en düşük bandı | 20 | 5m–1D | Üst band kırılımı | Alt band kırılımı | ADX, Volume |
| 18 | ATR Bands | Volatility | Fiyat etrafında ATR ofsetli bant | ATR 5, shift 3% | 5m–4H | Band üstü genişleme | Band altı zayıflık | ATR, EMA |
| 19 | STARC Bands | Volatility | SMA + ATR bazlı bant | MA 5, ATR 15, shift 1.3 | 5m–4H | Alt bant tepki alımı / üst bant taşma | Üst banttan reddedilme / alt bant kaybı | RSI, CCI |
| 20 | Moving Average Envelope | Trend Envelope | MA etrafında yüzde ofset band | 20, %2–5 | 15m–1D | Üst banda taşma güçlü trend | Alt banda taşma zayıflık | ATR, RSI |
| 21 | Supertrend | Trend | ATR çarpanı ile trend çizgisi | ATR 10, Mult 3 | 5m–4H | Çizgi fiyat altına geçer | Çizgi fiyat üstüne geçer | RSI, ADX |
| 22 | Parabolic SAR | Trend/Stop | Trend yönü ve takip stopu | 0.02,0.2 | 5m–1D | SAR noktaları fiyat altına geçer | SAR noktaları fiyat üstüne geçer | ADX, EMA |
| 23 | Ichimoku Cloud | All-in-one | Trend, momentum, S/R tek yapıda | 9,26,52 | 15m–1D | Fiyat bulut üstü, Tenkan>Kijun | Fiyat bulut altı, Tenkan<Kijun | ADX, Volume |
| 24 | Alligator | Trend | Bill Williams çoklu smoothed MA sistemi | 13,8,5 | 5m–4H | Çeneler açılıyor ve fiyat yukarı | Çeneler aşağı açılıyor | Fractals, AO |
| 25 | Fractals | Structure | Yerel swing high/low işaretler | 5 bar | 3m–1D | Yukarı fractal kırılımı | Aşağı fractal kırılımı | Alligator, ATR |
| 26 | ZigZag | Structure | Gürültüyü filtreleyip ana swingleri çıkarır | %5–10 veya ATR tabanlı | 15m–1D | Yüksek-dip yapısı netleşir | Düşük-tepe yapısı netleşir | Fibo, RSI |
| 27 | Aroon | Trend Age | Trendin ne kadar yeni/eski olduğunu ölçer | 14 veya 25 | 15m–1D | Aroon Up yüksek, Down düşük | Aroon Down yüksek, Up düşük | ADX, Donchian |
| 28 | Aroon Oscillator | Trend Momentum | Aroon Up-Down farkı | 14 veya 25 | 15m–1D | Pozitif bölgede güçlenme | Negatif bölgede güçlenme | ADX, RSI |
| 29 | ADX | Trend Strength | Trend gücü; yön vermez | 14 | 5m–1D | 25 üstü güçlü trend rejimi | 20 altı yatay/range rejimi | +DI/-DI, EMA |
| 30 | DMI (+DI/-DI) | Trend Direction | Yönlü hareketin tarafını ölçer | 14 | 5m–1D | +DI > -DI ve ADX yükseliyor | -DI > +DI ve ADX yükseliyor | ADX, EMA |
| 31 | Vortex Indicator | Trend | Pozitif/negatif girdap çizgileriyle trend | 14 | 15m–1D | VI+ > VI- | VI- > VI+ | ADX, ATR |
| 32 | Choppiness Index | Regime | Trend mi range mi ayrımı | 14 | 5m–1D | Düşük chop = trend oluşuyor | Yüksek chop = range/karmaşa | Donchian, RSI |
| 33 | RAVI | Trend Filter | Hızlı-yavaş MA farkıyla trend filtresi | 7,65 | 15m–1D | Pozitif geniş fark trend teyidi | Negatif geniş fark düşüş teyidi | EMA, ADX |
| 34 | RSI | Momentum | Aşırı alım/satım ve momentum | 14; 70/30 | 3m–1D | 50 üstü momentum ve 30-50’den dönüş | 50 altı momentum ve 70-50’den düşüş | EMA, BB |
| 35 | Stochastic | Momentum | Kapanışın son aralıktaki konumu | 14,3,3; 80/20 | 3m–4H | %K>%D ve 20 üstüne dönüş | %K<%D ve 80 altına dönüş | MACD, BB |
| 36 | Stochastic RSI | Momentum | RSI’ın stokastiği; çok hızlı osilatör | 14,14,3,3 | 1m–1H | Aşırı satımdan hızlı dönüyorsa | Aşırı alımdan aşağı dönüyorsa | EMA, ADX |
| 37 | MACD | Momentum+Trend | EMA farkı ve sinyal çizgisi | 12,26,9 | 5m–1D | MACD>Signal ve histogram büyüyor | MACD<Signal ve histogram küçülüyor | EMA, RSI |
| 38 | PPO | Momentum | MACD’nin yüzde versiyonu; çapraz varlıklarda iyi | 12,26,9 | 15m–1D | Sıfır üstü ivme artışı | Sıfır altı zayıflama | ADX, EMA |
| 39 | PVO | Volume Momentum | Hacmin yüzde MACD’si | 12,26,9 | 5m–1D | PVO yükselirken breakout daha güçlü | PVO düşüyorsa hareket zayıf | OBV, Donchian |
| 40 | TRIX | Momentum | Üçlü EMA değişim oranı | 15,9 | 5m–1D | Sıfır üstü kesişim | Sıfır altı kesişim | TEMA, ADX |
| 41 | TSI | Momentum | Çift yumuşatılmış momentum | 25,13,7 | 15m–1D | Sinyal yukarı kesişimi | Sinyal aşağı kesişimi | EMA, RSI |
| 42 | ROC | Momentum | Fiyat değişim oranı | 12 | 3m–1D | Pozitif ivme artışı | Negatif ivme artışı | MACD, Volume |
| 43 | Momentum | Momentum | Basit fiyat farkı momentumu | 10 | 3m–4H | Sıfır üstüne geçiş | Sıfır altına geçiş | RSI, EMA |
| 44 | CCI | Momentum/Mean Rev | Tipik fiyattan sapma | 20; ±100/±200 | 3m–1D | -100 üstüne dönüş / +100 üstü trend | +100 altına iniş / -100 altı zayıflık | Keltner, EMA |
| 45 | Williams %R | Momentum | Aralık içi kapanış konumu | 14; -20/-80 | 3m–4H | -80’den yukarı dönüş | -20’den aşağı dönüş | BB, RSI |
| 46 | Ultimate Oscillator | Momentum | 3 periyotlu ağırlıklı momentum | 7,14,28 | 15m–1D | Pozitif divergence + yukarı dönüş | Negatif divergence + aşağı dönüş | Volume, EMA |
| 47 | MFI | Momentum+Volume | Fiyat+hacim bazlı RSI benzeri yapı | 14; 80/20 | 5m–1D | 20 altından yukarı dönüş | 80 üstünden aşağı dönüş | CMF, VWAP |
| 48 | CMF | Volume Flow | Alım-satım baskısını ölçer | 21 | 5m–1D | 0 üstü birikim | 0 altı dağıtım | VWAP, EMA |
| 49 | Chaikin Oscillator | Volume Momentum | A/D çizgisinin momentum versiyonu | 3,10 | 5m–1D | 0 üstü ivme | 0 altı zayıflık | CMF, OBV |
| 50 | OBV | Volume | Hacimle fiyat yönünü birleştirir | Klasik | 5m–1D | OBV yeni zirve yapıyorsa teyit | OBV yeni dip yapıyorsa teyit | Breakout, EMA |
| 51 | Accumulation/Distribution | Volume | Para akışı birikim/dağıtım | Klasik | 5m–1D | Yukarı eğimli A/D | Aşağı eğimli A/D | CMF, Chaikin Osc |
| 52 | Volume Oscillator | Volume | Kısa-uzun hacim ortalaması farkı | 5,10 veya 14,28 | 5m–1D | Pozitif hacim ivmesi | Negatif hacim ivmesi | Breakout, VWAP |
| 53 | Klinger Oscillator | Volume | Uzun-kısa hacim akışı momentumu | 34,55,13 | 15m–1D | Yukarı sinyal kesişimi | Aşağı sinyal kesişimi | CMF, EMA |
| 54 | Ease of Movement | Volume | Fiyatın hacim karşısında ne kadar kolay ilerlediği | 14 | 15m–1D | Pozitif ve yükselen EOM | Negatif ve düşen EOM | Volume, BB |
| 55 | Force Index | Volume+Momentum | Fiyat değişimi x hacim | 13 | 5m–1D | 0 üstüne geçiş ve trend yönü aynı | 0 altına geçiş | EMA, ADX |
| 56 | Elder Ray Bull/Bear Power | Trend+Momentum | EMA’ya göre boğa/ayı gücü | EMA 13 | 5m–1D | Bull Power pozitifleşir | Bear Power negatifleşir | Elder Impulse, EMA |
| 57 | NVI | Volume Regime | Düşük hacim günlerinde akıllı para izi | 255 EMA ile | 1H–1D | NVI EMA üstü | NVI EMA altı | PVI, MA |
| 58 | PVI | Volume Regime | Yüksek hacim günlerindeki katılımı izler | 255 EMA ile | 1H–1D | PVI EMA üstü güç | PVI EMA altı zayıflık | NVI, MA |
| 59 | VWAP | Execution/Trend | Seans içi hacim ağırlıklı ortalama fiyat | Seanslık | 1m–15m | Fiyat VWAP üstü ve retest tutuyor | Fiyat VWAP altı ve retest reddediliyor | RVOL, CMF |
| 60 | Anchored VWAP | Structure | Belirli olay/swing’den beri ağırlıklı ortalama | Swing/earnings/open anchor | 1m–1D | Fiyat anchored VWAP üstüne yerleşir | Altına kayar | Volume Profile, RSI |
| 61 | Volume Profile | Structure+Volume | Hacmin hangi fiyatlarda yoğunlaştığını gösterir | Session veya fixed range | 1m–1D | VAL/POC üstü kabul | VAH altı reddedilme | VWAP, Delta |
| 62 | Pivot Points | Structure | Gün içi S/R seviyeleri | Classic veya Fibonacci | 1m–1H | Pivot üstü kabul | Pivot altı kabul | VWAP, RSI |
| 63 | Fibonacci Retracement | Structure | Swing geri çekilme bölgeleri | 0.382/0.5/0.618 | 3m–1D | Yukarı trendde 0.5-0.618 savunulur | Aşağı trendde 0.5-0.618 reddedilir | ZigZag, RSI |
| 64 | Relative Volume (RVOL) | Volume | Mevcut hacmin ortalamaya oranı | 20 | 1m–1D | 1.5x+ breakout teyidi | 0.8x altı hareket zayıf | VWAP, Donchian |
| 65 | Cumulative Delta | Orderflow Proxy | Alıcı/satıcı agresyon farkı | Platforma bağlı | 1m–1H | Delta fiyatla birlikte yükselir | Delta düşerken fiyat zayıflar | VWAP, Profile |
| 66 | ATR | Volatility | Ortalama gerçek aralık; stop/pozisyon | 14 | 3m–1D | Yüksek ATR = geniş stop gerekir | Düşük ATR = sıkışma | Supertrend, Keltner |
| 67 | NATR | Volatility | ATR’nin fiyatın yüzdesi hali | 14 | 5m–1D | Yüksek NATR = oynak piyasa | Düşük NATR = sıkışma | ATR, BB |
| 68 | Historical Volatility | Volatility | Geçmiş getirilerden oynaklık | 20 | 15m–1D | HV yükselişi breakout öncesi/sonrası | HV düşüşü compression | BandWidth, ATR |
| 69 | Standard Deviation | Volatility | Fiyat dağılımının yayılımı | 20 | 5m–1D | StdDev artıyorsa hareket sertleşiyor | Düşüyorsa sakinleşme | BB, HV |
| 70 | Chaikin Volatility | Volatility | Yüksek-düşük aralığı volatilitesi | 10,10 | 5m–1D | Ani sıçrama = patlama riski | Gerileme = sönüm | MFI, Keltner |
| 71 | Mass Index | Reversal/Volatility | Aralık genişleyip trend dönüş riski | 25,9 | 15m–1D | Bulge sonrası yukarı teyit aranır | Bulge sonrası aşağı teyit aranır | EMA, RSI |
| 72 | Ulcer Index | Risk/Volatility | Drawdown şiddeti | 14 | 1H–1D | Düşük UI = daha temiz trend | Yüksek UI = riskli yapı | MA, ATR |
| 73 | Relative Volatility Index | Volatility Momentum | Volatilitenin yönlü gücü | 14 | 15m–1D | 50 üstü volatilite lehine | 50 altı volatilite aleyhine | ATR, ADX |
| 74 | DPO | Cycle | Trendi çıkarıp döngüyü öne alır | 14 | 15m–1D | Dipten yukarı salınım | Tepeden aşağı salınım | Cycle tools, RSI |
| 75 | SMI | Momentum | Stochastic’in daha yumuşak versiyonu | 14,3,3 | 3m–4H | Aşırı satımdan yukarı dönüş | Aşırı alımdan aşağı dönüş | EMA, MACD |
| 76 | CMO | Momentum | Yukarı-aşağı momentum farkı | 14 | 3m–1D | 0 üstüne güçlenme | 0 altına zayıflama | EMA, ATR |
| 77 | DeMarker | Momentum | Son zirve/dip karşılaştırmalı osilatör | 14 | 3m–1D | 0.3 altından dönüş | 0.7 üstünden düşüş | BB, MA |
| 78 | Awesome Oscillator | Momentum | Median price tabanlı momentum | 5,34 | 3m–1D | Sıfır üstü veya twin peaks bullish | Sıfır altı veya bearish twin peaks | Alligator, Fractals |
| 79 | Accelerator Oscillator | Momentum | AO’nun ivmesini ölçer | Klasik | 3m–1D | Pozitife erken geçiş | Negatife erken geçiş | AO, Alligator |
| 80 | Fisher Transform | Reversal | Fiyatı uç değerlere hassaslaştırır | 10 | 3m–1D | Aşağı uçtan yukarı dönüyorsa | Yukarı uçtan aşağı dönüyorsa | RSI, DPO |
| 81 | Coppock Curve | Longer Momentum | Uzun vadeli toparlanma momentumu | 11,14,10 | 4H–1W | Sıfır altından yukarı kıvrım | Sıfır üstünden aşağı kıvrım | MA, Volume |
| 82 | PMO | Momentum | Fiyat momentumunun yumuşatılmış versiyonu | 35,20,10 | 15m–1D | Sinyal üstü yükseliş | Sinyal altı düşüş | MA, RSI |
| 83 | Schaff Trend Cycle | Trend+Momentum | MACD + cycle hibrit hızlı trend osilatörü | 23,50,10 | 5m–1D | 25 üstüne güçlü geçiş | 75 altına düşüş | EMA, ADX |
| 84 | Connors RSI | Short-term MR | Kısa vade aşırılaşma tespiti | 3,2,100 | 1m–1H | Aşırı satım rebound | Aşırı alım fade | VWAP, BB |
| 85 | KST | Momentum | Çoklu ROC birikimi | 10,15,20,30 / 10,10,10,15 / 9 | 15m–1D | Sinyal yukarı kesişimi | Sinyal aşağı kesişimi | MA, Volume |
| 86 | Elder Impulse System | Trend+Momentum | EMA ve MACD histogram renk rejimi | EMA 13 + MACD 12,26,9 | 5m–1D | Yeşil rejim | Kırmızı rejim | Force Index, EMA |
| 87 | Qstick | Candlestick Bias | Açılış-kapanış bias ortalaması | 8 veya 14 | 5m–1D | 0 üstü alıcı ağırlık | 0 altı satıcı ağırlık | Volume, RSI |
| 88 | RMI | Momentum | RSI’ın momentum mesafeli versiyonu | 20,5 | 5m–1D | 50 üstüne geçiş | 50 altına geçiş | EMA, BB |
| 89 | Balance of Power | Momentum | Boğa-ayı kontrol dengesini ölçer | 14 | 5m–1D | Pozitif bölgeye geçiş | Negatif bölgeye geçiş | Volume, MA |
| 90 | Market Facilitation Index | Volume/Range | Aralık başına hacim verimliliği | Klasik | 1m–1H | Green pattern = güçlü devam | Fade pattern = dikkat | Volume, AO |
| 91 | Gator Oscillator | Trend | Alligator çizgileri arasındaki ayrışma | Klasik | 3m–4H | Barlar büyüyor = trend uyanıyor | Barlar küçülüyor = trend uyuyor | Alligator, AO |
| 92 | Chande Kroll Stop | Stop/Trend | ATR tabanlı takip stop sistemi | 10,20,1 | 5m–1D | Üst stop üstüne geçiş | Alt stop altına iniş | EMA, ADX |
| 93 | KDJ | Momentum | Stochastic + J çizgisi | 9,3,3 | 1m–4H | J dipten sıçrıyor | J tepeden dönüyor | EMA, BB |
| 94 | Squeeze Momentum | Volatility Breakout | BB ve KC sıkışma patlaması | BB 20,2 / KC 20,1.5 | 1m–4H | Sıkışma sonrası histogram pozitife geçer | Sıkışma sonrası negatife geçer | ADX, Volume |
| 95 | Linear Regression Slope | Trend | Regresyon eğimi ile yön/ivme | 20 | 5m–1D | Eğim pozitife dönüyor | Eğim negatife dönüyor | R2, MA |
| 96 | Linear Regression Intercept/Forecast | Trend | Regresyon projeksiyon tabanı | 20 | 15m–1D | Fiyat tahmin çizgisi üstünde | Altında | Slope, RSI |
| 97 | Time Series Forecast | Trend | Regresyon temelli tahmini çizgi | 14 | 15m–1D | TSF yukarı ve fiyat destek alıyor | TSF aşağı ve fiyat reddediliyor | MA, ATR |
| 98 | Regression R-Squared | Trend Quality | Trendin doğrusal temizliğini ölçer | 20 | 15m–1D | Yüksek R2 = temiz trend | Düşük R2 = gürültülü piyasa | Slope, ADX |
| 99 | Typical Price | Price Transform | (H+L+C)/3 tabanı; birçok indikatörün çekirdeği | Klasik | Her TF | Tek başına sinyal değil; filtre tabanı | Tek başına sinyal değil | CCI, MFI |
| 100 | Weighted Close | Price Transform | (H+L+2C)/4; kapanışı ağırlıklar | Klasik | Her TF | Tek başına değil; daha iyi input kaynağı | Tek başına değil | VWAP, EMA |

## 100 gösterge için kullanım kılavuzu – ortak mantık
1. **Trend göstergeleri**: yönü ve rejimi verir. Tek başına giriş için değil, zemin için kullan.
2. **Momentum osilatörleri**: giriş zamanlaması verir. Trendin tersine her aşırılığı işlem sayma.
3. **Volatilite göstergeleri**: stop, hedef ve breakout kalitesini belirler.
4. **Hacim göstergeleri**: hareketin arkasında gerçek katılım var mı yok mu onu gösterir.
5. **Yapı/seviye araçları**: nerede işlem açılacağını, nerede işlem açılmayacağını belirler.
6. Aynı işlevi yapan göstergeleri yığma örnekleri:
   - RSI + Stoch + Williams %R aynı anda fazla.
   - EMA + SMA + WMA + TRIMA aynı anda fazla.
   - ATR + NATR + Historical Vol hepsi aynı anda gereksiz olabilir.
7. En temiz çalışma akışı:
   - Adım 1: Rejim = ADX / Chop / R2
   - Adım 2: Yön = EMA / SMA / Ichimoku / Supertrend
   - Adım 3: Zamanlama = RSI / Stoch / MACD / CCI
   - Adım 4: Onay = OBV / CMF / RVOL / VWAP
   - Adım 5: Stop = ATR / swing high-low / VWAP / Kijun / kanal sınırı
8. Çok kısa vadede:
   - giriş için EMA, VWAP, Supertrend
   - tetik için RSI, Stoch, Stoch RSI
   - filtre için ADX, RVOL, ATR
9. Range piyasasında:
   - BB, Stoch, RSI, Williams %R, DeMarker, Connors RSI daha iyi çalışır.
10. Trend piyasasında:
   - EMA, SMA, MACD, ADX, Supertrend, Ichimoku, Donchian daha iyi çalışır.

## 100 çoklu kullanım şablonu

| # | Şablon | Kullanım alanı | Bileşenler | Uygun TF | Giriş mantığı | Çıkış / iptal |
|---:|---|---|---|---|---|---|
| 1 | EMA Trend Pullback | Net trend devamı | EMA 21 + EMA 50 + RSI 14 + ATR 14 | 5m–4H | EMA21>EMA50, geri çekilmede RSI 40-50 desteği, trend yönünde kapanış | ATR x1.5 stop; EMA21 alt/üst kapanışta çık |
| 2 | SMA Regime Swing | Orta vade swing | SMA 50 + SMA 200 + MACD 12,26,9 | 1H–1D | 50>200 ve MACD pozitif kesişim | 50 SMA kaybı veya MACD negatif |
| 3 | Supertrend Confirmation | Kısa-orta vade trend | Supertrend 10,3 + ADX 14 + RSI 14 | 3m–4H | Supertrend flip + ADX>25 + RSI 50 üstü | Supertrend ters flip |
| 4 | Ichimoku Trend Ride | Güçlü trend piyasası | Ichimoku 9,26,52 + ATR 14 | 15m–1D | Fiyat bulut üstü, Tenkan>Kijun, geri çekilme Kijun’da tutunur | Bulut içine dönüş |
| 5 | Donchian Trend Break | Trend devam breakout | Donchian 20 + ADX 14 + RVOL 20 | 5m–4H | 20-bar üst band kırılır, ADX yükselir, RVOL>1.5 | Kanal içine geri dönüş |
| 6 | Alligator Fractal Go | Bill Williams trend | Alligator + Fractals + AO | 3m–4H | Alligator ağzı açılır ve fractal kırılır, AO yönü teyit eder | Karşı fractal veya alligator daralma |
| 7 | KAMA Clean Trend | Gürültülü piyasada temiz trend | KAMA 10,2,30 + ADX 14 | 15m–1D | Fiyat KAMA üstünde ve ADX artıyor | KAMA altına net kapanış |
| 8 | HMA Fast Swing | Daha hızlı swing | HMA 21 + CMO 14 + ATR 14 | 3m–1H | HMA yön değişimi + CMO sıfır üstü | HMA ters kıvrım |
| 9 | VWMA Volume Trend | Hacim destekli trend | VWMA 20 + OBV + RSI 14 | 5m–4H | Fiyat VWMA üstü, OBV yeni zirve, RSI 50+ | VWMA altı kapanış |
| 10 | T3 Smooth Continuation | Yumuşak trend | T3 8 + MACD + ATR | 5m–4H | T3 yukarı, MACD pozitif, ATR aşırı şişkin değil | T3 altı kapanış |
| 11 | DEMA Momentum Carry | Hızlı taşıma | DEMA 20 + ROC 12 + RVOL | 3m–1H | DEMA üstü momentum artışı, ROC pozitif, RVOL yüksek | ROC negatife döner |
| 12 | TEMA Trend Burst | Kısa trend patlaması | TEMA 20 + PPO 12,26,9 | 3m–1H | TEMA yukarı ve PPO sıfır üstüne geçer | TEMA aşağı kıvrılır |
| 13 | McGinley Position Trend | Daha sabırlı trend | McGinley 14 + ADX 14 + Volume MA | 15m–1D | McGinley üstünde kalıcılık ve ADX>20 | McGinley altı iki kapanış |
| 14 | Vortex Trend Filter | Trend yön teyidi | Vortex 14 + EMA 50 | 15m–1D | VI+>VI- ve fiyat EMA50 üstü | VI çizgileri ters döner |
| 15 | Aroon Fresh Trend | Yeni başlayan trend | Aroon 25 + EMA 21 | 15m–1D | Aroon Up yüksek, Down düşük, EMA eğimi pozitif | Aroon ters döner |
| 16 | RAVI Expansion Trend | Range’den trende geçiş | RAVI 7,65 + Donchian 20 | 15m–1D | RAVI eşik üstü ve kanal kırılımı | Kanal içine geri dönüş |
| 17 | Regression Trend Quality | Temiz trend seçimi | LinReg Slope 20 + R-Squared 20 + EMA 50 | 15m–1D | Slope pozitif ve R2 yüksek, fiyat EMA üstü | R2 düşer + slope ters |
| 18 | Elder Impulse Follow | Renk rejimi takibi | Elder Impulse + EMA13 + Force Index | 5m–4H | Yeşil rejim ve Force Index pozitif | Renk nötr/kırmızıya döner |
| 19 | PMO Trend Follow | Daha yumuşak momentum trendi | PMO + SMA 50 | 15m–1D | PMO sinyal üstü, fiyat SMA50 üstü | PMO sinyal altı |
| 20 | Schaff Trend Cycle Follow | Hızlı trend döngüsü | STC + EMA 21 | 5m–4H | STC 25 üstüne çıkar ve fiyat EMA üstünde | STC 75 altına sert iner |
| 21 | Bollinger Squeeze Break | Volatilite patlaması | BB 20,2 + BandWidth + RVOL | 1m–1H | BandWidth dipten açılıyor, bant dışı kapanış ve RVOL teyidi | Band içine hızlı geri dönüş |
| 22 | TTM Squeeze Release | Sıkışma sonrası yön | Squeeze Momentum + ADX + Volume | 1m–4H | Squeeze biter, histogram yönlü büyür, ADX artar | Histogram yön değiştirir |
| 23 | Keltner Expansion | ATR bazlı genişleme | KC 20,2 + ATR 14 + MACD | 3m–4H | Keltner dışı kapanış + MACD aynı yön | Orta banda geri dönüş |
| 24 | Donchian + OBV Break | Saf breakout | Donchian 20 + OBV + ADX | 5m–4H | Kanal kırılır, OBV teyit eder, ADX yükselir | Kanal içine kapanış |
| 25 | Pivot Break Day Trade | Gün içi seviye kırılımı | Pivot Points + VWAP + RVOL | 1m–15m | Pivot/R1/R2 kırılımı, fiyat VWAP üstü, RVOL yüksek | VWAP altına dönüş |
| 26 | VWAP Opening Drive | Açılış trend sürüşü | VWAP + RVOL + MACD | 1m–5m | Açılışta VWAP üstü kabul ve RVOL yüksek | VWAP altına sert dönüş |
| 27 | Anchored VWAP Event Break | Haber/swing sonrası | Anchored VWAP + ATR + CMF | 1m–1H | Anchor üstü kabul ve CMF pozitif | Anchor altına dönüş |
| 28 | Volume Profile Acceptance | Value area breakout | Volume Profile + VWAP + Delta | 1m–30m | VAH/VAL dışına kabul ve delta aynı yön | POC içine geri dönüş |
| 29 | Supertrend Break Carry | Breakout + trailing | Supertrend + RVOL + ATR | 3m–1H | Breakout sonrası Supertrend long/short aynı yönde | Supertrend flip |
| 30 | ATR Bands Expansion | ATR kanalı patlaması | ATR Bands + RSI + Volume | 3m–1H | Band dışı kapanış + RSI 50/50 aynı yön | Band içine geri çekilme |
| 31 | STARC Extreme Break | Aşırı genişleme sonrası devam | STARC + ADX | 5m–1H | Bant dışı kalıcılık ve ADX artışı | Bant içine dönüş |
| 32 | Ichimoku Kumo Break | Bulut kırılımı | Ichimoku + Chikou teyidi | 15m–1D | Bulut kırılır ve Chikou boş alanda | Bulut içine geri giriş |
| 33 | Fractal Range Escape | Dar banttan çıkış | Fractals + Alligator + ATR | 3m–1H | Son fractal kırılır ve ATR genişler | Karşı fractal |
| 34 | Aroon Breakout Filter | Erken trend kırılımı | Aroon Osc + Donchian | 15m–1D | Kanal kırılımı ile osc pozitife/negatife sert geçer | Osc geri söner |
| 35 | PVO Breakout Volume | Hacim destekli patlama | PVO + Donchian + EMA21 | 5m–4H | PVO pozitif artış + kanal kırılımı + EMA21 yönü | EMA21 altına dönüş |
| 36 | Mass Index Reversal Break | Volatilite şişmesi sonrası yön | Mass Index + EMA 20 | 15m–1D | Bulge sonrası EMA kırılım yönünde gir | EMA içine dönüş |
| 37 | HV Expansion Follow | Volatilite genişleme takibi | Historical Vol + BB + MACD | 5m–4H | HV ve BB genişliyor, MACD aynı yön | HV sönmeye başlar |
| 38 | Standard Deviation Burst | İstatistiksel patlama | StdDev 20 + EMA 20 + Volume | 5m–1H | StdDev dipten yükselir, EMA kırılır, hacim gelir | EMA alt/üst geri dönüş |
| 39 | Klinger Breakout | Hacim akışlı breakout | Klinger + Donchian + ADX | 15m–1D | Klinger yukarı, kanal kırılımı, ADX yükselişi | Klinger ters kesişim |
| 40 | Chaikin Osc Break | Dağılım/birikimden kopuş | Chaikin Osc + A/D + EMA | 5m–4H | Osc 0 üstü ve fiyat EMA üstü | Osc 0 altı |
| 41 | RSI Band Fade | Range içinde geri dönüş | RSI 14 + BB 20,2 | 1m–4H | Band dışı taşma + RSI aşırı satım/alımdan dönüyor | Orta band hedef; band devamında stop |
| 42 | Stoch Range Reversal | Klasik range dönüşü | Stoch 14,3,3 + Support/Resistance | 1m–4H | 20 altından yukarı / 80 üstünden aşağı | Seviye kırılırsa iptal |
| 43 | CCI Pullback Reversion | Trend içi geri çekilme | CCI 20 + EMA 50 | 3m–1D | Trend yönünde CCI -100/+100’den dönüyor | EMA50 kırılırsa |
| 44 | Williams %R Snapback | Hızlı geri tepme | Williams %R 14 + VWAP | 1m–1H | -80/-20 aşırılığından VWAP’a dönüş | VWAP’a dönemiyorsa çık |
| 45 | Connors RSI Quick Fade | Çok kısa vade aşırılaşma | Connors RSI + VWAP + ATR | 1m–15m | Aşırı değer + fiyat VWAP’tan çok uzak | VWAP dokunuşu / ATR stop |
| 46 | DeMarker Rebound | Aşırılaşma tepki işlemi | DeMarker 14 + BB | 3m–4H | 0.3 altından yukarı / 0.7 üstünden aşağı | Band içine dönüş hedef |
| 47 | SMI Reversal | Daha temiz stokastik dönüş | SMI + EMA 21 | 3m–4H | EMA çevresinde SMI dip/tepe dönüşü | EMA kırılırsa |
| 48 | MFI Exhaustion | Hacimli aşırılaşma dönüşü | MFI 14 + BB + Volume | 5m–4H | 80/20 aşırılığı ve hacim sönmesi | Band walk başlarsa çık |
| 49 | RSI 2 Mean Reversion | Çok kısa reversion | RSI 2 + SMA 200 | 1m–1H | Ana trend yönünde RSI2 uçta iken dönüş | SMA200 karşı tarafı geçilirse |
| 50 | Fisher Snap Turn | Dönüş arayan piyasa | Fisher 10 + Support/Resistance | 3m–1D | Uç bölgede Fisher dönüşü + seviye | Seviye kırılırsa |
| 51 | DPO Cycle Revert | Döngüsel range | DPO 14 + range sınırları | 15m–1D | DPO dipte ve alt sınırda | Range kırılımında iptal |
| 52 | Qstick Candle Mean Rev | Mum bias dönüşü | Qstick 8 + BB | 5m–4H | Qstick uçtan merkeze dönüyor | Merkeze dönemiyorsa çık |
| 53 | RMI Pullback | Yumuşak momentum geri dönüşü | RMI 20,5 + EMA 50 | 5m–1D | Trend yönünde RMI 30-40 bölgesinden dönüyor | EMA kırılırsa |
| 54 | Balance of Power Fade | Mikro güç dengesi | BOP + VWAP | 1m–30m | BOP aşırılığı zayıflarken VWAP dönüşü | VWAP’ta başarısızlık |
| 55 | KDJ Fast Reversal | Çok hızlı osilatör dönüşü | KDJ 9,3,3 + BB | 1m–15m | J çizgisi uçtan geri dönüyor | J uçta kalırsa çık |
| 56 | Ultimate Osc Divergence | Divergence dönüşü | Ultimate Osc + price structure | 15m–1D | Pozitif/negatif divergence + yapı kırılımı | Yapı kırılmazsa iptal |
| 57 | CMO Zero Reclaim | Merkeze dönüş | CMO 14 + EMA 20 | 3m–4H | Uçtan sıfıra dönüş ve EMA reclaim | EMA reddi |
| 58 | AO Twin Peaks MR | AO twin peaks | AO + Fractals | 3m–1H | Twin peaks sinyali + fractal teyidi | Karşı fractal |
| 59 | RVI Volatility Revert | Volatilite aşırılığında dönüş | RVI + BB | 15m–1D | RVI aşırı bölgede ve band dışı fakeout | Band walk |
| 60 | Coppock Long Rebound | Uzun vade dipten toparlanma | Coppock + SMA 200 | 4H–1W | Coppock dipten yukarı kıvrılır, fiyat stabilize | SMA200 altına kalıcı dönüş |
| 61 | MACD Divergence Turn | Klasik dönüş | MACD + structure | 15m–1D | Fiyat yeni dip/zirve, MACD teyit etmiyor, yapı kırılır | Yapı korunursa iptal |
| 62 | RSI Divergence Turn | Momentum zayıflama dönüşü | RSI 14 + support/resistance | 15m–1D | Divergence + seviye kırılımı | Seviye korunursa yok say |
| 63 | OBV Divergence Reversal | Hacim uyumsuzluğu | OBV + price structure | 15m–1D | Fiyat ilerlerken OBV onaylamaz | OBV tekrar teyit ederse çık |
| 64 | CMF Zero Flip Reversal | Para akışı dönüşü | CMF 21 + EMA 50 | 5m–1D | CMF sıfır geçişi + EMA reclaim | CMF geri döner |
| 65 | Force Index Reversal | Şiddet değişimi | Force Index 13 + EMA13 | 5m–4H | Force Index sıfır geçişi + EMA dönüşü | EMA kaybı |
| 66 | Bull/Bear Power Turn | Elder Ray dönüşü | Bull/Bear Power + EMA13 | 5m–1D | Bear power zayıflayıp bull power toparlar | Tersi |
| 67 | PMO Signal Turn | Yumuşak dönüş | PMO + Signal + S/R | 15m–1D | Sinyal kesişimi yapı ile aynı anda | Yapı teyitsizse yok |
| 68 | STC Regime Flip | Hızlı rejim dönüşü | STC + EMA | 5m–4H | 25/75 bölgelerinden dönüş ve EMA reclaim | STC tekrar geri döner |
| 69 | Chaikin Volatility Reversal | Volatilite şokundan dönüş | Chaikin Volatility + BB | 5m–1D | Vol spike + fake breakout | Gerçek breakout’ta hemen iptal |
| 70 | Ulcer Risk Relief | Derin düşüş sonrası toparlanma | Ulcer Index + RSI | 1H–1D | UI zirvesi sonrası RSI reclaim | UI büyümeye devam ederse |
| 71 | NVI Smart Money Turn | Düşük hacim aklı dönüşü | NVI + 255 EMA | 1H–1D | NVI EMA üzerine çıkar | Tekrar altına iner |
| 72 | PVI Crowd Turn | Kalabalık hacim dönüşü | PVI + EMA | 1H–1D | PVI trend değişimini teyit eder | EMA altı |
| 73 | R-Squared Trend Failure | Trend çöküşü | R2 + EMA 50 + MACD | 15m–1D | R2 düşerken MACD ters kesişim | R2 toparlanırsa |
| 74 | ZigZag Structure Reversal | Ana swing dönüşü | ZigZag + Fibo + RSI | 15m–1D | Swing tamamlanır, Fibo zone + RSI divergence | Swing devam |
| 75 | Fisher + RSI Reversal | Çifte dönüş teyidi | Fisher + RSI | 3m–4H | İkisi birlikte döner | Biri iptal ederse çık |
| 76 | DeMarker + CCI Reversal | Aşırılaşma çift teyit | DeMarker + CCI | 3m–4H | İki osilatör de dönüş verirse | Biri bozarsa |
| 77 | MFI + CMF Reversal | Hacimle dönüş teyidi | MFI + CMF | 5m–1D | MFI aşırı bölgeden çıkarken CMF sıfır flip | CMF teyit vermezse geç |
| 78 | Klinger + OBV Reversal | Hacim yapısı dönüşü | Klinger + OBV | 15m–1D | Klinger kesişim + OBV divergence | OBV teyitsiz |
| 79 | AO + AC Reversal | Bill Williams dönüşü | AO + AC + Fractal | 3m–1H | AO ve AC birlikte döner, fractal kırılır | Karşı fractal |
| 80 | Mass Index + EMA Reversal | Bulge sonrası trend kırılması | Mass Index + EMA20 | 15m–1D | Bulge sonrası EMA yön değiştirir | EMA’ya geri dönüş |
| 81 | VWAP + RSI Scalper | Seans içi scalp | VWAP + RSI 14 + RVOL | 1m–5m | VWAP reclaim + RSI 50 üstü + RVOL | VWAP kaybı |
| 82 | VWAP + Stoch Pullback | Scalp geri çekilme | VWAP + Stoch 14,3,3 | 1m–5m | Trend yönünde VWAP yakınında stoch dönüşü | VWAP karşı kırılır |
| 83 | Supertrend + Stoch Binary | Kısa expiry yön filtresi | Supertrend 10,3 + Stoch | 1m–5m | Supertrend yönü + stoch aynı yöne dönüyor | Supertrend terslenirse yok |
| 84 | EMA 9/21 + RSI Binary | Çok kısa yön filtresi | EMA9 + EMA21 + RSI14 | 1m–5m | EMA9>21 ve RSI50+ | EMA9<21 veya RSI<50 |
| 85 | Donchian + RVOL Binary Break | Kısa breakout | Donchian 20 + RVOL | 1m–5m | Kanal kırılımı ve RVOL >1.5 | Kanal içine dönüş |
| 86 | Keltner + CCI Fast Trend | Hızlı trend devamı | KC 20,2 + CCI20 | 1m–5m | Orta band desteği + CCI yeniden +100 | Orta band kırılır |
| 87 | BB + Williams Fade Binary | Range fixed-time | BB 20,2 + %R 14 | 1m–5m | Band ekstremi + %R dönüşü | Band walk |
| 88 | VWAP + MFI Intraday | Seans içi hacimli giriş | VWAP + MFI14 | 1m–15m | VWAP üstünde MFI 50 üstü | VWAP altı |
| 89 | Profile + VWAP Open Auction | Açılış kabul/red | Profile + VWAP + Delta | 1m–15m | Açılış value dışı kabul veya red | POC içine geri dönüş |
| 90 | Pivot + MACD Scalper | Seviye scalp | Pivot + MACD | 1m–5m | Pivot kırılımında MACD teyidi | Pivot alt/üst ret |
| 91 | RSI + ADX No-Trade Filter | Sinyal eleme | RSI14 + ADX14 | 1m–15m | ADX düşükse breakout yerine fade; ADX yüksekse trend işle | Rejim ters okunursa pas geç |
| 92 | ATR + Candle Range Filter | Expiry seçimi | ATR14 + son 5 bar range | 1m–5m | ATR düşükse kısa expiry riskli; ATR orta ise uygun | ATR aşırıysa stop genişlet |
| 93 | Stoch RSI + EMA Scalper | Hızlı scalp | Stoch RSI + EMA21 | 1m–5m | EMA yönünde stoch RSI dip/tepe dönüşü | EMA kırılır |
| 94 | KDJ + VWAP Fast Fade | Çok hızlı dönüş | KDJ + VWAP | 1m–3m | J aşırı uç + VWAP dönüşü | VWAP reddi |
| 95 | Supertrend + ADX Filtered | Trend scalp | Supertrend + ADX | 1m–5m | Supertrend yönünde sadece ADX>20 iken işlem | ADX çökerse dur |
| 96 | OBV + EMA Micro Break | Mikro breakout | OBV + EMA9/21 | 1m–5m | EMA kesişimi OBV teyidi ile | OBV teyidi bozulur |
| 97 | CMF + VWAP Micro Trend | Seans içi yön | CMF21 + VWAP | 1m–15m | VWAP üstü ve CMF pozitif | CMF negatifleşir |
| 98 | RVOL + Donchian News Burst | Haber patlaması | RVOL + Donchian + ATR | 1m–5m | Sadece yüksek RVOL ve net kanal kırılımında | Aşırı spike sonrası kovalamaz |
| 99 | Ichimoku Micro Cloud | Daha sakin intraday | Ichimoku kısa TF + Volume | 5m–15m | Bulut üstünde kabul | Bulut içine dönüş |
| 100 | EMA + ATR Trailing Intraday | Seans içi taşıma | EMA21 + ATR14 | 1m–15m | EMA’dan uzaklaşan trendi ATR trailing ile izle | EMA kaybı |

## Son sert notlar
- Tek bir “sihirli” gösterge yok.
- Kısa vadede hız için EMA/VWAP/Supertrend öne çıkar.
- Trend gücü için ADX, volatilite için ATR, zamanlama için RSI/Stoch, hacim teyidi için RVOL/OBV/CMF güçlü omurgadır.
- Çoklu kullanımda amaç gösterge sayısını artırmak değil, **farklı veri boyutlarını** birleştirmektir.

## En pratik 10 çekirdek set
1. EMA 21 + EMA 50 + RSI + ATR
2. Supertrend + ADX + RSI
3. VWAP + RVOL + MACD
4. Donchian + ADX + OBV
5. Ichimoku + ATR
6. Bollinger Bands + RSI
7. Keltner + CCI
8. Volume Profile + VWAP
9. SMA 50/200 + MACD
10. EMA + CMF + ATR

## Başlangıçta en çok iş gören 15 gösterge
EMA, SMA, RSI, MACD, ATR, ADX, VWAP, Supertrend, Bollinger Bands, Donchian Channel, Ichimoku Cloud, Stochastic, OBV, CMF, Volume Profile