/**
 * prepare-manifest.js
 * Genera un manifest.json limpio para distribución.
 * Elimina metadatos de desarrollo y ajusta rutas.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const DIST = path.resolve(ROOT, "installer", "dist", "extension");

const manifest = JSON.parse(
  fs.readFileSync(path.resolve(ROOT, "manifest.json"), "utf-8")
);

// Mantener solo los JS empaquetados (ya compilados por webpack)
manifest.content_scripts[0].js = [
  "sheetjs.min.js",
  "licenseGuard.js",
  "license.js",
  "activate.js",
  "paymentModal.js",
  "premiumUI.js",
  "formatHandler.js",
  "bulkUploader.js",
  "civicaAutoFill.js",
  "content.js",
];

// Asegurar version actualizada
const pkg = JSON.parse(
  fs.readFileSync(path.resolve(ROOT, "package.json"), "utf-8")
);
manifest.version = pkg.version || manifest.version;

// Eliminar key de desarrollo si existe
delete manifest.key;

// Escribir manifest limpio
if (!fs.existsSync(DIST)) {
  fs.mkdirSync(DIST, { recursive: true });
}

fs.writeFileSync(
  path.resolve(DIST, "manifest.json"),
  JSON.stringify(manifest, null, 2),
  "utf-8"
);

console.log("[prepare-manifest] manifest.json generado en dist/extension/");
console.log("[prepare-manifest] Version:", manifest.version);
