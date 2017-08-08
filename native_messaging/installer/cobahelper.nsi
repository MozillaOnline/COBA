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

LoadLanguageFile "${NSISDIR}\Contrib\Language files\English.nlf"
LoadLanguageFile "${NSISDIR}\Contrib\Language files\SimpChinese.nlf"
!include langstrings.nsh

; General Attributes
Icon "${NSISDIR}\Contrib\Graphics\Icons\orange-install-nsis.ico"
InstallDir "$LOCALAPPDATA\MozillaOnline\COBA"
Name $(Name)
OutFile "coba-helper-setup.exe"
RequestExecutionLevel user
UninstallIcon "${NSISDIR}\Contrib\Graphics\Icons\orange-uninstall-nsis.ico"

; Pages
PageEx directory
  PageCallbacks "" onDirectoryShow

  DirText $(DirText)
PageExEnd
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

; Sections

Section
  SetOutPath $INSTDIR

  File /a /oname=helper.exe ielauncher.exe
  File /a /oname=helper.json cobahelper.json

  WriteRegStr HKCU "SOFTWARE\Mozilla\NativeMessagingHosts\com.mozillaonline.cobahelper" "" "$INSTDIR\helper.json"

  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\MozillaOnlineCOBA" "DisplayName" $(Name)
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

Function .onInit
  ; Read the docs about SetRegView again when adding InstallDirRegKey later
  SetRegView 64
  ReadEnvStr $0 MOZ_CRASHREPORTER_STRINGS_OVERRIDE
  IfErrors normalInit silentInit
normalInit:
  ClearErrors
  Goto done
silentInit:
  SetSilent silent
  Goto done
done:
FunctionEnd

Function onDirectoryShow
  FindWindow $1 "#32770" "" $HWNDPARENT
  GetDlgItem $0 $1 1019
  EnableWindow $0 0
  GetDlgItem $0 $1 1001
  EnableWindow $0 0
FunctionEnd
