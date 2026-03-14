/**
 * bulkUploader.js
 * Motor de carga masiva generico para notas normales y orientacion vocacional.
 * Recorre filas de la tabla, empareja por cedula/nombre, llena inputs y guarda.
 */
const BulkUploader = (() => {
  const RULES = {
    minGrade: 0,
    maxGrade: 10,
    rowSaveDelay: 250,
    pageWaitMs: 1200,
    similarityThreshold: 0.82
  };

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function setInputValue(input, value) {
    input.focus();
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
    if (descriptor && descriptor.set) descriptor.set.call(input, String(value));
    else input.value = String(value);
    input.dispatchEvent(new Event("focus", { bubbles: true }));
    input.dispatchEvent(new InputEvent("input", { bubbles: true, data: String(value), inputType: "insertText" }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function setSelectValue(select, value) {
    const normalized = String(value || "").trim().toUpperCase();
    const options = Array.from(select.options);
    // Try exact match first, then partial
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
    console.warn(`[Importador IA] setSelectValue: no match for "${normalized}" in`, options.map(o => o.textContent.trim()));
    return false;
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
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

  function extractStudentFromRow(row, cells) {
    const cellTexts = Array.from(cells).map(cell => cleanText(cell.innerText));
    let cedula = "";
    for (const text of cellTexts) {
      const c = sanitizeCedula(text);
      if (c.length >= 9) { cedula = c; break; }
    }

    const name = cellTexts
      .filter(t => /[A-Za-z]/.test(t))
      .filter(t => !/guardar|siguiente|anterior|calificacion|accion|trimestre|supletorio/i.test(t))
      .sort((a, b) => b.length - a.length)[0] || "";

    return { cedula, nombre: normalizeName(name) };
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

  function pickRecordForStudent(student, records, byCedula, pending, smartMatch) {
    if (student.cedula && byCedula.has(student.cedula)) {
      const exactCed = byCedula.get(student.cedula);
      if (exactCed && pending.has(exactCed.id)) return { ...exactCed, _aiScore: 1 };
    }
    if (!student.nombre) return null;
    const candidates = records.filter(r => pending.has(r.id) && r.nombre);
    if (!candidates.length) return null;
    const exactName = candidates.find(r => r.nombre === student.nombre);
    if (exactName) return { ...exactName, _aiScore: 1 };
    if (!smartMatch) return null;

    let best = null, bestScore = 0;
    for (const c of candidates) {
      const score = nameSimilarity(c.nombre, student.nombre);
      if (score > bestScore) { best = c; bestScore = score; }
    }
    if (!best || bestScore < RULES.similarityThreshold) return null;
    return { ...best, _aiScore: Number(bestScore.toFixed(3)) };
  }

  function findSaveButton(row) {
    // First try within the row
    const rowCandidates = Array.from(row.querySelectorAll("button, input[type='button'], input[type='submit']"));
    const rowMatch = rowCandidates.find(btn => /guardar/i.test(btn.textContent || btn.value || ""));
    if (rowMatch) return rowMatch;
    // Then try page-level save button (common in Angular apps)
    const pageCandidates = Array.from(document.querySelectorAll("button, input[type='button'], input[type='submit']"));
    return pageCandidates.find(btn => /guardar\s*calificacion|guardar/i.test(btn.textContent || btn.value || "")) || null;
  }

  async function waitForConfirmAndAccept() {
    // Wait for SweetAlert2/modal confirmation dialog and click "Sí, guardar"
    const maxWait = 3000;
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      // SweetAlert2 confirm button
      const swalConfirm = document.querySelector(".swal2-confirm, .swal2-actions button.swal2-confirm");
      if (swalConfirm && swalConfirm.offsetParent !== null) {
        swalConfirm.click();
        await sleep(400);
        return true;
      }
      // Generic modal with "Sí, guardar" or "Si, guardar" button
      const allBtns = Array.from(document.querySelectorAll("button"));
      const confirmBtn = allBtns.find(btn => {
        const text = (btn.textContent || "").trim().toLowerCase();
        return (text.includes("s\u00ed, guardar") || text.includes("si, guardar") ||
                text.includes("s\u00ed,guardar") || text.includes("confirmar") ||
                text.includes("aceptar")) &&
               btn.offsetParent !== null;
      });
      if (confirmBtn) {
        confirmBtn.click();
        await sleep(400);
        return true;
      }
      await sleep(150);
    }
    return false;
  }

  function findNextButton() {
    const nodes = Array.from(document.querySelectorAll("button, a, input[type='button'], input[type='submit']"));
    return nodes.find(el => /siguiente/i.test(el.textContent || el.value || "")) || null;
  }

  function isDisabled(el) {
    return Boolean(el.disabled) || el.getAttribute("aria-disabled") === "true";
  }

  async function waitForGradeTable() {
    const timeout = Date.now() + 10000;
    while (Date.now() < timeout) {
      if (document.querySelectorAll("table tr td").length > 0) return;
      await sleep(150);
    }
  }

  async function moveToNextPage() {
    const next = findNextButton();
    if (!next || isDisabled(next)) return false;
    next.click();
    await sleep(RULES.pageWaitMs);
    return true;
  }

  async function fillCurrentPage(config) {
    const { records, byCedula, pending, autoSave, smartMatch, diagnostics, format } = config;
    const rows = Array.from(document.querySelectorAll("table tr"));
    let filled = 0;

    for (const row of rows) {
      const cells = row.querySelectorAll("td");
      if (!cells.length) continue;

      const student = extractStudentFromRow(row, cells);
      if (!student.nombre && !student.cedula) continue;

      const record = pickRecordForStudent(student, records, byCedula, pending, smartMatch);
      if (!record) continue;

      if (format === "vocacional") {
        const select = row.querySelector("select");
        const input = row.querySelector("input[type='text'], input[type='number'], input:not([type])");
        let filled_ok = false;
        if (select) {
          filled_ok = setSelectValue(select, record.nota);
          if (!filled_ok) {
            console.warn(`[Importador IA] No se pudo seleccionar "${record.nota}" para ${student.nombre}`);
          }
        }
        if (!filled_ok && input) {
          setInputValue(input, record.nota);
          filled_ok = true;
        }
        if (!filled_ok) continue;
      } else {
        const input = row.querySelector("input[type='text'], input[type='number'], input:not([type])");
        if (!input) continue;
        setInputValue(input, record.nota);
      }

      if (autoSave) {
        const saveButton = findSaveButton(row);
        if (saveButton) {
          saveButton.click();
          await sleep(RULES.rowSaveDelay);
          // Handle SweetAlert2 confirmation dialog ("¿Estás seguro?" → "Sí, guardar")
          await waitForConfirmAndAccept();
        }
      }

      if (record._aiScore && record._aiScore < 1) {
        diagnostics.weakMatches.push({
          cedula: record.cedula, excel: record.nombre,
          sistema: student.nombre, score: record._aiScore
        });
      }

      pending.delete(record.id);
      filled += 1;
    }

    // After all rows filled, try page-level save if autoSave is enabled
    if (autoSave && filled > 0) {
      const pageSaveBtn = Array.from(document.querySelectorAll("button, input[type='button'], input[type='submit']"))
        .find(btn => /guardar\s*calificacion|guardar/i.test(btn.textContent || btn.value || ""));
      if (pageSaveBtn && !pageSaveBtn.disabled) {
        await sleep(200);
        pageSaveBtn.click();
        await sleep(RULES.rowSaveDelay);
        // Handle SweetAlert2 confirmation dialog
        await waitForConfirmAndAccept();
      }
    }

    return { filled };
  }

  async function runBulkImport(config) {
    const { records, byCedula, autoSave, autoNext, smartMatch, format, onProgress } = config;
    const pending = new Set(records.map(r => r.id));
    let totalFilled = 0, pagesVisited = 0;
    const diagnostics = { notFound: [], weakMatches: [] };

    while (true) {
      await waitForGradeTable();
      pagesVisited += 1;

      const result = await fillCurrentPage({
        records, byCedula, pending, autoSave, smartMatch, diagnostics, format
      });

      totalFilled += result.filled;
      if (onProgress) onProgress(pagesVisited, totalFilled, pending.size);
      console.log(`[Importador IA] Pagina ${pagesVisited}: ${result.filled} notas aplicadas.`);

      if (!autoNext || pending.size === 0) break;
      const moved = await moveToNextPage();
      if (!moved) break;
    }

    for (const id of pending) {
      const rec = records.find(r => r.id === id);
      if (rec) diagnostics.notFound.push({ cedula: rec.cedula, nombre: rec.nombre, nota: rec.nota });
    }

    return { totalFilled, pagesVisited, diagnostics };
  }

  return {
    RULES,
    setInputValue,
    setSelectValue,
    extractStudentFromRow,
    pickRecordForStudent,
    nameSimilarity,
    findSaveButton,
    waitForConfirmAndAccept,
    findNextButton,
    moveToNextPage,
    waitForGradeTable,
    fillCurrentPage,
    runBulkImport,
    sleep
  };
})();

if (typeof window !== "undefined") window.BulkUploader = BulkUploader;
