; ============================================================================
; MoonLight Owner Console — NSIS Installer Include (v2.7.3)
; ----------------------------------------------------------------------------
; electron-builder NSIS template'e enjekte edilir. SADECE electron-builder'ın
; desteklediği macro'ları kullanır (customHeader / customInit / customInstall
; / customUnInstall).
;
; Güvenlik: NSIS build'ini patlatabilecek TÜM karmaşık disk-space / drive-space
; kontrolleri kaldırıldı. Windows 10 (Build 17763+) kontrolü WinVer.nsh ile
; yapılır — bu zaten NSIS 3.x standard include.
; ============================================================================

!include "WinVer.nsh"
!include "LogicLib.nsh"

; ---------------------------------------------------------------------------
; customInit — installer UI açılmadan önce preflight kontrolleri.
; ---------------------------------------------------------------------------
!macro customInit
  ; Windows 10 or newer required. AtLeastWin10 = build 10240+. The earliest
  ; officially supported mainstream Windows 10 release is build 17763 (1809);
  ; we still accept anything ≥ Win10 because our app does not rely on 1809+
  ; APIs directly.
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_OK|MB_ICONSTOP "MoonLight Owner Console yalnizca Windows 10 veya Windows 11 sistemlerinde calisir.$\n$\nKurulum iptal edildi."
    Quit
  ${EndIf}
!macroend

; ---------------------------------------------------------------------------
; customInstall — dosya kopyalama öncesi diagnostics (silent-safe).
; ---------------------------------------------------------------------------
!macro customInstall
  DetailPrint "MoonLight Owner Console kuruluyor..."
  DetailPrint "Hedef: $INSTDIR"
!macroend

; ---------------------------------------------------------------------------
; customUnInstall — kullanıcıya AppData temizliği soralım (interactive mode).
;   Silent uninstall'da (/S) bu prompt atlanır, AppData korunur.
; ---------------------------------------------------------------------------
!macro customUnInstall
  ${IfNot} ${Silent}
    MessageBox MB_YESNO|MB_ICONQUESTION "Kullanici verilerini (runtime flags, vault, oturum) de silmek ister misiniz?$\n$\nEvet = Tam temizlik | Hayir = Yalnizca program dosyalari" IDNO NoCleanup
      RMDir /r "$APPDATA\moonlight-owner-console"
      RMDir /r "$APPDATA\MoonLight Owner Console"
      RMDir /r "$LOCALAPPDATA\moonlight-owner-console"
    NoCleanup:
  ${EndIf}
!macroend
