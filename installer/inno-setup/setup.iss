; ============================================================
; Inno Setup Script — Importador de Notas Mineduc
; Genera Setup.exe profesional para instalar la extensión
; con activación guiada en navegadores detectados.
; ============================================================

#define MyAppName "Importador de Notas Mineduc"
#define MyAppVersion "1.1.2"
#define MyAppPublisher "Mineduc Tools"
#define MyAppURL "https://mineduc-license-api.fabiancacuango1.workers.dev"
#define MyAppExeName ""
#define ExtensionID "importador-notas-mineduc"

[Setup]
AppId={{8A7F2B3C-4D5E-6F78-9A0B-1C2D3E4F5A6B}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
DefaultDirName={autopf}\{#ExtensionID}
DefaultGroupName={#MyAppName}
; Menú inicio sin página intermedia para mantener flujo simple
DisableProgramGroupPage=yes
; Compresion máxima
Compression=lzma2/ultra64
SolidCompression=yes
; Instalación estándar y transparente en rutas de Windows
PrivilegesRequired=admin
; Apariencia
WizardStyle=modern
; Salida
OutputDir=..\output
OutputBaseFilename=ImportadorNotas_Setup_v{#MyAppVersion}
; Sin desinstalador visible innecesario (la extension se desinstala desde Chrome)
Uninstallable=yes
UninstallDisplayIcon={app}\icon.ico
ArchitecturesAllowed=x86 x64
MinVersion=6.1sp1

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Messages]
spanish.WelcomeLabel1=Bienvenido al instalador de {#MyAppName}
spanish.WelcomeLabel2=Este programa instalará la extensión {#MyAppName} v{#MyAppVersion}.%n%nAl finalizar, podrá elegir su navegador para activar la extensión paso a paso.%n%nSe recomienda cerrar los navegadores antes de continuar.
spanish.FinishedHeadingLabel=Instalación completada
spanish.FinishedLabel=La extensión {#MyAppName} se instaló correctamente en:%n{app}\extension%n%nUse el botón "Finalizar" para abrir su navegador y completar la activación guiada.

[Types]
Name: "full"; Description: "Instalación completa"
Name: "custom"; Description: "Personalizada"; Flags: iscustom

[Components]
Name: "extension"; Description: "Extensión del navegador"; Types: full custom; Flags: fixed

[Files]
; Extensión compilada y ofuscada
Source: "..\dist\extension\*"; DestDir: "{app}\extension"; Flags: ignoreversion recursesubdirs createallsubdirs; Components: extension

; Script auxiliar para abrir la página de extensiones desde acceso directo
Source: "..\scripts\activar_extension.cmd"; DestDir: "{app}"; Flags: ignoreversion

; Icono
; Source: "..\..\assets\icon.ico"; DestDir: "{app}"; Flags: ignoreversion

; La activación de la extensión se realiza de forma guiada y transparente.

[Icons]
Name: "{group}\Activar extensión"; Filename: "{app}\activar_extension.cmd"; WorkingDir: "{app}"

[Code]
var
  LicenseKeyPage: TInputQueryWizardPage;
  BrowserChoicePage: TInputOptionWizardPage;
  LicenseKey: string;
  ChromePath: string;
  EdgePath: string;
  FirefoxPath: string;
  SelectedBrowser: string;

{ ═══ Funciones auxiliares ═══ }

function QueryAppPath(const ExeName: string): string;
var
  Value: string;
begin
  Result := '';

  if RegQueryStringValue(HKCU, 'Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\' + ExeName, '', Value) and FileExists(Value) then
  begin
    Result := Value;
    Exit;
  end;

  if RegQueryStringValue(HKLM, 'Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\' + ExeName, '', Value) and FileExists(Value) then
  begin
    Result := Value;
    Exit;
  end;

  if RegQueryStringValue(HKLM32, 'Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\' + ExeName, '', Value) and FileExists(Value) then
  begin
    Result := Value;
    Exit;
  end;

  if IsWin64 and RegQueryStringValue(HKLM64, 'Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\' + ExeName, '', Value) and FileExists(Value) then
  begin
    Result := Value;
    Exit;
  end;
end;

function DetectChromePath(): string;
begin
  Result := QueryAppPath('chrome.exe');
  if Result = '' then
    if FileExists(ExpandConstant('{localappdata}') + '\Google\Chrome\Application\chrome.exe') then
      Result := ExpandConstant('{localappdata}') + '\Google\Chrome\Application\chrome.exe';
  if Result = '' then
    if FileExists(ExpandConstant('{pf}') + '\Google\Chrome\Application\chrome.exe') then
      Result := ExpandConstant('{pf}') + '\Google\Chrome\Application\chrome.exe';
  if Result = '' then
    if IsWin64 and FileExists(ExpandConstant('{pf64}') + '\Google\Chrome\Application\chrome.exe') then
      Result := ExpandConstant('{pf64}') + '\Google\Chrome\Application\chrome.exe';
end;

function DetectEdgePath(): string;
begin
  Result := QueryAppPath('msedge.exe');
  if Result = '' then
    if FileExists(ExpandConstant('{pf}') + '\Microsoft\Edge\Application\msedge.exe') then
      Result := ExpandConstant('{pf}') + '\Microsoft\Edge\Application\msedge.exe';
  if Result = '' then
    if IsWin64 and FileExists(ExpandConstant('{pf64}') + '\Microsoft\Edge\Application\msedge.exe') then
      Result := ExpandConstant('{pf64}') + '\Microsoft\Edge\Application\msedge.exe';
end;

function DetectFirefoxPath(): string;
begin
  Result := QueryAppPath('firefox.exe');
  if Result = '' then
    if FileExists(ExpandConstant('{pf}') + '\Mozilla Firefox\firefox.exe') then
      Result := ExpandConstant('{pf}') + '\Mozilla Firefox\firefox.exe';
  if Result = '' then
    if IsWin64 and FileExists(ExpandConstant('{pf64}') + '\Mozilla Firefox\firefox.exe') then
      Result := ExpandConstant('{pf64}') + '\Mozilla Firefox\firefox.exe';
end;

procedure OpenBrowserExtensionsPage();
var
  ResultCode: Integer;
begin
  if SelectedBrowser = 'chrome' then
  begin
    Exec(ChromePath, '--new-window chrome://extensions/', '', SW_SHOWNORMAL, ewNoWait, ResultCode);
    Exit;
  end;

  if SelectedBrowser = 'edge' then
  begin
    Exec(EdgePath, '--new-window edge://extensions/', '', SW_SHOWNORMAL, ewNoWait, ResultCode);
    Exit;
  end;

  if SelectedBrowser = 'firefox' then
  begin
    Exec(FirefoxPath, 'about:addons', '', SW_SHOWNORMAL, ewNoWait, ResultCode);
    Exit;
  end;
end;

procedure ShowActivationInstructions();
begin
  MsgBox(
    'La extensión fue instalada correctamente.' + #13#10 + #13#10 +
    'Para activarla:' + #13#10 + #13#10 +
    '1. Abra la página de extensiones del navegador.' + #13#10 + #13#10 +
    '2. Active el modo desarrollador.' + #13#10 + #13#10 +
    '3. Seleccione "Cargar extensión descomprimida".' + #13#10 + #13#10 +
    '4. Elija la carpeta:' + #13#10 + ExpandConstant('{app}') + '\extension',
    mbInformation,
    MB_OK
  );
end;

{ ═══ Página de licencia personalizada ═══ }

procedure InitializeWizard();
var
  HasAnyBrowser: Boolean;
begin
  ChromePath := DetectChromePath();
  EdgePath := DetectEdgePath();
  FirefoxPath := DetectFirefoxPath();

  HasAnyBrowser := (ChromePath <> '') or (EdgePath <> '') or (FirefoxPath <> '');

  LicenseKeyPage := CreateInputQueryPage(
    wpSelectDir,
    'Código de Licencia',
    'Ingrese su código de licencia para activar el producto.',
    'Si aún no tiene un código, puede adquirirlo por WhatsApp después de la instalación.' + #13#10 +
    'Puede dejar este campo vacío para usar el modo de prueba gratuita (30 estudiantes).'
  );
  LicenseKeyPage.Add('Código de licencia (ej: MINEDUC-XXXXXXXXXX):', False);

  BrowserChoicePage := CreateInputOptionPage(
    wpInstalling,
    'Activación de la extensión',
    'Seleccione el navegador donde desea instalar la extensión',
    'Se detectaron los siguientes navegadores. Al continuar, el instalador abrirá la página de extensiones del navegador seleccionado para completar la activación.',
    True,
    False
  );

  if ChromePath <> '' then
    BrowserChoicePage.Add('Google Chrome');
  if EdgePath <> '' then
    BrowserChoicePage.Add('Microsoft Edge');
  if FirefoxPath <> '' then
    BrowserChoicePage.Add('Mozilla Firefox');

  if not HasAnyBrowser then
  begin
    BrowserChoicePage.Add('No se detectaron navegadores compatibles');
    BrowserChoicePage.Values[0] := True;
    BrowserChoicePage.CheckListBox.Enabled := False;
  end;

  if BrowserChoicePage.CheckListBox.Items.Count > 0 then
    BrowserChoicePage.Values[0] := True;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  OptionIndex: Integer;
begin
  Result := True;
  if CurPageID = LicenseKeyPage.ID then
  begin
    LicenseKey := Trim(LicenseKeyPage.Values[0]);
    { Validar formato si se ingresó algo }
    if (LicenseKey <> '') and (Pos('MINEDUC-', UpperCase(LicenseKey)) <> 1) then
    begin
      MsgBox('El código de licencia debe comenzar con "MINEDUC-". Por favor verifique.', mbError, MB_OK);
      Result := False;
    end;
  end;

  if CurPageID = BrowserChoicePage.ID then
  begin
    SelectedBrowser := '';
    OptionIndex := 0;

    if ChromePath <> '' then
    begin
      if BrowserChoicePage.Values[OptionIndex] then
        SelectedBrowser := 'chrome';
      OptionIndex := OptionIndex + 1;
    end;

    if EdgePath <> '' then
    begin
      if BrowserChoicePage.Values[OptionIndex] then
        SelectedBrowser := 'edge';
      OptionIndex := OptionIndex + 1;
    end;

    if FirefoxPath <> '' then
    begin
      if BrowserChoicePage.Values[OptionIndex] then
        SelectedBrowser := 'firefox';
      OptionIndex := OptionIndex + 1;
    end;

    if ((ChromePath <> '') or (EdgePath <> '') or (FirefoxPath <> '')) and (SelectedBrowser = '') then
    begin
      MsgBox('Seleccione un navegador para continuar con la activación guiada.', mbError, MB_OK);
      Result := False;
    end;
  end;
end;

{ ═══ Post-instalación ═══ }

procedure SaveLicenseKeyToExtension();
var
  LicFile: string;
begin
  if LicenseKey <> '' then
  begin
    LicFile := ExpandConstant('{app}') + '\extension\license_preactivation.json';
    SaveStringToFile(LicFile,
      '{' + #13#10 +
      '  "licenseKey": "' + UpperCase(LicenseKey) + '",' + #13#10 +
      '  "preactivated": true,' + #13#10 +
      '  "installedAt": "' + GetDateTimeString('yyyy-mm-dd"T"hh:nn:ss', #0, #0) + '"' + #13#10 +
      '}',
      False);
    Log('Licencia pre-activada guardada: ' + UpperCase(LicenseKey));
  end;
end;

procedure SaveSelectedBrowser();
var
  BrowserFile: string;
begin
  BrowserFile := ExpandConstant('{app}') + '\browser_choice.txt';
  if SelectedBrowser <> '' then
    SaveStringToFile(BrowserFile, SelectedBrowser, False);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    if not ((ChromePath <> '') or (EdgePath <> '') or (FirefoxPath <> '')) then
    begin
      MsgBox(
        'No se detectó Google Chrome, Microsoft Edge ni Mozilla Firefox.' + #13#10 +
        'La extensión se copió en: ' + ExpandConstant('{app}') + '\extension' + #13#10 +
        'Puede cargarla manualmente desde la página de extensiones de su navegador.',
        mbInformation, MB_OK
      );
    end;

    { Guardar licencia si se proporcionó }
    SaveLicenseKeyToExtension();
    SaveSelectedBrowser();
  end;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = wpFinished then
  begin
    if SelectedBrowser <> '' then
      OpenBrowserExtensionsPage();

    ShowActivationInstructions();
  end;
end;

{ ═══ Desinstalación ═══ }

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
  begin
    { Sin cambios ocultos en navegadores: solo desinstalación de archivos locales }
  end;
end;
