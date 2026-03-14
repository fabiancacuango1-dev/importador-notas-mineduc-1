/**
 * formatHandler.js
 * Gestiona los formatos de asignatura: Notas normales, Orientacion vocacional, Civica.
 */
const FormatHandler = (() => {
  const FORMATS = {
    NORMAL: "normal",
    VOCACIONAL: "vocacional",
    CIVICA: "civica"
  };

  const VOCACIONAL_VALUES = [
    "A+", "A-", "B+", "B-", "C+", "C-",
    "A", "B", "C", "D",
    "DOMINA", "ALCANZA", "PROXIMO", "NO ALCANZA",
    "DAR", "AAR", "PAAR", "NAAR",
    "SIEMPRE", "FRECUENTEMENTE", "OCASIONALMENTE", "NUNCA",
    "MUY SATISFACTORIO", "SATISFACTORIO", "POCO SATISFACTORIO", "MEJORABLE"
  ];

  const CIVICA_VALUES = ["SIEMPRE", "FRECUENTEMENTE", "OCASIONALMENTE", "NUNCA"];

  const CIVICA_SKILLS = [
    "AUTOCONOCIMIENTO",
    "PENSAMIENTO CRITICO",
    "MANEJO DE PROBLEMAS",
    "TOMA DE DECISIONES",
    "TRABAJO EN EQUIPO",
    "EMPATIA",
    "MANEJO DE CONFLICTOS",
    "COMUNICACION EFECTIVA/ASERTIVA",
    "MANEJO DE EMOCIONES Y SENTIMIENTOS"
  ];

  let currentFormat = FORMATS.NORMAL;

  function setFormat(format) {
    if (Object.values(FORMATS).includes(format)) {
      currentFormat = format;
    }
  }

  function getFormat() {
    return currentFormat;
  }

  function getFormatLabel(format) {
    const labels = {
      [FORMATS.NORMAL]: "Notas normales",
      [FORMATS.VOCACIONAL]: "Orientacion vocacional",
      [FORMATS.CIVICA]: "Civica"
    };
    return labels[format] || format;
  }

  function validateValue(value, format) {
    const fmt = format || currentFormat;
    const v = String(value || "").trim().toUpperCase();

    switch (fmt) {
      case FORMATS.NORMAL:
        return validateNumericGrade(v);
      case FORMATS.VOCACIONAL:
        return validateVocacional(v);
      case FORMATS.CIVICA:
        return validateCivica(v);
      default:
        return { valid: false, error: "Formato desconocido." };
    }
  }

  function validateNumericGrade(value) {
    const txt = value.replace(/,/g, ".").replace(/\s/g, "");
    if (!/^\d+(\.\d+)?$/.test(txt)) return { valid: false, error: `"${value}" no es un numero valido.` };
    const n = Number(txt);
    if (n < 0 || n > 10) return { valid: false, error: `"${value}" fuera del rango 0-10.` };
    return { valid: true, normalized: formatGrade(n) };
  }

  function validateVocacional(value) {
    const v = value.replace(/\s+/g, " ").trim().toUpperCase();
    if (!v) return { valid: false, error: "Valor vacío." };
    // Accept exact match
    if (VOCACIONAL_VALUES.includes(v)) {
      return { valid: true, normalized: v };
    }
    // Accept without spaces (e.g., "A +" → "A+")
    const noSpace = v.replace(/\s/g, "");
    if (VOCACIONAL_VALUES.includes(noSpace)) {
      return { valid: true, normalized: noSpace };
    }
    // Accept partial match
    const partial = VOCACIONAL_VALUES.find(vv => vv.includes(v) || v.includes(vv));
    if (partial) {
      return { valid: true, normalized: partial };
    }
    // Accept numeric values for vocacional (some formats use 0-10)
    const numCheck = validateNumericGrade(v);
    if (numCheck.valid) return numCheck;
    // Accept any non-empty string as qualitative value (flexibility)
    return { valid: true, normalized: v };
  }

  function validateCivica(value) {
    const v = String(value || "").toUpperCase().trim();
    if (!v) return { valid: false, error: "Valor vacio." };
    if (CIVICA_VALUES.includes(v)) {
      return { valid: true, normalized: v };
    }
    // Accept partial match
    const partial = CIVICA_VALUES.find(cv => cv.includes(v) || v.includes(cv));
    if (partial) return { valid: true, normalized: partial };
    // Accept abbreviated forms
    const abbrev = { "S": "SIEMPRE", "F": "FRECUENTEMENTE", "O": "OCASIONALMENTE", "N": "NUNCA" };
    if (abbrev[v]) return { valid: true, normalized: abbrev[v] };
    return { valid: false, error: `"${value}" no es valido. Permitidos: ${CIVICA_VALUES.join(", ")}` };
  }

  function validateRecords(records, format) {
    const fmt = format || currentFormat;
    const errors = [];
    const validRecords = [];

    for (let i = 0; i < records.length; i++) {
      const rec = records[i];

      if (fmt === FORMATS.CIVICA) {
        const skills = rec.skills || {};
        const singleValue = rec.nota || rec.comportamiento || "";
        const hasSkills = Object.keys(skills).length > 0;

        if (!hasSkills && singleValue) {
          const check = validateCivica(singleValue);
          if (!check.valid) {
            errors.push({ row: i + 1, field: "comportamiento", error: check.error });
            continue;
          }
          rec.singleBehavior = check.normalized;
        } else if (hasSkills) {
          const validSkills = {};
          for (const [skill, val] of Object.entries(skills)) {
            if (!val || !val.trim()) continue;
            const check = validateCivica(val);
            if (check.valid) {
              validSkills[skill] = check.normalized;
            }
          }
          if (Object.keys(validSkills).length > 0) {
            rec.skills = validSkills;
          } else if (singleValue) {
            const check = validateCivica(singleValue);
            if (check.valid) rec.singleBehavior = check.normalized;
          }
        } else if (rec.singleBehavior) {
          // Already set by parser
        } else {
          errors.push({ row: i + 1, field: "comportamiento", error: "Sin valor de comportamiento." });
          continue;
        }

        validRecords.push(rec);
      } else {
        const check = validateValue(rec.nota, fmt);
        if (!check.valid) {
          errors.push({ row: i + 1, field: "nota", error: check.error });
        } else {
          rec.nota = check.normalized;
          validRecords.push(rec);
        }
      }
    }

    return { valid: errors.length === 0, errors, records: validRecords };
  }

  function parseRecordsForFormat(rows, format) {
    const fmt = format || currentFormat;

    switch (fmt) {
      case FORMATS.CIVICA:
        return parseCivicaRecords(rows);
      case FORMATS.VOCACIONAL:
        return parseVocacionalRecords(rows);
      default:
        return null;
    }
  }

  function parseCivicaRecords(rows) {
    if (!Array.isArray(rows) || !rows.length) return [];

    const headers = (rows[0] || []).map(h => normalizeHeader(String(h || "")));
    const cedulaIdx = findIdx(headers, ["cedula", "identificacion", "dni"]);
    const nombreIdx = findIdx(headers, ["nombre", "estudiante", "alumno"]);

    const skillColumns = {};
    const singleBehaviorIdx = findIdx(headers, ["comportamiento", "valor", "conducta", "civica"]);

    for (let c = 0; c < headers.length; c++) {
      if (c === cedulaIdx || c === nombreIdx || c === singleBehaviorIdx) continue;
      for (const skill of CIVICA_SKILLS) {
        const normSkill = normalizeHeader(skill);
        if (headers[c].includes(normSkill) || normSkill.includes(headers[c])) {
          skillColumns[skill] = c;
          break;
        }
      }
    }

    const hasSkillColumns = Object.keys(skillColumns).length > 0;
    const startAt = (cedulaIdx >= 0 || nombreIdx >= 0) ? 1 : 0;
    const records = [];

    for (let i = startAt; i < rows.length; i++) {
      const row = rows[i] || [];
      const cedula = cedulaIdx >= 0 ? sanitizeCedula(row[cedulaIdx]) : "";
      const nombre = nombreIdx >= 0 ? normalizeName(row[nombreIdx]) : "";
      if (!cedula && !nombre) continue;

      const rec = { cedula, nombre };

      if (hasSkillColumns) {
        const skills = {};
        let firstNonEmpty = "";
        for (const [skill, col] of Object.entries(skillColumns)) {
          const val = String(row[col] || "").trim().toUpperCase();
          if (val) {
            skills[skill] = val;
            if (!firstNonEmpty) firstNonEmpty = val;
          }
        }
        if (Object.keys(skills).length > 0) {
          rec.skills = skills;
        } else if (firstNonEmpty) {
          rec.singleBehavior = firstNonEmpty;
          rec.nota = firstNonEmpty;
          rec.comportamiento = firstNonEmpty;
        }
      } else if (singleBehaviorIdx >= 0) {
        rec.nota = String(row[singleBehaviorIdx] || "").trim().toUpperCase();
        rec.comportamiento = rec.nota;
      } else {
        const lastCol = row.length - 1;
        if (lastCol > Math.max(cedulaIdx, nombreIdx)) {
          rec.nota = String(row[lastCol] || "").trim().toUpperCase();
          rec.comportamiento = rec.nota;
        }
      }

      records.push(rec);
    }

    return records;
  }

  function parseVocacionalRecords(rows) {
    if (!Array.isArray(rows) || !rows.length) return [];

    const headers = (rows[0] || []).map(h => normalizeHeader(String(h || "")));
    const cedulaIdx = findIdx(headers, ["cedula", "identificacion", "dni"]);
    const nombreIdx = findIdx(headers, ["nombre", "estudiante", "alumno"]);
    const notaIdx = findIdx(headers, ["nota", "calificacion", "orientacion", "valor"]);
    const startAt = (cedulaIdx >= 0 || nombreIdx >= 0 || notaIdx >= 0) ? 1 : 0;
    const notaCol = notaIdx >= 0 ? notaIdx : (rows[0] || []).length - 1;

    const records = [];
    for (let i = startAt; i < rows.length; i++) {
      const row = rows[i] || [];
      const cedula = cedulaIdx >= 0 ? sanitizeCedula(row[cedulaIdx]) : "";
      const nombre = nombreIdx >= 0 ? normalizeName(row[nombreIdx]) : "";
      const nota = String(row[notaCol] || "").trim().toUpperCase().replace(/\s/g, "");
      if (!cedula && !nombre) continue;
      records.push({ cedula, nombre, nota });
    }

    return records;
  }

  function findIdx(headers, aliases) {
    return headers.findIndex(h => aliases.some(a => h.includes(a)));
  }

  function normalizeHeader(value) {
    return String(value || "").toLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 /]/g, " ").replace(/\s+/g, " ").trim();
  }

  function normalizeName(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toUpperCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  }

  function sanitizeCedula(value) {
    if (value === undefined || value === null) return "";
    const digits = String(value).replace(/\D/g, "");
    if (digits.length === 9) return digits.padStart(10, "0");
    return digits;
  }

  function formatGrade(n) {
    return n.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
  }

  return {
    FORMATS,
    VOCACIONAL_VALUES,
    CIVICA_VALUES,
    CIVICA_SKILLS,
    setFormat,
    getFormat,
    getFormatLabel,
    validateValue,
    validateRecords,
    parseRecordsForFormat,
    parseCivicaRecords,
    parseVocacionalRecords
  };
})();

if (typeof window !== "undefined") window.FormatHandler = FormatHandler;
