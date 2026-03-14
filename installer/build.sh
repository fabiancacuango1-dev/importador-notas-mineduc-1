#!/bin/bash
# ============================================================
# build.sh — Build de producción para Importador de Notas Mineduc
# Ejecutar desde la raíz del proyecto.
# Genera los archivos listos para empaquetar con Inno Setup en Windows.
# ============================================================

set -e

echo ""
echo "============================================"
echo "  BUILD DE PRODUCCION - Importador Notas"
echo "============================================"
echo ""

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js no encontrado. Instale Node.js 18+"
    exit 1
fi

# 1. Instalar dependencias de build
echo "[1/5] Instalando dependencias de build..."
npm install --save-dev webpack webpack-cli babel-loader @babel/core @babel/preset-env terser-webpack-plugin copy-webpack-plugin javascript-obfuscator webpack-obfuscator

# 2. Limpiar dist anterior
echo "[2/5] Limpiando directorio de salida..."
rm -rf installer/dist
mkdir -p installer/dist/extension

# 3. Ejecutar Webpack con ofuscación
echo "[3/5] Compilando y ofuscando JavaScript..."
npx webpack --config installer/webpack/webpack.prod.js

# 4. Preparar manifest.json limpio
echo "[4/5] Preparando manifest.json de distribución..."
node installer/scripts/prepare-manifest.js

# 5. Validar build
echo "[5/5] Validando integridad del build..."
node installer/scripts/validate-build.js

echo ""
echo "============================================"
echo "  BUILD COMPLETADO EXITOSAMENTE"
echo "============================================"
echo ""
echo "Archivos de la extensión: installer/dist/extension/"
echo ""
echo "SIGUIENTE PASO:"
echo "  Copie installer/ a una máquina Windows con Inno Setup 6 instalado"
echo "  y compile installer/inno-setup/setup.iss para generar el Setup.exe"
echo ""
