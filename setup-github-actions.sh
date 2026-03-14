#!/bin/bash
# setup-github-actions.sh
# Script automatizado para configurar GitHub Actions
# Uso: bash setup-github-actions.sh

echo "═══════════════════════════════════════════════════════════════"
echo "   GitHub Actions - Configuración Automática Setup.exe"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Verificar que estamos en la carpeta correcta
if [ ! -f "manifest.json" ] && [ ! -d "versión 1.3" ]; then
    echo "❌ Error: Este script debe ejecutarse en la raíz del proyecto"
    echo "Asegúrate de estar en: importador-notas-mineduc/"
    exit 1
fi

echo "✓ Carpeta correcta detectada"
echo ""

# Inicializar Git si no existe
if [ ! -d ".git" ]; then
    echo "📦 Inicializando Git..."
    git init
    echo "✓ Git inicializado"
    echo ""
fi

# Configurar usuario Git (opcional)
echo "📝 Configurar usuario Git (opcional)"
echo "Ingresa tu email de GitHub (presiona Enter para omitir):"
read email
if [ -n "$email" ]; then
    git config user.email "$email"
    echo "✓ Email configurado: $email"
fi

echo "Ingresa tu nombre (presiona Enter para omitir):"
read name
if [ -n "$name" ]; then
    git config user.name "$name"
    echo "✓ Nombre configurado: $name"
fi

echo ""

# Verificar archivos necesarios
echo "🔍 Verificando archivos necesarios..."

if [ -f ".github/workflows/build.yml" ]; then
    echo "✓ .github/workflows/build.yml encontrado"
else
    echo "❌ .github/workflows/build.yml NO encontrado"
    exit 1
fi

if [ -f "versión 1.3/setup.iss" ]; then
    echo "✓ versión 1.3/setup.iss encontrado"
else
    echo "❌ versión 1.3/setup.iss NO encontrado"
    exit 1
fi

if [ -d "versión 1.3/extension" ]; then
    if [ "$(ls -A versión\ 1.3/extension)" ]; then
        echo "✓ versión 1.3/extension contiene archivos"
    else
        echo "⚠ Advertencia: versión 1.3/extension está vacía"
        echo "  Asegúrate de copiar los archivos compilados de tu extensión"
    fi
else
    echo "❌ versión 1.3/extension NO encontrado"
    exit 1
fi

echo ""

# Agregar cambios
echo "📤 Agregando cambios a Git..."
git add .
echo "✓ Cambios agregados"

echo ""

# Crear commit
echo "💬 Creando commit..."
git commit -m "Agrega configuración de GitHub Actions para compilación automática de Setup.exe"
echo "✓ Commit creado"

echo ""

# Información sobre remote
echo "═══════════════════════════════════════════════════════════════"
echo "   SIGUIENTE PASO: Conectar a GitHub"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "1. Ve a https://github.com/new"
echo "2. Crea un nuevo repositorio llamado: importador-notas-mineduc"
echo "3. Selecciona configuración pública o privada"
echo "4. NO inicialices con README (ya tienes archivos)"
echo "5. Copia el URL del repositorio"
echo ""
echo "Luego ejecuta los siguientes comandos:"
echo ""
echo "  git remote add origin https://github.com/TU_USUARIO/importador-notas-mineduc.git"
echo "  git branch -M main"
echo "  git push -u origin main"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
