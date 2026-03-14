/**
 * generarLicencias.js — Script Node.js para generar 1000 códigos de licencia
 * y subirlos automáticamente a Firebase Firestore.
 *
 * Importador de Notas Mineduc
 *
 * Uso:
 *   npm install firebase-admin
 *   node generarLicencias.js
 *
 * O para generar una cantidad personalizada:
 *   node generarLicencias.js 500
 *
 * Cada licencia en Firestore tendrá:
 *   codigo            — Código único (ej. "MINEDUC-A1B2C3D4E5F6")
 *   estado            — "disponible"
 *   machine_id        — "" (vacío hasta que se active)
 *   usuario           — "" (vacío hasta que se active)
 *   fecha_activacion  — "" (vacío hasta que se active)
 */

const admin = require("firebase-admin");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// ─── CONFIGURACIÓN DE FIREBASE ───────────────────────────
// Descarga tu clave de servicio desde:
// Firebase Console → Configuración → Cuentas de servicio → Generar nueva clave privada
// Guarda el archivo como "serviceAccountKey.json" en este directorio.

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "serviceAccountKey.json");

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error("═══════════════════════════════════════════════════════");
  console.error("  ERROR: No se encontró serviceAccountKey.json");
  console.error("");
  console.error("  1. Ve a Firebase Console → Configuración del proyecto");
  console.error("  2. Pestaña 'Cuentas de servicio'");
  console.error("  3. Haz clic en 'Generar nueva clave privada'");
  console.error("  4. Guarda el archivo como 'serviceAccountKey.json'");
  console.error("     en la misma carpeta que este script.");
  console.error("═══════════════════════════════════════════════════════");
  process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const COLECCION = "licencias";

// ─── GENERADOR DE CÓDIGOS ÚNICOS ────────────────────────
// Formato: MINEDUC-XXXXXXXXXXXX (12 caracteres alfanuméricos)

function generarCodigoUnico() {
  const bytes = crypto.randomBytes(9);
  const codigo = bytes
    .toString("base64")
    .replace(/[^A-Z0-9]/gi, "")
    .substring(0, 12)
    .toUpperCase();
  return "MINEDUC-" + codigo;
}

function generarCodigosUnicos(cantidad) {
  const codigos = new Set();
  while (codigos.size < cantidad) {
    codigos.add(generarCodigoUnico());
  }
  return Array.from(codigos);
}

// ─── SUBIR LICENCIAS A FIRESTORE ─────────────────────────
// Firestore permite máximo 500 operaciones por batch.

async function subirLicencias(codigos) {
  const BATCH_SIZE = 400; // Margen de seguridad bajo el límite de 500
  let totalSubidos = 0;
  let totalErrores = 0;

  console.log(`\nSubiendo ${codigos.length} licencias a Firestore...`);
  console.log(`Colección: "${COLECCION}"`);
  console.log(`Batches necesarios: ${Math.ceil(codigos.length / BATCH_SIZE)}\n`);

  for (let i = 0; i < codigos.length; i += BATCH_SIZE) {
    const lote = codigos.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const codigo of lote) {
      const docRef = db.collection(COLECCION).doc();
      batch.set(docRef, {
        codigo: codigo,
        estado: "disponible",
        machine_id: "",
        usuario: "",
        fecha_activacion: ""
      });
    }

    try {
      await batch.commit();
      totalSubidos += lote.length;
      const progreso = Math.round((totalSubidos / codigos.length) * 100);
      console.log(`  ✓ Batch ${Math.ceil((i + 1) / BATCH_SIZE)}: ${lote.length} licencias subidas (${progreso}%)`);
    } catch (error) {
      totalErrores += lote.length;
      console.error(`  ✗ Error en batch ${Math.ceil((i + 1) / BATCH_SIZE)}:`, error.message);
    }
  }

  return { totalSubidos, totalErrores };
}

// ─── EJECUCIÓN PRINCIPAL ─────────────────────────────────

async function main() {
  const cantidad = parseInt(process.argv[2] || "1000", 10);

  if (isNaN(cantidad) || cantidad < 1 || cantidad > 10000) {
    console.error("Cantidad inválida. Usa un número entre 1 y 10000.");
    process.exit(1);
  }

  console.log("═══════════════════════════════════════════════════════");
  console.log("  GENERADOR DE LICENCIAS — Importador de Notas Mineduc");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`\nGenerando ${cantidad} códigos únicos...`);

  const codigos = generarCodigosUnicos(cantidad);
  console.log(`✓ ${codigos.length} códigos generados.`);

  // Guardar copia local en texto
  const archivoLocal = `licencias_generadas_${Date.now()}.txt`;
  fs.writeFileSync(archivoLocal, codigos.join("\n"), "utf-8");
  console.log(`✓ Copia local guardada en: ${archivoLocal}`);

  // Subir a Firestore
  const resultado = await subirLicencias(codigos);

  console.log("\n═══════════════════════════════════════════════════════");
  console.log(`  RESULTADO:`);
  console.log(`  ✓ Subidas correctamente: ${resultado.totalSubidos}`);
  if (resultado.totalErrores > 0) {
    console.log(`  ✗ Errores: ${resultado.totalErrores}`);
  }
  console.log("═══════════════════════════════════════════════════════");

  // Mostrar primeros 5 códigos como ejemplo
  console.log("\nPrimeros 5 códigos generados:");
  codigos.slice(0, 5).forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
  console.log(`  ... y ${codigos.length - 5} más en ${archivoLocal}`);

  process.exit(0);
}

main().catch(err => {
  console.error("Error fatal:", err);
  process.exit(1);
});
