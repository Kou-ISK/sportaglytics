; Directory bundles remain portable folders on Windows. Explorer's context menu
; opens the entire package without treating its internal JSON as a document.
!macro customInstall
  WriteRegStr SHCTX "Software\Classes\Directory\shell\SporTagLytics" "" "SporTagLytics で開く"
  WriteRegStr SHCTX "Software\Classes\Directory\shell\SporTagLytics" "Icon" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}"'
  WriteRegStr SHCTX "Software\Classes\Directory\shell\SporTagLytics" "AppliesTo" "System.FileName:~>.stpkg OR System.FileName:~>.stpl OR System.FileName:~>.stad"
  WriteRegStr SHCTX "Software\Classes\Directory\shell\SporTagLytics\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
!macroend

!macro customUnInstall
  DeleteRegKey SHCTX "Software\Classes\Directory\shell\SporTagLytics"
!macroend
