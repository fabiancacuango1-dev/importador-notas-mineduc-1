# Sistema de Distribución Comercial — Importador de Notas Mineduc

## Estructura del Proyecto

```
installer/
├── README.md                    # Este archivo
├── SECURITY_GUIDE.md            # Guía anti-ingeniería inversa
├── build.bat                    # Script principal de build (Windows)
├── build.sh                     # Script principal de build (macOS/Linux → genera .bat)
├── inno-setup/
│   └── setup.iss                # Script Inno Setup para crear Setup.exe
├── webpack/
│   └── webpack.prod.js          # Webpack + ofuscación para producción
├── scripts/
│   ├── obfuscate.js             # Script de ofuscación post-webpack
│   ├── prepare-manifest.js      # Prepara manifest.json para distribución
│   └── validate-build.js        # Valida integridad del build
└── dist/                        # (generado) Extension empaquetada lista
```

## Flujo de Build

1. `npm run build:prod` → Webpack empaqueta + ofusca JS
2. `npm run build:prepare` → Copia assets, genera manifest limpio
3. `npm run build:validate` → Verifica integridad del paquete
4. Compilar `installer/inno-setup/setup.iss` con Inno Setup → `Setup.exe`

## Requisitos

- Node.js 18+
- npm 9+
- [Inno Setup 6+](https://jrsoftware.org/isdl.php) (solo Windows, para generar .exe)
- Windows 10+ para compilar el instalador final
