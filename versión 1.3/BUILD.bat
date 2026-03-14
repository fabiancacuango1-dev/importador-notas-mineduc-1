@echo off
REM ============================================================
REM BUILD.bat — Compilador automático del instalador
REM Compila setup.iss y genera Setup.exe
REM ============================================================

setlocal enabledelayedexpansion

echo.
echo ========================================================
echo   COMPILADOR - Importador de Notas Mineduc v1.3
echo ========================================================
echo.

REM Detectar ruta de Inno Setup
set "ISCC="
set "INNO_PATHS[0]=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
set "INNO_PATHS[1]=C:\Program Files\Inno Setup 6\ISCC.exe"
set "INNO_PATHS[2]=C:\Program Files (x86)\Inno Setup 5\ISCC.exe"
set "INNO_PATHS[3]=C:\Program Files\Inno Setup 5\ISCC.exe"

for /l %%i in (0,1,3) do (
  if exist "!INNO_PATHS[%%i]!" (
    set "ISCC=!INNO_PATHS[%%i]!"
    goto :found
  )
)

:found
if "%ISCC%"=="" (
  echo ERROR: No se encontro Inno Setup 6 instalado.
  echo.
  echo Descarga e instala desde: https://jrsoftware.org/isdl.php
  echo.
  pause
  exit /b 1
)

echo Inno Setup encontrado: %ISCC%
echo.

REM Verificar que setup.iss existe
if not exist "setup.iss" (
  echo ERROR: No se encuentra setup.iss en esta carpeta.
  echo Asegurate de ejecutar BUILD.bat desde la carpeta correcta.
  echo.
  pause
  exit /b 1
)

REM Verificar que la carpeta extension no esté vacía
if not exist "extension\manifest.json" (
  echo ADVERTENCIA: No se encuentra extension\manifest.json
  echo Copia los archivos compilados de tu extension en la carpeta 'extension'
  echo.
  pause
)

REM Compilar
echo Compilando setup.iss...
echo.

"%ISCC%" setup.iss

if %ERRORLEVEL% EQU 0 (
  echo.
  echo ========================================================
  echo   COMPILACION EXITOSA
  echo ========================================================
  echo.
  echo El archivo Setup.exe se genero en: output\
  echo.
  pause
  exit /b 0
) else (
  echo.
  echo ========================================================
  echo   ERROR EN LA COMPILACION
  echo ========================================================
  echo.
  echo Revisa los errores arriba y soluciona los problemas.
  echo.
  pause
  exit /b 1
)
