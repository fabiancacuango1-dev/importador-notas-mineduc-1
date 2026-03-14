@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion
title Importador de Notas Mineduc - Desinstalador
color 0C

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║   IMPORTADOR DE NOTAS MINEDUC - Desinstalador           ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.
echo  Esto eliminara la extension y todos sus archivos.
echo.
set /p "CONFIRM=  Desea continuar? (S/N): "
if /I not "%CONFIRM%"=="S" (
    echo  Desinstalacion cancelada.
    pause
    exit /b 0
)

echo.
echo  [1/3] Eliminando registros de extension en navegadores...

:: Chrome
set "CHROME_JSON=%LOCALAPPDATA%\Google\Chrome\User Data\External Extensions\importador-notas-mineduc.json"
if exist "%CHROME_JSON%" (
    del /F /Q "%CHROME_JSON%"
    echo         [OK] Registro de Chrome eliminado
)

:: Edge
set "EDGE_JSON=%LOCALAPPDATA%\Microsoft\Edge\User Data\External Extensions\importador-notas-mineduc.json"
if exist "%EDGE_JSON%" (
    del /F /Q "%EDGE_JSON%"
    echo         [OK] Registro de Edge eliminado
)

:: Brave
set "BRAVE_JSON=%LOCALAPPDATA%\BraveSoftware\Brave-Browser\User Data\External Extensions\importador-notas-mineduc.json"
if exist "%BRAVE_JSON%" (
    del /F /Q "%BRAVE_JSON%"
    echo         [OK] Registro de Brave eliminado
)

echo  [2/3] Eliminando archivos de la extension...
set "INSTALL_DIR=%LOCALAPPDATA%\ImportadorNotasMineduc"
if exist "%INSTALL_DIR%" (
    rmdir /S /Q "%INSTALL_DIR%"
    echo         [OK] Archivos eliminados
) else (
    echo         No se encontro la carpeta de instalacion.
)

echo  [3/3] Limpieza completada.
echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║   DESINSTALACION COMPLETADA                             ║
echo  ║                                                         ║
echo  ║   Reinicie su navegador para que los cambios            ║
echo  ║   surtan efecto.                                        ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.
pause
exit /b 0
