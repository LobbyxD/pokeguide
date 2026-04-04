; ─────────────────────────────────────────────────────────────────────────────
; PokeGuide — Custom NSIS installer macros
; ─────────────────────────────────────────────────────────────────────────────
;
; Scratch registers:
;   $R5 = existing InstallLocation (registry)
;   $R6 = existing DisplayVersion  (registry)
;   $R7 = existing UninstallString (registry)
;   $R8 = install mode: "f" fresh, "r" repair, "s" silent/update
;
; ── On startup: read registry, decide what to do ─────────────────────────────
!macro customInit
  StrCpy $R5 ""
  StrCpy $R6 ""
  StrCpy $R7 ""
  StrCpy $R8 ""

  ; ── Silent mode (auto-update): install to existing location ────────────────
  IfSilent pg_silent_mode

  ; ── Check HKCU ─────────────────────────────────────────────────────────────
  ReadRegStr $R5 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "InstallLocation"
  ReadRegStr $R6 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "DisplayVersion"
  ReadRegStr $R7 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "UninstallString"

  ; ── Fallback: HKLM ─────────────────────────────────────────────────────────
  StrCmp $R5 "" 0 pg_got_loc
  ReadRegStr $R5 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "InstallLocation"
  ReadRegStr $R6 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "DisplayVersion"
  ReadRegStr $R7 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "UninstallString"

  ; ── Fallback: WOW6432Node ──────────────────────────────────────────────────
  StrCmp $R5 "" 0 pg_got_loc
  ReadRegStr $R5 HKLM "Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "InstallLocation"
  ReadRegStr $R6 HKLM "Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "DisplayVersion"
  ReadRegStr $R7 HKLM "Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "UninstallString"

  pg_got_loc:
  StrCmp $R5 "" pg_fresh_mode   ; no existing install → fresh

  ; ── Existing install found: verify the exe is actually there ───────────────
  IfFileExists "$R5\PokeGuide.exe" pg_existing_confirmed
    ; Registered location has no exe — stale/incomplete; treat as fresh
    StrCpy $R5 ""
    Goto pg_fresh_mode

  pg_existing_confirmed:
  ; ── Existing install: wizard will show Repair / Uninstall choice ────────────
  ;   We still install to the existing location so files are current,
  ;   then the wizard (launched by runAfterFinish) handles the UX.
  StrCpy $INSTDIR $R5
  StrCpy $R8 "r"           ; repair mode
  Goto pg_init_done

  pg_fresh_mode:
  ; ── Fresh install: stage to TEMP; wizard copies to user-chosen dir ──────────
  StrCpy $INSTDIR "$%TEMP%\PokeGuide-setup"
  StrCpy $R8 "f"           ; fresh mode
  Goto pg_init_done

  ; ── Silent / auto-update ───────────────────────────────────────────────────
  pg_silent_mode:
  ReadRegStr $R5 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "InstallLocation"
  StrCmp $R5 "" 0 pg_si_got_loc
  ReadRegStr $R5 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "InstallLocation"
  pg_si_got_loc:
  StrCmp $R5 "" 0 +2
    StrCpy $R5 "$%SystemDrive%\PokeGuide"   ; fallback
  StrCpy $INSTDIR $R5
  StrCpy $R8 "s"           ; silent mode

  pg_init_done:
!macroend

; ── After files are installed: write the appropriate marker ───────────────────
!macro customInstall
  CreateDirectory "$APPDATA\PokeGuide"
  StrCmp $R8 "f" pg_ci_fresh
  StrCmp $R8 "r" pg_ci_repair
  ; silent/update
  FileOpen $9 "$APPDATA\PokeGuide\.updated" w
  FileClose $9
  Goto pg_ci_done
  pg_ci_fresh:
    FileOpen $9 "$APPDATA\PokeGuide\.first-run" w
    FileClose $9
    Goto pg_ci_done
  pg_ci_repair:
    FileOpen $9 "$APPDATA\PokeGuide\.repair" w
    FileClose $9
  pg_ci_done:
!macroend

; ── Uninstaller: silent = skip dialog (called from our wizard with /S) ────────
;   Yes (6) = delete data    No (7) = keep data
!macro customUnInstall
  IfSilent pg_cu_done   ; silent uninstall skips dialog, keeps data
  StrCpy $3 "7"   ; default to keep
  System::Call 'COMCTL32::TaskDialog(i 0, i 0, w "PokeGuide", w "Remove your saved data?", w "Would you like to delete your PokeGuide saved data?$\r$\n$\r$\nThis includes custom presets and your Pokedex cache.$\r$\n$\r$\nSelect No to keep your data in case you reinstall later.", i 6, i 0, *i .r3) i'
  StrCmp $3 "6" 0 pg_cu_done   ; Yes = delete
    RMDir /r "$APPDATA\PokeGuide"
  pg_cu_done:
!macroend
