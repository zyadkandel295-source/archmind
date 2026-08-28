; Register the stable install-intent scheme during NSIS installation. Electron
; also registers it at runtime, but doing it here means the first deep link can
; open the app immediately after a silent install.
!macro customInstall
  WriteRegStr HKCU "Software\\Classes\\archmind" "" "URL:AGENTIA Install Link"
  WriteRegStr HKCU "Software\\Classes\\archmind" "URL Protocol" ""
  WriteRegStr HKCU "Software\\Classes\\archmind\\DefaultIcon" "" "$INSTDIR\\ArchMind Assistant.exe,0"
  WriteRegStr HKCU "Software\\Classes\\archmind\\shell\\open\\command" "" "'$INSTDIR\\ArchMind Assistant.exe' '%1'"
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\\Classes\\archmind"
!macroend
