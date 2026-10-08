; Removes the launch-at-login entry the app registers (electron/login-item.ts).
!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "drpk"
!macroend
