; Removes the launch-at-login entry the app registers (electron/login-item.ts).
!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "drpk"
  ; Builds before DRPK-016 registered it under the AppUserModelId.
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "com.drpk.app"
!macroend
