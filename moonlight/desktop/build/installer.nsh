; ============================================================================
; MoonLight Owner Console — NSIS Installer Include (v2.7.0)
; Bu dosya electron-builder tarafından NSIS template'ine enjekte edilir.
;
; Amaç:
;   - Kurulum öncesi minimum Windows sürümü kontrolü (Windows 10 1903+ / Build 18362)
;   - Minimum disk alanı kontrolü (500 MB)
;   - Türkçe/İngilizce kullanıcı dostu hata mesajları
;
; electron-builder makroları:
;   - customInit         : Installer UI açılmadan ÖNCE çalışır.
;   - customInstall      : Dosya kopyalama ÖNCE çalışır.
;   - customUnInstall    : Uninstall sırasında tam temizlik.
; ============================================================================

!include "WinVer.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"

; ---------------------------------------------------------------------------
; customInit: UI açılmadan önce preflight kontrolleri
; ---------------------------------------------------------------------------
!macro customInit
  ; 1) Windows sürüm kontrolü — en az Windows 10 (build 10240+).
  ;    WinVer.nsh AtLeastWin10 makrosu Windows 10 tabanını kontrol eder.
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_OK|MB_ICONSTOP "MoonLight Owner Console yalnızca Windows 10 (1903+) veya Windows 11 sürümlerinde çalışır.$\n$\nKurulum iptal edildi."
    Quit
  ${EndIf}

  ; 2) Disk alanı kontrolü — hedef sürücüde en az 500 MB boş alan ister.
  ;    $INSTDIR henüz setlenmemiş olabilir; bu yüzden sistemin sürücüsünü
  ;    kontrol etmek daha güvenli. Default: $PROGRAMFILES64.
  StrCpy $0 "$PROGRAMFILES64"
  ${DriveSpace} "$0" "/D=F /S=M" $1
  ${If} $1 < 500
    MessageBox MB_OK|MB_ICONSTOP "Yetersiz disk alanı. MoonLight kurulumu için en az 500 MB boş alan gereklidir.$\n$\nŞu anda kullanılabilir: $1 MB$\nKurulum iptal edildi."
    Quit
  ${EndIf}
!macroend

; ---------------------------------------------------------------------------
; customInstall: dosya kopyalama öncesi son mesajlar
; ---------------------------------------------------------------------------
!macro customInstall
  DetailPrint "MoonLight Owner Console ${VERSION} kuruluyor..."
  DetailPrint "Hedef: $INSTDIR"
!macroend

; ---------------------------------------------------------------------------
; customUnInstall: kullanıcıya AppData temizliği soralım
; ---------------------------------------------------------------------------
!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION "Kullanıcı verilerini de silmek ister misiniz?$\n$\n(Runtime flags, vault, oturum geçmişi dahil)$\n$\nEvet = Tam temizlik | Hayır = Yalnızca program dosyaları" IDNO NoCleanup
    RMDir /r "$APPDATA\moonlight-owner-console"
    RMDir /r "$APPDATA\MoonLight Owner Console"
    RMDir /r "$LOCALAPPDATA\moonlight-owner-console"
  NoCleanup:
!macroend
