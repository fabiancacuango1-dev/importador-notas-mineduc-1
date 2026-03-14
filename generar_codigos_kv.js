#!/usr/bin/env node
/**
 * generar_codigos_kv.js
 * Genera códigos de licencia via la API del Worker.
 *
 * Uso:
 *   node generar_codigos_kv.js          → genera 50 códigos (default)
 *   node generar_codigos_kv.js 100      → genera 100 códigos
 *   node generar_codigos_kv.js --list   → lista códigos existentes
 *
 * No requiere wrangler CLI. Solo necesita acceso a internet.
 */

const fs = require("fs");
const path = require("path");

const API_BASE = "https://mineduc-license-api.fabiancacuango1.workers.dev";
const ADMIN_KEY = "mineduc-admin-2026";

async function generateCodes(count) {
  console.log(`Generando ${count} códigos de licencia via Worker API...\n`);

  const BATCH_SIZE = 100;
  const allCodes = [];
  const totalBatches = Math.ceil(count / BATCH_SIZE);

  for (let batch = 0; batch < totalBatches; batch++) {
    const batchCount = Math.min(BATCH_SIZE, count - allCodes.length);
    process.stdout.write(`  Lote ${batch + 1}/${totalBatches} (${batchCount} códigos)...`);

    const resp = await fetch(`${API_BASE}/licenses/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: batchCount, admin_key: ADMIN_KEY })
    });

    const data = await resp.json();
    if (!data.success) {
      console.error("\nError:", data.error);
      process.exit(1);
    }

    allCodes.push(...data.codes);
    console.log(` ✅ (${allCodes.length}/${count} total)`);
  }

  console.log(`\n✅ ${allCodes.length} códigos generados`);

  const backupFile = path.join(__dirname, `codigos_licencia_${Date.now()}.txt`);
  fs.writeFileSync(backupFile, allCodes.join("\n") + "\n", "utf-8");
  console.log(`📄 Backup guardado en: ${backupFile}`);
  console.log("\nComparte estos códigos por WhatsApp a los compradores.");
}

async function listCodes() {
  console.log("Listando códigos en KV...\n");

  const resp = await fetch(`${API_BASE}/licenses/list?admin_key=${ADMIN_KEY}`, { method: "GET" });
  const data = await resp.json();

  if (!data.success) {
    console.error("Error:", data.error);
    process.exit(1);
  }

  if (data.total === 0) {
    console.log("No hay códigos generados aún.");
    return;
  }

  const available = data.codes.filter(c => !c.used);
  const used = data.codes.filter(c => c.used);

  console.log("Disponibles:");
  available.forEach(c => console.log(`  🟢 ${c.code}`));
  if (used.length) {
    console.log("\nUsados:");
    used.forEach(c => console.log(`  🔴 ${c.code} → ${c.usedBy}`));
  }
  console.log(`\nTotal: ${data.total} (${available.length} disponibles, ${used.length} usados)`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--list")) {
    await listCodes();
  } else {
    const count = parseInt(args[0]) || 50;
    await generateCodes(count);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
