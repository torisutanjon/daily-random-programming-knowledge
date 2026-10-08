; Removes the launch-at-login entry the app registers (electron/login-item.ts).
; The old uninstaller runs with --updated on every upgrade; keep the entry then.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "drpk"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "drpk"
    ; Builds before DRPK-016 registered it under the AppUserModelId.
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "com.drpk.app"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "com.drpk.app"
  ${endIf}
!macroend
