/**
 * civicaAutoFill.js
 * Automatiza el llenado de habilidades para el formato Civica.
 * Flujo real del sistema educarecuador:
 *   1. Página con lista de estudiantes → clic en "Seleccionar"
 *   2. Página de habilidades del estudiante → llenar 9 selects
 *   3. Guardar → confirmar "Sí, guardar"
 *   4. Volver a lista → siguiente estudiante → paginar
 */
const CivicaAutoFill = (() => {
  const CIVICA_VALUES = ["SIEMPRE", "FRECUENTEMENTE", "OCASIONALMENTE", "NUNCA"];

  const KNOWN_SKILLS = [
    "AUTOCONOCIMIENTO",
    "PENSAMIENTO CRITICO",
    "MANEJO DE PROBLEMAS",
    "TOMA DE DECISIONES",
    "TRABAJO EN EQUIPO",
    "EMPATIA",
    "MANEJO DE CONFLICTOS",
    "COMUNICACION EFECTIVA",
    "COMUNICACION ASERTIVA",
    "COMUNICACION EFECTIVA/ASERTIVA",
    "MANEJO DE EMOCIONES Y SENTIMIENTOS",
    "MANEJO DE EMOCIONES"
  ];

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalizeSkillText(text) {
    return cleanText(text).toUpperCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 /]/g, " ")
      .replace(/\s+/g, " ").trim();
  }

  function normalizeName(value) {
    return cleanText(value).toUpperCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, " ")
      .replace(/\s+/g, " ").trim();
  }

  function sanitizeCedula(value) {
    if (value === undefined || value === null) return "";
    const digits = String(value).replace(/\D/g, "");
    if (digits.length === 9) return digits.padStart(10, "0");
    return digits;
  }

  function setSelectValue(select, value) {
    const normalized = String(value || "").trim().toUpperCase();
    const options = Array.from(select.options);
    const match = options.find(opt => {
      const text = opt.textContent.trim().toUpperCase();
      const val = opt.value.trim().toUpperCase();
      return text === normalized || val === normalized;
    }) || options.find(opt => {
      const text = opt.textContent.trim().toUpperCase();
      const val = opt.value.trim().toUpperCase();
      return text.includes(normalized) || normalized.includes(text) ||
        val.includes(normalized) || normalized.includes(val);
    });

    if (match) {
      select.focus();
      select.value = match.value;
      select.selectedIndex = match.index;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
      select.dispatchEvent(new Event("blur", { bubbles: true }));
      return true;
    }
    return false;
  }

  // ─── Detection helpers ────────────────────────────────────

  /**
   * Detect if we are on the STUDENT LIST page
   * (table with "Seleccionar" buttons)
   */
  function isStudentListPage() {
    const btns = Array.from(document.querySelectorAll("button"));
    return btns.filter(b => /seleccionar/i.test(b.textContent || "")).length >= 1;
  }

  /**
   * Detect if we are on the SKILLS page for a single student
   * (has skill dropdowns like "Seleccione una opción")
   */
  function isSkillsPage() {
    const selects = document.querySelectorAll("table select, select");
    return selects.length >= 3;
  }

  /**
   * Extract student rows from the student list page.
   * Each row has: #, Identificación, Nombre, [Seleccionar] button
   */
  function getStudentListRows() {
    const rows = Array.from(document.querySelectorAll("table tr"));
    const students = [];

    for (const row of rows) {
      const btn = Array.from(row.querySelectorAll("button"))
        .find(b => /seleccionar/i.test(b.textContent || ""));
      if (!btn) continue;

      const cells = Array.from(row.querySelectorAll("td"));
      const cellTexts = cells.map(c => cleanText(c.innerText || ""));

      let cedula = "";
      for (const t of cellTexts) {
        const c = sanitizeCedula(t);
        if (c.length >= 9) { cedula = c; break; }
      }

      const nombre = cellTexts
        .filter(t => /[A-Za-z]{3,}/.test(t) && t.length >= 6)
        .filter(t => !/seleccionar|guardar|siguiente|anterior/i.test(t))
        .sort((a, b) => b.length - a.length)[0] || "";

      students.push({
        cedula,
        nombre: normalizeName(nombre),
        selectButton: btn,
        row
      });
    }

    return students;
  }

  /**
   * On the skills page, detect skill rows with their select dropdowns.
   */
  function detectSkillRows() {
    const rows = Array.from(document.querySelectorAll("table tr"));
    const skillRows = [];

    for (const row of rows) {
      const selects = Array.from(row.querySelectorAll("select"));
      if (!selects.length) continue;

      const cellTexts = Array.from(row.querySelectorAll("td, th")).map(el => cleanText(el.innerText || ""));
      const allText = cellTexts.join(" ");

      let skillName = "";
      for (const ct of cellTexts) {
        const norm = normalizeSkillText(ct);
        if (norm.length >= 5 && KNOWN_SKILLS.some(s => norm.includes(s) || s.includes(norm))) {
          skillName = norm;
          break;
        }
      }

      // Also check if the joined text contains a known skill
      if (!skillName) {
        const normAll = normalizeSkillText(allText);
        for (const s of KNOWN_SKILLS) {
          if (normAll.includes(s)) { skillName = s; break; }
        }
      }

      skillRows.push({ row, skillName, selects });
    }

    return skillRows;
  }

  /**
   * Get the "Alumno Seleccionado" name from the skills page header.
   */
  function getSelectedStudentInfo() {
    // Look for labeled field: "Alumno Seleccionado:" with value next to it
    const allElements = Array.from(document.querySelectorAll("td, th, span, div, label, p, h1, h2, h3, h4, h5"));
    for (const el of allElements) {
      const t = cleanText(el.innerText || el.textContent || "");
      if (/alumno\s*seleccionado/i.test(t)) {
        // The name might be a sibling or child element
        const parent = el.closest("tr, div, section, .row");
        if (parent) {
          const children = Array.from(parent.querySelectorAll("td, input, span, div"));
          for (const child of children) {
            const ct = cleanText(child.innerText || child.value || "");
            if (ct.length >= 8 && /[A-Z]{2,}/.test(ct) && !/alumno|seleccionado|trimestre|calificacion/i.test(ct)) {
              return { nombre: normalizeName(ct) };
            }
          }
        }
        // Try extracting from the same text
        const match = t.match(/alumno\s*seleccionado\s*:?\s*(.+)/i);
        if (match && match[1].trim().length >= 5) {
          return { nombre: normalizeName(match[1]) };
        }
      }
    }

    // Fallback: search full page text
    const allText = document.body.innerText || "";
    const textMatch = allText.match(/alumno\s*seleccionado\s*:?\s*([^\n]+)/i);
    if (textMatch && textMatch[1].trim().length >= 5) {
      return { nombre: normalizeName(textMatch[1]) };
    }

    // Last resort: find a prominent all-caps name near the top
    for (const el of allElements.slice(0, 50)) {
      const t = cleanText(el.innerText || "");
      if (t.length >= 10 && t.length <= 80 && /^[A-Z\s]+$/.test(t) && /\s/.test(t) &&
          !/CIVICA|ACOMPAN|HABILIDAD|TRIMESTRE|CALIFICAC|CRITERIO|BACHILLERATO|SELECCIONE|GUARDAR|VOLVER/i.test(t)) {
        return { nombre: normalizeName(t) };
      }
    }
    return null;
  }

  /**
   * Find the "Volver" button to go back to student list
   */
  function findVolverButton() {
    const btns = Array.from(document.querySelectorAll("button, a"));
    return btns.find(b => /volver/i.test(b.textContent || "")) || null;
  }

  /**
   * Find the "Guardar" button on the skills page
   */
  function findSaveButton() {
    const btns = Array.from(document.querySelectorAll("button, input[type='button'], input[type='submit']"));
    return btns.find(btn =>
      /guardar\s*calificacion|guardar/i.test(btn.textContent || btn.value || "")
    ) || null;
  }

  /**
   * Find "Siguiente" pagination button on student list
   */
  function findNextPageButton() {
    const nodes = Array.from(document.querySelectorAll("button, a"));
    return nodes.find(el => /siguiente/i.test(el.textContent || "")) || null;
  }

  /**
   * Wait for skill dropdowns to appear on the skills page
   */
  async function waitForSkillsPage(timeoutMs = 8000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (isSkillsPage()) return true;
      await sleep(200);
    }
    return false;
  }

  /**
   * Wait for student list table to appear
   */
  async function waitForStudentList(timeoutMs = 8000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (isStudentListPage()) return true;
      await sleep(200);
    }
    return false;
  }

  // ─── Core logic ───────────────────────────────────────────

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[m][n];
  }

  function nameSimilarity(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const aTokens = a.split(" ").filter(Boolean);
    const bTokens = b.split(" ").filter(Boolean);
    const inter = aTokens.filter(t => bTokens.includes(t)).length;
    const union = new Set([...aTokens, ...bTokens]).size || 1;
    const tokenScore = inter / union;
    const levScore = 1 - levenshtein(a, b) / Math.max(a.length, b.length, 1);
    return tokenScore * 0.55 + levScore * 0.45;
  }

  function matchRecord(student, records, byCedula) {
    // 1. Match by cedula (exact)
    if (student.cedula && byCedula.has(student.cedula)) {
      return byCedula.get(student.cedula);
    }
    if (!student.nombre) return null;

    // 2. Exact name match
    const exactName = records.find(r => r.nombre === student.nombre);
    if (exactName) return exactName;

    // 3. Fuzzy name match (IA) — find best match above threshold
    let best = null, bestScore = 0;
    for (const r of records) {
      if (!r.nombre) continue;
      const score = nameSimilarity(student.nombre, r.nombre);
      if (score > bestScore) { best = r; bestScore = score; }
    }
    if (best && bestScore >= 0.5) {
      console.log(`[Civica IA] Match: "${student.nombre}" → "${best.nombre}" (score: ${bestScore.toFixed(3)})`);
      return best;
    }

    // 4. Partial token match (at least 2 words in common)
    return records.find(r => {
      if (!r.nombre) return false;
      const aTokens = student.nombre.split(" ").filter(Boolean);
      const bTokens = r.nombre.split(" ").filter(Boolean);
      const inter = aTokens.filter(t => bTokens.includes(t)).length;
      return inter >= 2;
    }) || null;
  }

  function getValueForSkill(record, skillName) {
    if (!skillName) {
      return record.singleBehavior || record.nota || record.comportamiento || "";
    }
    if (record.skills && Object.keys(record.skills).length > 0) {
      // Try exact match
      for (const [key, val] of Object.entries(record.skills)) {
        const normKey = normalizeSkillText(key);
        if (normKey === skillName) return val;
      }
      // Try partial match
      for (const [key, val] of Object.entries(record.skills)) {
        const normKey = normalizeSkillText(key);
        if (normKey.includes(skillName) || skillName.includes(normKey)) return val;
      }
      // Try shorter prefix match (e.g. "COMUNICACION" matches "COMUNICACION EFECTIVA/ASERTIVA")
      for (const [key, val] of Object.entries(record.skills)) {
        const normKey = normalizeSkillText(key);
        const prefix = normKey.split(" ")[0];
        const skillPrefix = skillName.split(" ")[0];
        if (prefix.length >= 5 && (prefix === skillPrefix)) return val;
      }
    }
    return record.singleBehavior || record.nota || record.comportamiento || "";
  }

  async function fillSkillsForCurrentStudent(record) {
    const skillRows = detectSkillRows();
    if (!skillRows.length) {
      console.warn("[Civica] No skill rows found on skills page.");
      return 0;
    }

    let filled = 0;
    for (const sr of skillRows) {
      const value = getValueForSkill(record, sr.skillName);
      if (!value) continue;

      for (const select of sr.selects) {
        const ok = setSelectValue(select, value);
        if (ok) filled++;
      }
    }

    return filled;
  }

  async function saveAndConfirm() {
    const saveBtn = findSaveButton();
    if (!saveBtn) {
      console.warn("[Civica] No save button found.");
      return false;
    }
    saveBtn.click();
    await sleep(300);

    // Handle SweetAlert2 confirmation dialog ("¿Estás seguro?" → "Sí, guardar")
    if (typeof BulkUploader !== "undefined" && BulkUploader.waitForConfirmAndAccept) {
      await BulkUploader.waitForConfirmAndAccept();
    }
    await sleep(500);
    return true;
  }

  async function goBackToStudentList() {
    const volverBtn = findVolverButton();
    if (volverBtn) {
      volverBtn.click();
      await sleep(1500);
      await waitForStudentList();
      return true;
    }
    // Fallback: browser back
    window.history.back();
    await sleep(1500);
    await waitForStudentList();
    return true;
  }

  // ─── Main orchestration ───────────────────────────────────

  /**
   * Main entry point: runs Civica import across all students and pages.
   * Flow:
   *   For each page of student list:
   *     For each student on the page:
   *       1. Click "Seleccionar"
   *       2. Wait for skills page
   *       3. Fill all skill selects
   *       4. Click Guardar → Sí, guardar
   *       5. Click Volver → back to student list
   *     Click "Siguiente" for next page
   */
  async function runCivicaPaginated(config) {
    const { records, byCedula, autoNext, onProgress } = config;
    let totalFilled = 0;
    let studentsProcessed = 0;
    let pagesVisited = 0;
    const processed = new Set();

    while (true) {
      pagesVisited++;
      await waitForStudentList(5000);

      if (!isStudentListPage()) {
        // Maybe we're already on a skills page for a specific student
        if (isSkillsPage()) {
          console.log("[Civica] Already on skills page, processing single student.");
          const studentInfo = getSelectedStudentInfo();
          let record = null;
          if (studentInfo) {
            console.log(`[Civica] Detected student: ${studentInfo.nombre}`);
            record = matchRecord(studentInfo, records, byCedula);
          }
          if (!record && records.length > 0) {
            console.log("[Civica] No match found, using first record as fallback.");
            record = records[0];
          }
          if (record) {
            const filled = await fillSkillsForCurrentStudent(record);
            totalFilled += filled;
            studentsProcessed++;
            if (filled > 0) await saveAndConfirm();
            console.log(`[Civica] Filled ${filled} skills for current student.`);
          } else {
            console.warn("[Civica] No records available to fill.");
          }
          break;
        }
        console.warn("[Civica] Not on student list or skills page.");
        break;
      }

      const studentRows = getStudentListRows();
      console.log(`[Civica] Pagina ${pagesVisited}: ${studentRows.length} estudiantes detectados.`);

      if (!studentRows.length) break;

      for (let i = 0; i < studentRows.length; i++) {
        const student = studentRows[i];
        const key = student.cedula || student.nombre;
        if (processed.has(key)) continue;

        const record = matchRecord(student, records, byCedula);
        if (!record) {
          console.warn(`[Civica] Sin registro para: ${student.nombre} (${student.cedula})`);
          continue;
        }

        console.log(`[Civica] Procesando ${i + 1}/${studentRows.length}: ${student.nombre}`);

        // 1. Click "Seleccionar" for this student
        student.selectButton.click();
        await sleep(1500);

        // 2. Wait for skills page to load
        const loaded = await waitForSkillsPage(8000);
        if (!loaded) {
          console.warn(`[Civica] Skills page did not load for: ${student.nombre}`);
          await goBackToStudentList();
          continue;
        }

        // 3. Fill all skill selects
        const filled = await fillSkillsForCurrentStudent(record);
        totalFilled += filled;
        studentsProcessed++;
        processed.add(key);

        console.log(`[Civica] ${student.nombre}: ${filled} habilidades llenadas.`);

        // 4. Save and confirm
        await saveAndConfirm();

        // 5. Go back to student list
        await goBackToStudentList();

        // Re-wait for DOM to stabilize after going back
        await sleep(500);

        if (onProgress) onProgress(studentsProcessed, totalFilled);
      }

      // Pagination
      if (!autoNext) break;
      await waitForStudentList(3000);
      const nextBtn = findNextPageButton();
      if (!nextBtn || nextBtn.disabled || nextBtn.getAttribute("aria-disabled") === "true") break;
      nextBtn.click();
      await sleep(1500);
    }

    return { totalFilled, studentsProcessed, pagesVisited };
  }

  return {
    CIVICA_VALUES,
    KNOWN_SKILLS,
    isStudentListPage,
    isSkillsPage,
    getStudentListRows,
    detectSkillRows,
    fillSkillsForCurrentStudent,
    saveAndConfirm,
    goBackToStudentList,
    runCivicaPaginated,
    setSelectValue,
    matchRecord
  };
})();

if (typeof window !== "undefined") window.CivicaAutoFill = CivicaAutoFill;
