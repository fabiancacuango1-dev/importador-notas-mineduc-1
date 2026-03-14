# Instalador Importador de Notas Mineduc v1.3

Proyecto completo del instalador profesional para la extensión Importador de Notas Mineduc, con activación guiada y detección automática de navegadores.

## Contenido de esta carpeta

```
versión 1.3/
├── setup.iss                    ← Script principal de Inno Setup (ARCHIVO IMPORTANTE)
├── scripts/
│   └── activar_extension.cmd    ← Script para abrir extensiones desde menú Inicio
├── extension/                   ← Carpeta donde debe ir tu extensión compilada (VACÍA)
├── output/                      ← Carpeta donde se generará el Setup.exe compilado (VACÍA)
├── README.md                    ← Este archivo
├── COMPILACION.md               ← Instrucciones detalladas para compilar
└── BUILD.bat                    ← Script de compilación automática (opcional)
```

## Requisitos

### Para compilar el instalador:
- **Windows 7, 8, 10 u 11** (32 bits o 64 bits)
- **Inno Setup 6 o superior** → https://jrsoftware.org/isdl.php

### Para probar el instalador:
- Cualquier computadora con Windows
- Un navegador: Chrome, Edge o Firefox

## Instalación Rápida

### 1. Prepara la extensión

Copia todos los archivos de tu extensión compilada en la carpeta `extension/`:

```
extension/
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.js
├── style.css
├── icons/
└── (otros archivos necesarios)
```

### 2. Compila el instalador

**Opción A - Interfaz gráfica (más fácil):**
- Abre Inno Setup
- Abre el archivo `setup.iss`
- Presiona F9 o ve a Build → Compile

**Opción B - Línea de comandos:**
```batch
"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" setup.iss
```

### 3. Resultado

El archivo `Setup.exe` se generará en la carpeta `output/` y estará listo para distribuir.

## Características del Instalador

✓ **Detección automática de navegadores** — Chrome, Edge, Firefox  
✓ **Ventana de selección de navegador** — Solo muestra opciones detectadas  
✓ **Apertura automática** — chrome://extensions, edge://extensions, about:addons  
✓ **Instrucciones guiadas** — Pasos claros para activar la extensión  
✓ **Acceso directo en menú Inicio** — "Activar extensión"  
✓ **Código de licencia pre-configurado** — Soporte integrado  
✓ **Compatible con antivirus** — Sin comportamientos sospechosos  
✓ **Windows 7-11** — Soporte para 32 y 64 bits  

## Personalización

Para cambiar detalles del instalador, edita `setup.iss`:

| Línea | Elemento | Ejemplo |
|-------|----------|---------|
| 9 | Nombre de la app | `Importador de Notas Mineduc` |
| 10 | Versión | `1.3.0` |
| 11 | Editorial | `Mineduc Tools` |
| 28-32 | Mensajes en español | Modificar textos |

Lee los comentarios en `setup.iss` para entender cada sección.

## Archivos Principales

### setup.iss
Script de Inno Setup que:
- Define los parámetros del instalador
- Detecta navegadores
- Crea la interfaz de selección
- Maneja la activación de la extensión

### activar_extension.cmd
Script batch que:
- Lee el navegador elegido durante la instalación
- Abre la página de extensiones correspondiente
- Proporciona fallback si el navegador no está disponible

## Solución de Problemas

### El Setup.exe no se genera
- Verifica que tienes Inno Setup 6 instalado
- Comprueba que todos los archivos están en el lugar correcto
- Mira los errores en la consola de compilación

### La extensión no aparece en el instalador
- Asegúrate de copiar los archivos en `extension/`
- Verifica que `manifest.json` existe
- No dejes la carpeta vacía

### El navegador no abre automáticamente después de instalar
- El usuario puede usar el acceso directo "Activar extensión"
- Algunos antivirus pueden bloquear esto
- Comprueba que el navegador está instalado en rutas estándar

## Siguiente Paso

1. **Copia tu extensión compilada** en la carpeta `extension/`
2. **Lee `COMPILACION.md`** para instrucciones detalladas
3. **Compila el instalador** usando Inno Setup
4. **Prueba el Setup.exe** en una máquina Windows
5. **Distribuye a tus usuarios**

## Licencia

Este instalador es parte del proyecto Importador de Notas Mineduc.

---

**Versión:** 1.3  
**Última actualización:** Marzo 2026  
**Creado con:** Inno Setup 6+
