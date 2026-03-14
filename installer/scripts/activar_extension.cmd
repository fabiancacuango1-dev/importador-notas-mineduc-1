@echo off
setlocal
set "APPDIR=%~dp0"
set "EXTDIR=%APPDIR%extension"
set "BROWSER="

if exist "%APPDIR%browser_choice.txt" (
  set /p BROWSER=<"%APPDIR%browser_choice.txt"
)

if not exist "%EXTDIR%\manifest.json" (
  echo No se encontro la extension en %EXTDIR%
  pause
  exit /b 1
)

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

echo No se detecto navegador compatible.
echo Abra manualmente su navegador en la pagina de extensiones.
pause
exit /b 1
