# Referencia Rápida - Comandos Git para GitHub Actions

Guía de bolsillo con los comandos Git más usados.

## 📥 Configuración Inicial (Una sola vez)

### Inicializar Git
```bash
git init
```

### Configurar identidad
```bash
git config user.email "tu@email.com"
git config user.name "Tu Nombre"
```

### Agregar repositorio remoto
```bash
git remote add origin https://github.com/TU_USUARIO/importador-notas-mineduc.git
```

### Cambiar rama a main
```bash
git branch -M main
```

### Hacer primer push
```bash
git push -u origin main
```

---

## 📤 Operaciones Diarias

### Ver cambios sin guardar
```bash
git status
```

### Agregar todos los cambios
```bash
git add .
```

### Agregar archivo específico
```bash
git add "versión 1.3/setup.iss"
```

### Crear commit
```bash
git commit -m "Descripción de cambios"
```

### Subir cambios a GitHub
```bash
git push
```

### Ver historial de commits
```bash
git log --oneline
```

### Ver cambios antes de agregar
```bash
git diff
```

---

## 🔄 Activar GitHub Actions

### Opción 1: Push automático (Recomendado)
```bash
git add .
git commit -m "Cambios"
git push
# → GitHub Actions se ejecuta automáticamente
```

### Opción 2: Desde GitHub manualmente
1. Ve a tu repositorio en github.com
2. Actions → Latest workflow → Run workflow

---

## 📥 Descargar Setup.exe

1. Ve a tu repositorio en GitHub
2. Actions → Haz clic en el último workflow exitoso
3. En "Artifacts", descarga: `ImportadorNotas-Setup-v1.3.0`
4. Extrae el .zip y obtén Setup.exe

---

## ⚙️ Operaciones Avanzadas

### Descartar cambios locales
```bash
git checkout -- .
```

### Descartar cambios de un archivo
```bash
git checkout -- "archivo.iss"
```

### Revertir último commit (sin eliminar cambios)
```bash
git reset --soft HEAD~1
```

### Crear rama nueva
```bash
git checkout -b feature/nueva-rama
```

### Cambiar a rama
```bash
git checkout main
```

### Listar ramas
```bash
git branch
```

### Eliminar rama local
```bash
git branch -d nombre-rama
```

### Hacer commit amend (corregir último commit)
```bash
git commit --amend --no-edit
```

---

## 🏷️ Crear Releases

### Crear etiqueta (release)
```bash
git tag v1.3.0
git push origin v1.3.0
```

### Listar etiquetas
```bash
git tag -l
```

### Eliminar etiqueta local
```bash
git tag -d v1.3.0
```

---

## 🔍 Diagnosticar Problemas

### Ver remotes configurados
```bash
git remote -v
```

### Ver log completo
```bash
git log
```

### Ver cambios del último commit
```bash
git show
```

### Comparar ramas
```bash
git diff main origin/main
```

### Ver quién hizo cambios en una línea
```bash
git blame "versión 1.3/setup.iss"
```

---

## ⚡ Flujo Rápido Diario

```bash
# 1. Hacer cambios en tus archivos
# 2. Verificar estado
git status

# 3. Agregar cambios
git add .

# 4. Crear commit con descripción clara
git commit -m "Fix navegador Edge en página de extensiones"

# 5. Subir a GitHub
git push

# 6. ¡Listo! GitHub Actions se ejecuta automáticamente
```

---

## 💡 Tips

- Haz commits pequeños y frecuentes
- Usa mensajes descriptivos en commits
- Revisa el estado con `git status` antes de cada operación
- Usa `git diff` para revisar cambios antes de agregar
- Revisa los logs de GitHub Actions para diagnosticar fallos

---

## 🚨 Errores Comunes

### "fatal: not a git repository"
```bash
✓ Solución: Ejecuta git init en la carpeta del proyecto
```

### "Your branch is ahead of 'origin/main'"
```bash
✓ Solución: Ejecuta git push para sincronizar
```

### "Certificate problem: unable to get local issuer certificate"
```bash
✓ Solución: Configura Git para ignorar SSL (no recomendado)
git config --global http.sslVerify false
```

### "fatal: remote origin already exists"
```bash
✓ Solución: Primero elimina remote y agrega de nuevo
git remote remove origin
git remote add origin https://...
```

---

**¿Necesitas ayuda?** Consulta GitHub Docs: https://docs.github.com/en/get-started/using-git
