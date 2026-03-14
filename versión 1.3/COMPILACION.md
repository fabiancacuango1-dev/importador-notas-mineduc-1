# Compilación del Instalador — Importador de Notas Mineduc v1.3

## Requisitos Previos

1. **Windows 7, 8, 10 u 11** (32 bits o 64 bits)
2. **Inno Setup 6 o superior** — Descarga desde: https://jrsoftware.org/isdl.php
3. **Los archivos de la extensión** compilados en la carpeta `extension/`

## Preparación de Archivos

### Estructura de carpetas necesaria:

```
versión 1.3/
├── setup.iss              ← Script de instalación (este archivo)
├── scripts/
│   └── activar_extension.cmd
├── extension/             ← Copia aquí los archivos compilados de tu extensión
│   ├── manifest.json
│   ├── background.js
│   ├── content.js
│   ├── popup.html
│   ├── popup.js
│   ├── style.css
│   ├── icons/
│   └── (otros archivos de tu extensión)
└── output/                ← Aquí se guardará el Setup.exe compilado
```

## Pasos para Compilar

### Opción 1: Interfaz Gráfica de Inno Setup (Recomendado)

1. **Abre Inno Setup** (busca "Inno Setup Compiler" en el menú Inicio)
2. **Haz clic en "File" → "Open"**
3. **Selecciona el archivo `setup.iss`** de esta carpeta
4. **Haz clic en "Build" → "Compile"** (o presiona `F9`)
5. **Espera a que finalice la compilación**
6. **El archivo `Setup.exe` se generará en la carpeta `output/`**

### Opción 2: Línea de Comandos (Avanzado)

Abre la terminal (CMD o PowerShell) en esta carpeta y ejecuta:

```batch
"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" setup.iss
```

**Nota:** Si instalaste Inno Setup en otra ubicación, ajusta la ruta.

## Después de la Compilación

1. **El archivo `Setup.exe` estará en la carpeta `output/`**
2. **Prueba el instalador en una máquina Windows** para verificar que:
   - Detecta correctamente los navegadores
   - La página de selección de navegador funciona
   - El navegador abre automáticamente en la página de extensiones
   - Las instrucciones se muestran correctamente
   - El acceso directo "Activar extensión" aparece en el menú Inicio

## Troubleshooting

### Error: "ISCC.exe no encontrado"

- Verifica que Inno Setup 6+ esté instalado
- Si está en otra carpeta, usa la ruta completa
- En la interfaz gráfica, simplemente abre el archivo .iss

### La extensión no se ve en la carpeta `extension/`

- Copia todos los archivos de tu extensión compilada en la carpeta `extension/`
- Asegúrate de que `manifest.json` está presente
- No dejes la carpeta `extension/` vacía

### El navegador no abre automáticamente

- Comprobé que está instalado en las rutas estándar
- Algunos antivirus pueden bloquear la apertura automática
- Los usuarios siempre pueden usar el acceso directo "Activar extensión" del menú Inicio

## Personalización

Puedes editar `setup.iss` para:

- Cambiar el nombre de la aplicación (línea 9)
- Cambiar la versión (línea 10)
- Modificar los mensajes en español (línea 28-32)
- Ajustar rutas o permisos (línea 34)

## Distribución del Instalador

1. **Sube el archivo `Setup.exe`** a tu página web
2. **Los usuarios lo descargan y ejecutan**
3. **Seleccionan su navegador**
4. **Se abre automáticamente la página de extensiones**
5. **Siguen las instrucciones para cargar la extensión**

---

¿Necesitas ayuda? Contacta al equipo de desarrollo.
