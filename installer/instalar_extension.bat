@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion
title Importador de Notas Mineduc - Instalador v1.1.2
color 0B

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║   IMPORTADOR DE NOTAS MINEDUC - Instalador v1.1.2      ║
echo  ║   Extensión para Chrome / Edge / Brave                  ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.

:: Verificar que la carpeta extension existe
set "SCRIPT_DIR=%~dp0"
set "EXT_DIR=%SCRIPT_DIR%dist\extension"

if not exist "%EXT_DIR%\manifest.json" (
    echo  [ERROR] No se encontro la carpeta de extension compilada.
    echo  Asegurese de ejecutar el build primero o de que la carpeta
    echo  "dist\extension" exista junto a este archivo.
    echo.
    pause
    exit /b 1
)

:: Destino de instalación
set "INSTALL_DIR=%LOCALAPPDATA%\ImportadorNotasMineduc\extension"

echo  [1/5] Preparando directorio de instalacion...
if exist "%LOCALAPPDATA%\ImportadorNotasMineduc" (
    echo         Actualizando instalacion existente...
)
mkdir "%LOCALAPPDATA%\ImportadorNotasMineduc" 2>nul
mkdir "%INSTALL_DIR%" 2>nul

echo  [2/5] Copiando archivos de la extension...
xcopy /E /Y /Q "%EXT_DIR%\*" "%INSTALL_DIR%\" >nul
if errorlevel 1 (
    echo  [ERROR] No se pudieron copiar los archivos.
    pause
    exit /b 1
)
echo         Archivos copiados correctamente.

:: Detectar navegadores
echo  [3/5] Detectando navegadores instalados...
set "BROWSERS_FOUND=0"

:: Chrome
set "CHROME_DATA=%LOCALAPPDATA%\Google\Chrome\User Data"
if exist "%CHROME_DATA%" (
    echo         [OK] Google Chrome detectado
    set /a BROWSERS_FOUND+=1
    set "CHROME_EXT_DIR=%CHROME_DATA%\External Extensions"
    mkdir "!CHROME_EXT_DIR!" 2>nul
    call :WriteExtJSON "!CHROME_EXT_DIR!"
)

:: Edge
set "EDGE_DATA=%LOCALAPPDATA%\Microsoft\Edge\User Data"
if exist "%EDGE_DATA%" (
    echo         [OK] Microsoft Edge detectado
    set /a BROWSERS_FOUND+=1
    set "EDGE_EXT_DIR=%EDGE_DATA%\External Extensions"
    mkdir "!EDGE_EXT_DIR!" 2>nul
    call :WriteExtJSON "!EDGE_EXT_DIR!"
)

:: Brave
set "BRAVE_DATA=%LOCALAPPDATA%\BraveSoftware\Brave-Browser\User Data"
if exist "%BRAVE_DATA%" (
    echo         [OK] Brave Browser detectado
    set /a BROWSERS_FOUND+=1
    set "BRAVE_EXT_DIR=%BRAVE_DATA%\External Extensions"
    mkdir "!BRAVE_EXT_DIR!" 2>nul
    call :WriteExtJSON "!BRAVE_EXT_DIR!"
)

if %BROWSERS_FOUND%==0 (
    echo         [!] No se detecto Chrome, Edge ni Brave.
    echo         Puede cargar la extension manualmente desde:
    echo         chrome://extensions ^> Modo desarrollador ^> Cargar descomprimida
    echo         Ruta: %INSTALL_DIR%
)

:: Pedir licencia
echo.
echo  [4/5] Activacion de licencia
echo  ─────────────────────────────────────────────────
echo  Si tiene un codigo de licencia, ingreselo ahora.
echo  Si no tiene uno, presione ENTER para modo de prueba
echo  gratuita (30 estudiantes).
echo.
set /p "LICENSE_KEY=  Codigo de licencia: "

if not "%LICENSE_KEY%"=="" (
    :: Validar formato MINEDUC-
    echo %LICENSE_KEY% | findstr /I "^MINEDUC-" >nul
    if errorlevel 1 (
        echo  [!] El codigo debe comenzar con MINEDUC-
        echo      La licencia no fue guardada. Puede activarla despues.
    ) else (
        :: Guardar archivo de pre-activación
        set "LIC_FILE=%INSTALL_DIR%\license_preactivation.json"
        (
            echo {
            echo   "licenseKey": "%LICENSE_KEY%",
            echo   "preactivated": true,
            echo   "installedAt": "%date:~6,4%-%date:~3,2%-%date:~0,2%T%time:~0,8%"
            echo }
        ) > "!LIC_FILE!"
        echo  [OK] Licencia pre-activada: %LICENSE_KEY%
    )
)

:: Abrir navegador
echo.
echo  [5/5] Abriendo navegador...

set "CHROME_EXE="
if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_EXE=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
) else if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    set "CHROME_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
)

if not "%CHROME_EXE%"=="" (
    start "" "%CHROME_EXE%" --load-extension="%INSTALL_DIR%" "https://academico.educarecuador.gob.ec/"
    echo         Navegador abierto con la extension cargada.
) else (
    echo         No se encontro el ejecutable del navegador.
    echo         Abra Chrome manualmente y vaya a:
    echo         chrome://extensions ^> Modo desarrollador ^> Cargar descomprimida
    echo         Ruta: %INSTALL_DIR%
)

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║   INSTALACION COMPLETADA                                ║
echo  ║                                                         ║
echo  ║   La extension se instalo en:                           ║
echo  ║   %LOCALAPPDATA%\ImportadorNotasMineduc                 ║
echo  ║                                                         ║
echo  ║   Si la extension no aparece automaticamente:           ║
echo  ║   1. Abra chrome://extensions                          ║
echo  ║   2. Active "Modo desarrollador"                       ║
echo  ║   3. Click "Cargar descomprimida"                      ║
echo  ║   4. Seleccione la carpeta de la extension              ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.
pause
exit /b 0

:: ═══ Función: Escribir JSON de external extension ═══
:WriteExtJSON
set "JSON_DIR=%~1"
set "JSON_FILE=%JSON_DIR%\importador-notas-mineduc.json"
set "INSTALL_PATH_ESC=%INSTALL_DIR:\=\\%"
(
    echo {
    echo   "path": "%INSTALL_PATH_ESC%",
    echo   "version": "1.1.2"
    echo }
) > "%JSON_FILE%"
exit /b 0
