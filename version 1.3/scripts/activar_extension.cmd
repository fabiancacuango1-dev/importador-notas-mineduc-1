@echo off
setlocal enabledelayedexpansion
set "APPDIR=%~dp0"
set "EXTDIR=%APPDIR%extension"
set "BROWSER="

REM Lee el navegador elegido durante la instalación
if exist "%APPDIR%browser_choice.txt" (
  set /p BROWSER=<"%APPDIR%browser_choice.txt"
)

REM Verifica que la extensión esté instalada
if not exist "%EXTDIR%\manifest.json" (
  echo.
  echo No se encontro la extension en %EXTDIR%
  echo Por favor, reinstale el programa.
  echo.
  pause
  exit /b 1
)

REM Abre el navegador elegido en la pagina de extensiones
if /I "%BROWSER%"=="chrome" (
  if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --new-window chrome://extensions/
    exit /b 0
  )
  if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --new-window chrome://extensions/
    exit /b 0
  )
)

if /I "%BROWSER%"=="edge" (
  if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --new-window edge://extensions/
    exit /b 0
  )
  if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --new-window edge://extensions/
    exit /b 0
  )
)

if /I "%BROWSER%"=="firefox" (
  if exist "%ProgramFiles%\Mozilla Firefox\firefox.exe" (
    start "" "%ProgramFiles%\Mozilla Firefox\firefox.exe" about:addons
    exit /b 0
  )
  if exist "%ProgramFiles(x86)%\Mozilla Firefox\firefox.exe" (
    start "" "%ProgramFiles(x86)%\Mozilla Firefox\firefox.exe" about:addons
    exit /b 0
  )
)

REM Fallback: si el navegador elegido no se encuentra, busca otros
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --new-window chrome://extensions/
  exit /b 0
)

if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --new-window chrome://extensions/
  exit /b 0
)

if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --new-window edge://extensions/
  exit /b 0
)

if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --new-window edge://extensions/
  exit /b 0
)

if exist "%ProgramFiles%\Mozilla Firefox\firefox.exe" (
  start "" "%ProgramFiles%\Mozilla Firefox\firefox.exe" about:addons
  exit /b 0
)

if exist "%ProgramFiles(x86)%\Mozilla Firefox\firefox.exe" (
  start "" "%ProgramFiles(x86)%\Mozilla Firefox\firefox.exe" about:addons
  exit /b 0
)

REM Si no se encuentra ningún navegador
echo.
echo No se detecto navegador compatible en el sistema.
echo Por favor, abra manualmente su navegador en la pagina de extensiones.
echo.
pause
exit /b 1
