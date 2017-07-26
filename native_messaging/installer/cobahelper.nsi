# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

; Set verbosity to 3 (e.g. no script) to lessen the noise in the build logs
!verbose 3

; Installer Attributes

; Version Information
; TBD

; Compiler Flags
SetCompressor /SOLID lzma
Unicode true

; General Attributes
Icon "${NSISDIR}\Contrib\Graphics\Icons\orange-install-nsis.ico"
InstallDir "$LOCALAPPDATA\MozillaOnline\COBA"
Name "COBA Helper"
OutFile "coba-helper-setup.exe"
RequestExecutionLevel user
; This or "SetSilent silent" in `.onInit`?
; SilentInstall silent
UninstallIcon "${NSISDIR}\Contrib\Graphics\Icons\orange-uninstall-nsis.ico"

; Pages
; Empty for silent install

; Sections

Section
  ; Not necessary now since the installer is silent and the section is hidden
  ; SectionIn RO

  SetOutPath $INSTDIR

  File /a /oname=helper.exe ielauncher.exe
  File /a /oname=helper.json cobahelper.json

  WriteRegStr HKCU "SOFTWARE\Mozilla\NativeMessagingHosts\com.mozillaonline.cobahelper" "" "$INSTDIR\helper.json"

  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\MozillaOnlineCOBA" "DisplayName" "COBA Helper"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\MozillaOnlineCOBA" "Publisher" "Mozilla Online Limited"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\MozillaOnlineCOBA" "DisplayVersion" "0.5.0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\MozillaOnlineCOBA" "UninstallString" '"$INSTDIR\uninstaller.exe"'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\MozillaOnlineCOBA" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\MozillaOnlineCOBA" "NoRepair" 1

  WriteUninstaller "uninstaller.exe"
SectionEnd

Section "Uninstall"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\MozillaOnlineCOBA"
  DeleteRegKey HKCU "SOFTWARE\Mozilla\NativeMessagingHosts\com.mozillaonline.cobahelper"

  RMDir /r /REBOOTOK $INSTDIR
SectionEnd

; Functions

; defaults to silent mode for now
Function .onInit
  ; Read the docs about SetRegView again when adding InstallDirRegKey later
  SetRegView 64
  SetSilent silent
FunctionEnd
