; ============================================================
; Inno Setup Script — Importador de Notas Mineduc v1.3
; Instalador profesional con activación guiada de extensión
; Detecta navegadores y guía al usuario paso a paso
; ============================================================

#define MyAppName "Importador de Notas Mineduc"
#define MyAppVersion "1.3.0"
#define MyAppPublisher "Mineduc Tools"
#define MyAppURL "https://mineduc-license-api.fabiancacuango1.workers.dev"
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
; Compresión máxima para archivo más pequeño
Compression=lzma2/ultra64
SolidCompression=yes
; Instalación estándar con derechos de administrador
PrivilegesRequired=admin
; Apariencia moderna
WizardStyle=modern
; Directorio de salida del Setup.exe compilado
OutputDir=.\output
OutputBaseFilename=ImportadorNotas_Setup_v{#MyAppVersion}
; Permitir desinstalación
Uninstallable=yes
UninstallDisplayIcon={app}\icon.ico
; Compatibilidad con arquitecturas x86 y x64
ArchitecturesAllowed=x86 x64
; Compatibilidad desde Windows 7 SP1 hasta Windows 11
MinVersion=6.1sp1

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Messages]
spanish.WelcomeLabel1=Bienvenido al instalador de {#MyAppName}
spanish.WelcomeLabel2=Este programa instalará la extensión {#MyAppName} v{#MyAppVersion}.%n%nAl finalizar, podrá elegir su navegador para activar la extensión paso a paso.%n%nSe recomienda cerrar los navegadores web antes de continuar.
spanish.FinishedHeadingLabel=Instalación completada
spanish.FinishedLabel=La extensión {#MyAppName} se instaló correctamente en:%n{app}\extension%n%nUse el botón "Finalizar" para abrir su navegador y completar la activación guiada.

[Types]
Name: "full"; Description: "Instalación completa"
Name: "custom"; Description: "Personalizada"; Flags: iscustom

[Components]
Name: "extension"; Description: "Extensión del navegador"; Types: full custom; Flags: fixed

[Files]
; Extensión compilada y lista para usar
Source: "extension\*"; DestDir: "{app}\extension"; Flags: ignoreversion recursesubdirs createallsubdirs; Components: extension

; Script auxiliar para abrir la página de extensiones desde acceso directo
Source: "scripts\activar_extension.cmd"; DestDir: "{app}"; Flags: ignoreversion

; Icono (descomenta si lo necesitas)
; Source: "icon.ico"; DestDir: "{app}"; Flags: ignoreversion

; La activación de la extensión se realiza de forma guiada y transparente.

[Icons]
Name: "{group}\Activar extensión"; Filename: "{app}\activar_extension.cmd"; WorkingDir: "{app}"
Name: "{group}\Desinstalar {#MyAppName}"; Filename: "{uninstallexe}"

[Code]
var
  LicenseKeyPage: TInputQueryWizardPage;
  BrowserChoicePage: TInputOptionWizardPage;
  LicenseKey: string;
  ChromePath: string;
  EdgePath: string;
  FirefoxPath: string;
  SelectedBrowser: string;

{ ═════════════════════════════════════════════════════════ }
{ FUNCIONES DE DETECCIÓN DE NAVEGADORES                    }
{ ═════════════════════════════════════════════════════════ }

{ Consulta el registro de Windows para encontrar ejecutables }
function QueryAppPath(const ExeName: string): string;
var
  Value: string;
begin
  Result := '';

  { Buscar en HKEY_CURRENT_USER (usuario actual) }
  if RegQueryStringValue(HKCU, 'Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\' + ExeName, '', Value) and FileExists(Value) then
  begin
    Result := Value;
    Exit;
  end;

  { Buscar en HKEY_LOCAL_MACHINE (32 bits en sistemas 64 bits) }
  if RegQueryStringValue(HKLM, 'Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\' + ExeName, '', Value) and FileExists(Value) then
  begin
    Result := Value;
    Exit;
  end;

  { Buscar en HKEY_LOCAL_MACHINE 32 bits }
  if RegQueryStringValue(HKLM32, 'Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\' + ExeName, '', Value) and FileExists(Value) then
  begin
    Result := Value;
    Exit;
  end;

  { Buscar en HKEY_LOCAL_MACHINE 64 bits (solo en sistemas 64 bits) }
  if IsWin64 and RegQueryStringValue(HKLM64, 'Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\' + ExeName, '', Value) and FileExists(Value) then
  begin
    Result := Value;
    Exit;
  end;
end;

{ Detecta la ruta de Google Chrome }
function DetectChromePath(): string;
begin
  { Primero intenta el registro }
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

{ Detecta la ruta de Microsoft Edge }
function DetectEdgePath(): string;
begin
  { Primero intenta el registro }
  Result := QueryAppPath('msedge.exe');
  if Result = '' then
    if FileExists(ExpandConstant('{pf}') + '\Microsoft\Edge\Application\msedge.exe') then
      Result := ExpandConstant('{pf}') + '\Microsoft\Edge\Application\msedge.exe';
  if Result = '' then
    if IsWin64 and FileExists(ExpandConstant('{pf64}') + '\Microsoft\Edge\Application\msedge.exe') then
      Result := ExpandConstant('{pf64}') + '\Microsoft\Edge\Application\msedge.exe';
end;

{ Detecta la ruta de Mozilla Firefox }
function DetectFirefoxPath(): string;
begin
  { Primero intenta el registro }
  Result := QueryAppPath('firefox.exe');
  if Result = '' then
    if FileExists(ExpandConstant('{pf}') + '\Mozilla Firefox\firefox.exe') then
      Result := ExpandConstant('{pf}') + '\Mozilla Firefox\firefox.exe';
  if Result = '' then
    if IsWin64 and FileExists(ExpandConstant('{pf64}') + '\Mozilla Firefox\firefox.exe') then
      Result := ExpandConstant('{pf64}') + '\Mozilla Firefox\firefox.exe';
end;

{ ═════════════════════════════════════════════════════════ }
{ FUNCIONES DE APERTURA DE NAVEGADORES                     }
{ ═════════════════════════════════════════════════════════ }

{ Abre el navegador elegido en la página de extensiones }
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

{ Muestra instrucciones claras para activar la extensión }
procedure ShowActivationInstructions();
begin
  MsgBox(
    'La extensión fue instalada correctamente.' + #13#10 + #13#10 +
    'Para activarla:' + #13#10 + #13#10 +
    '1. Abra la página de extensiones del navegador.' + #13#10 + #13#10 +
    '2. Active el modo desarrollador.' + #13#10 + #13#10 +
    '3. Seleccione "Cargar extensión descomprimida".' + #13#10 + #13#10 +
    '4. Elija la carpeta:' + #13#10 +
    ExpandConstant('{app}') + '\extension' + #13#10 + #13#10 +
    'Si tiene preguntas, visite: ' + '{#MyAppURL}',
    mbInformation,
    MB_OK
  );
end;

{ ═════════════════════════════════════════════════════════ }
{ INICIALIZACIÓN DEL ASISTENTE                             }
{ ═════════════════════════════════════════════════════════ }

{ Crea las páginas del asistente y detecta los navegadores }
procedure InitializeWizard();
var
  HasAnyBrowser: Boolean;
begin
  { Detectar navegadores disponibles en el sistema }
  ChromePath := DetectChromePath();
  EdgePath := DetectEdgePath();
  FirefoxPath := DetectFirefoxPath();

  HasAnyBrowser := (ChromePath <> '') or (EdgePath <> '') or (FirefoxPath <> '');

  { Página de licencia }
  LicenseKeyPage := CreateInputQueryPage(
    wpSelectDir,
    'Código de Licencia',
    'Ingrese su código de licencia para activar el producto.',
    'Si aún no tiene un código, puede adquirirlo por WhatsApp después de la instalación.' + #13#10 +
    'Puede dejar este campo vacío para usar el modo de prueba gratuita (30 estudiantes).'
  );
  LicenseKeyPage.Add('Código de licencia (ej: MINEDUC-XXXXXXXXXX):', False);

  { Página de selección de navegador }
  BrowserChoicePage := CreateInputOptionPage(
    wpInstalling,
    'Activación de la extensión',
    'Seleccione el navegador donde desea instalar la extensión',
    'Se detectaron los siguientes navegadores. Al continuar, el instalador abrirá la página de extensiones del navegador seleccionado para completar la activación.',
    True,
    False
  );

  { Agregar solo navegadores detectados }
  if ChromePath <> '' then
    BrowserChoicePage.Add('Google Chrome');
  if EdgePath <> '' then
    BrowserChoicePage.Add('Microsoft Edge');
  if FirefoxPath <> '' then
    BrowserChoicePage.Add('Mozilla Firefox');

  { Si no hay navegadores, mostrar mensaje informativo }
  if not HasAnyBrowser then
  begin
    BrowserChoicePage.Add('No se detectaron navegadores compatibles');
    BrowserChoicePage.Values[0] := True;
    BrowserChoicePage.CheckListBox.Enabled := False;
  end;

  { Seleccionar la primera opción por defecto }
  if BrowserChoicePage.CheckListBox.Items.Count > 0 then
    BrowserChoicePage.Values[0] := True;
end;

{ ═════════════════════════════════════════════════════════ }
{ VALIDACIÓN DE PÁGINAS                                    }
{ ═════════════════════════════════════════════════════════ }

{ Valida los datos ingresados por el usuario }
function NextButtonClick(CurPageID: Integer): Boolean;
var
  OptionIndex: Integer;
begin
  Result := True;

  { Validar página de licencia }
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

  { Validar página de selección de navegador }
  if CurPageID = BrowserChoicePage.ID then
  begin
    SelectedBrowser := '';
    OptionIndex := 0;

    { Identificar qué navegador fue seleccionado }
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

    { Validar que se haya seleccionado un navegador si hay disponibles }
    if ((ChromePath <> '') or (EdgePath <> '') or (FirefoxPath <> '')) and (SelectedBrowser = '') then
    begin
      MsgBox('Seleccione un navegador para continuar con la activación guiada.', mbError, MB_OK);
      Result := False;
    end;
  end;
end;

{ ═════════════════════════════════════════════════════════ }
{ PROCEDIMIENTOS DE INSTALACIÓN                            }
{ ═════════════════════════════════════════════════════════ }

{ Guarda la clave de licencia en la extensión si se proporcionó }
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

{ Guarda la opción de navegador elegida para el acceso directo }
procedure SaveSelectedBrowser();
var
  BrowserFile: string;
begin
  BrowserFile := ExpandConstant('{app}') + '\browser_choice.txt';
  if SelectedBrowser <> '' then
    SaveStringToFile(BrowserFile, SelectedBrowser, False);
end;

{ Pasos posteriores a la instalación }
procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    { Mostrar mensaje si no se detectró ningún navegador }
    if not ((ChromePath <> '') or (EdgePath <> '') or (FirefoxPath <> '')) then
    begin
      MsgBox(
        'No se detectó Google Chrome, Microsoft Edge ni Mozilla Firefox.' + #13#10 +
        'La extensión se copió en: ' + ExpandConstant('{app}') + '\extension' + #13#10 +
        'Puede cargarla manualmente desde la página de extensiones de su navegador.',
        mbInformation, MB_OK
      );
    end;

    { Guardar licencia y navegador elegido }
    SaveLicenseKeyToExtension();
    SaveSelectedBrowser();
  end;
end;

{ Pasos cuando se llega a la pantalla final }
procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = wpFinished then
  begin
    { Abrir el navegador seleccionado en la página de extensiones }
    if SelectedBrowser <> '' then
      OpenBrowserExtensionsPage();

    { Mostrar instrucciones de activación }
    ShowActivationInstructions();
  end;
end;

{ ═════════════════════════════════════════════════════════ }
{ DESINSTALACIÓN                                           }
{ ═════════════════════════════════════════════════════════ }

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
  begin
    { La extensión se desinstala desde el navegador manualmente }
    { Sin cambios ocultos en navegadores: solo desinstalación de archivos locales }
  end;
end;
