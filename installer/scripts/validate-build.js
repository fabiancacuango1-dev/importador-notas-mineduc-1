/**
 * validate-build.js
 * Verifica que el build de producción esté completo y no contenga código fuente expuesto.
 */
const fs = require("fs");
const path = require("path");

const DIST = path.resolve(__dirname, "..", "dist", "extension");

const REQUIRED_FILES = [
  "manifest.json",
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
  "popup.js",
  "popup.html",
  "style.css",
];

// Patrones que NO deben aparecer en los JS compilados
const FORBIDDEN_PATTERNS = [
  /\/\/ ─── /,                    // Comentarios de desarrollo
  /console\.log\(\s*"DEBUG/i,     // Logs de debug
  /ADMIN_KEY/i,                   // Claves admin expuestas
  /admin-2026/i,                  // Secretos hardcoded
  /sourceMappingURL/,             // Source maps
];

let errors = 0;

console.log("=== Validando build de producción ===\n");

// 1. Verificar que existen todos los archivos
for (const file of REQUIRED_FILES) {
  const filePath = path.resolve(DIST, file);
  if (!fs.existsSync(filePath)) {
    console.error(`  ✗ FALTA: ${file}`);
    errors++;
  } else {
    const stats = fs.statSync(filePath);
    console.log(`  ✓ ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
  }
}

// 2. Verificar manifest.json válido
try {
  const manifest = JSON.parse(
    fs.readFileSync(path.resolve(DIST, "manifest.json"), "utf-8")
  );
  if (manifest.manifest_version !== 3) {
    console.error("  ✗ manifest_version debe ser 3");
    errors++;
  }
  if (manifest.key) {
    console.error("  ✗ manifest.json contiene 'key' de desarrollo");
    errors++;
  }
  console.log(`  ✓ manifest.json válido (v${manifest.version})`);
} catch (e) {
  console.error("  ✗ manifest.json inválido:", e.message);
  errors++;
}

// 3. Verificar que no hay patrones prohibidos en JS compilados
const jsFiles = REQUIRED_FILES.filter(
  (f) => f.endsWith(".js") && f !== "sheetjs.min.js"
);

for (const file of jsFiles) {
  const filePath = path.resolve(DIST, file);
  if (!fs.existsSync(filePath)) continue;

  const content = fs.readFileSync(filePath, "utf-8");

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(content)) {
      console.error(
        `  ✗ PATRÓN PROHIBIDO en ${file}: ${pattern.toString()}`
      );
      errors++;
    }
  }

  // Verificar que el archivo fue ofuscado (debe contener strings codificadas)
  if (content.length < 500) {
    console.warn(`  ⚠ ${file} parece muy pequeño (${content.length} chars)`);
  }
}

// 4. Verificar que no hay source maps
const distFiles = fs.readdirSync(DIST);
for (const file of distFiles) {
  if (file.endsWith(".map")) {
    console.error(`  ✗ SOURCE MAP encontrado: ${file}`);
    errors++;
  }
}

console.log("\n" + "=".repeat(40));
if (errors > 0) {
  console.error(`\n✗ Build INVÁLIDO — ${errors} error(es) encontrados.`);
  process.exit(1);
} else {
  console.log("\n✓ Build VÁLIDO — listo para empaquetar con Inno Setup.");
  process.exit(0);
}
