; ===== Tracker Installer (Inno Setup) =====
[Setup]
AppId={{7F9B7A1C-2A43-4B88-9F0F-TRACKER-DEMO-0001}
AppName=Tracker
AppVersion=1.0.0
AppPublisher=Your Company
DefaultDirName={pf}\Tracker
DefaultGroupName=Tracker
DisableProgramGroupPage=yes
OutputDir=.
OutputBaseFilename=TrackerSetup-1.0.0
Compression=lzma
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=admin
UninstallDisplayIcon={app}\Tracker.exe

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
; Checkbox in the installer
Name: "autostart"; Description: "Start Tracker automatically when I sign in to Windows"; Flags: checkedonce

[Files]
; Point Source to your built EXE from PyInstaller
Source: "E:\Tracker\tracker\dist\Tracker.exe"; DestDir: "{app}"; Flags: ignoreversion
; (Optional) include configs/icons if you have them
; Source: "E:\Tracker\config.ini"; DestDir: "{app}"; Flags: onlyifdoesntexist

[Icons]
Name: "{group}\Tracker"; Filename: "{app}\Tracker.exe"
Name: "{commondesktop}\Tracker"; Filename: "{app}\Tracker.exe"; Tasks: 
Name: "{group}\Uninstall Tracker"; Filename: "{uninstallexe}"

[Registry]
; Auto-start at user logon (per-user). Unchecked = no entry; checked = create value.
; {app} resolves to the installation directory.
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; \
    ValueType: string; ValueName: "Tracker"; \
    ValueData: """{app}\Tracker.exe"""; \
    Flags: uninsdeletevalue; Tasks: autostart

[Run]
; Optionally launch right after install (silent=no so user sees it)
Filename: "{app}\Tracker.exe"; Description: "Launch Tracker now"; Flags: nowait postinstall skipifsilent

; (Optional ADVANCED) If you prefer Task Scheduler instead of the Run key, 
; comment the [Registry] entry above and uncomment the two lines below:
; Filename: "schtasks"; \
;   Parameters: "/Create /TN ""Tracker AutoStart"" /TR """"{app}\Tracker.exe"""" /SC ONLOGON /RL LIMITED /F"; \
;   Flags: runhidden; Tasks: autostart
; Filename: "schtasks"; \
;   Parameters: "/Delete /TN ""Tracker AutoStart"" /F"; \
;   Flags: runhidden runascurrentuser uninstallonly
