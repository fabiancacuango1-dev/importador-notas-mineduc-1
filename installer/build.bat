@echo off
REM ============================================================
REM build.bat — Build de producción para Importador de Notas Mineduc
REM Ejecutar desde la raíz del proyecto en Windows.
REM ============================================================

echo.
echo ============================================
echo   BUILD DE PRODUCCION - Importador Notas
echo ============================================
echo.

REM Verificar Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js no encontrado. Instale Node.js 18+
    exit /b 1
)

REM 1. Instalar dependencias de build
echo [1/5] Instalando dependencias de build...
call npm install --save-dev webpack webpack-cli babel-loader @babel/core @babel/preset-env terser-webpack-plugin copy-webpack-plugin javascript-obfuscator webpack-obfuscator
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Fallo al instalar dependencias.
    exit /b 1
)

REM 2. Limpiar dist anterior
echo [2/5] Limpiando directorio de salida...
if exist installer\dist rmdir /s /q installer\dist
mkdir installer\dist\extension

REM 3. Ejecutar Webpack con ofuscación
echo [3/5] Compilando y ofuscando JavaScript...
call npx webpack --config installer\webpack\webpack.prod.js
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Webpack fallo. Revise los errores arriba.
    exit /b 1
)

REM 4. Preparar manifest.json limpio
echo [4/5] Preparando manifest.json de distribución...
node installer\scripts\prepare-manifest.js
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: prepare-manifest.js fallo.
    exit /b 1
)

REM 5. Validar build
echo [5/5] Validando integridad del build...
node installer\scripts\validate-build.js
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Validación fallida. El build no es seguro para distribución.
    exit /b 1
)

echo.
echo ============================================
echo   BUILD COMPLETADO EXITOSAMENTE
echo ============================================
echo.
echo Archivos de la extensión: installer\dist\extension\
echo.
echo SIGUIENTE PASO:
echo   Abra installer\inno-setup\setup.iss con Inno Setup
echo   y compile para generar el Setup.exe
echo.
echo   O ejecute desde línea de comandos:
echo   "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer\inno-setup\setup.iss
echo.

pause
