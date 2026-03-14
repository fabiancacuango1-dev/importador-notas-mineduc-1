# GitHub Actions - Compilación Automática Setup.exe

Guía completa para activar la compilación automática de tu Setup.exe usando GitHub Actions en la nube.

## 📋 Prerrequisitos

- Repositorio en GitHub
- Tu proyecto con los archivos en `versión 1.3/`
- Cuenta de GitHub activa

## 🚀 Configuración Rápida

### Paso 1: Inicializar Git en tu proyecto

```bash
cd "/Path/To/importador-notas-mineduc"
git init
```

### Paso 2: Agregar cambios al repositorio

```bash
git add .
```

### Paso 3: Hacer el primer commit

```bash
git commit -m "Agrega configuración de GitHub Actions para compilación automática"
```

### Paso 4: Agregar rama remota a GitHub

Si aún no tienes el repositorio en GitHub:

1. Ve a https://github.com/new
2. Crea un nuevo repositorio llamado `importador-notas-mineduc`
3. Copia el URL del repositorio

Luego ejecuta:

```bash
git remote add origin https://github.com/TU_USUARIO/importador-notas-mineduc.git
git branch -M main
git push -u origin main
```

### Paso 5: Verificar que los archivos están en GitHub

Abre tu repositorio en github.com y verifica que ves:
- `.github/workflows/build.yml` ← El workflow de compilación
- `versión 1.3/setup.iss` ← Tu script de instalación
- `versión 1.3/extension/` ← Tu extensión compilada

## ✅ Activar la Compilación Automática

### Opción A: Automático (Recomendado)

El workflow se ejecuta **automáticamente** cuando:

1. **Haces push a GitHub**
   ```bash
   git add .
   git commit -m "Actualizaciones"
   git push
   ```

2. **GitHub Actions se ejecuta automáticamente**
   - Crea una VM Windows
   - Instala Inno Setup
   - Compila Setup.exe
   - Genera artifacts descargables

### Opción B: Manual desde GitHub

1. Ve a tu repositorio en GitHub
2. Haz clic en **"Actions"** en la barra superior
3. Selecciona **"Build Setup.exe - Importador de Notas Mineduc"**
4. Haz clic en **"Run workflow"**
5. Espera a que se complete

## 📥 Descargar Setup.exe Compilado

### Desde GitHub Actions: 

1. Abre tu repositorio en GitHub
2. Ve a **"Actions"** en la barra superior
3. Haz clic en el último workflow exitoso
4. En la sección **"Artifacts"** verás:
   - `ImportadorNotas-Setup-v1.3.0` (carpeta descargable)
5. Haz clic para descargar

### Contenido del artifact:

```
ImportadorNotas-Setup-v1.3.0.zip
└── ImportadorNotas_Setup_v1.3.0.exe  ← El instalador compilado
```

## 🔄 Flujo Completo de Uso

### 1. Trabaja en tu proyecto (en Mac):

```bash
# Editar archivos
echo "cambios" >> versión\ 1.3/setup.iss
```

### 2. Sube los cambios a GitHub:

```bash
git add .
git commit -m "Descripción de cambios"
git push
```

### 3. GitHub Actions se ejecuta automáticamente:

- Verifica el repositorio
- Instala Inno Setup en Windows
- Compila setup.iss
- Genera Setup.exe
- Sube como artifact

### 4. Descarga el Setup.exe en unos minutos:

- Abre GitHub
- Actions → Último workflow
- Descarga el artifact

## 📊 Monitor del Workflow

### Ver estado de compilación:

1. Ve a **Actions** en tu repositorio
2. Verás todos los workflows con su estado:
   - 🟢 ✓ Exitoso
   - 🔴 ✗ Fallido
   - 🟡 ⏳ En progreso

### Leer logs detallados:

1. Haz clic en el workflow que quieras revisar
2. Haz clic en **"build-windows"**
3. Expande los pasos para ver detalles

## ⚠️ Troubleshooting

### Workflow falla con "Extension files not found"

**Problema:** La carpeta `versión 1.3/extension/` está vacía

**Solución:**
1. Copia los archivos compilados de tu extensión
2. Colócalos en `versión 1.3/extension/`
3. Asegúrate de incluir `manifest.json`
4. Haz push nuevamente

```bash
# Copiar archivos
cp -r installer/dist/extension/* "versión 1.3/extension/"

# Subir cambios
git add .
git commit -m "Agrega archivos compilados de extensión"
git push
```

### Workflow falla con "Inno Setup not found"

**Problema:** Inno Setup no se instaló correctamente

**Solución:** El workflow lo intenta de nuevo automáticamente. Si persiste:
1. Revisa el log del error
2. Contacta a soporte de GitHub Actions

### Setup.exe no se genera

**Problema:** Error en la compilación de `setup.iss`

**Solución:**
1. Verifica que `setup.iss` está en `versión 1.3/`
2. Compila localmente en Windows para detectar errores
3. Revisa el log del workflow en GitHub Actions

## 🔧 Personalización del Workflow

### Cambiar rama que activa compilación

En `.github/workflows/build.yml`, encuentra:

```yaml
on:
  push:
    branches: [ main, master, develop ]
```

Modifica para activar compilación solo en `main`:

```yaml
on:
  push:
    branches: [ main ]
```

### Cambiar tiempo de retención de artifacts

Encuentra:

```yaml
retention-days: 30
```

Cambia a otro número (30 días es el máximo gratuito):

```yaml
retention-days: 7
```

### Crear releases automáticas

Descomenta estas líneas (al final del archivo):

```yaml
# - name: Create GitHub Release
#   if: startsWith(github.ref, 'refs/tags/')
```

Así, cuando etiquetes un commit, se crea automáticamente un release con Setup.exe.

## 📝 Comandos Git Útiles

### Ver estado del repositorio:
```bash
git status
```

### Ver historial de commits:
```bash
git log --oneline
```

### Descartar cambios locales:
```bash
git checkout -- .
```

### Subir rama específica:
```bash
git push origin main
```

### Crear etiqueta para release:
```bash
git tag v1.3.0
git push origin v1.3.0
```

## 💡 Tips y Trucos

### 1. Compilación más rápida

Haz cambios pequeños y frecuentes:
```bash
git add archivo_específico.iss
git commit -m "Fix pequeño"
git push
```

### 2. Evitar compilaciones innecesarias

El workflow se ejecuta solo si hay cambios en:
- `versión 1.3/**`
- `.github/workflows/build.yml`

No se compila si cambias otros archivos.

### 3. Verificar antes de hacer push

Compila localmente en Windows primero para evitar fallos en GitHub.

### 4. Automatizar descargas

Puedes crear un script que descargue automáticamente el Setup.exe desde GitHub.

## 🎯 Resultado Final

Cuando todo esté configurado correctamente:

1. ✅ Haces `git push` desde Mac
2. ✅ GitHub Actions se ejecuta automáticamente
3. ✅ Crea VM Windows, instala Inno Setup
4. ✅ Compila tu Setup.exe en la nube
5. ✅ Descargas el archivo desde GitHub Actions
6. ✅ Distribuyes a tus usuarios

**¡Sin necesidad de tener Windows localmente!**

---

## 📚 Información Adicional

- [Documentación de GitHub Actions](https://docs.github.com/en/actions)
- [Marketplace de acciones](https://github.com/marketplace?type=actions)
- [Inno Setup Official](https://jrsoftware.org/)

---

¿Preguntas? Revisa los logs en GitHub Actions para diagnosticar problemas.
