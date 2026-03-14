/**
 * firebase.js — Firestore REST API Client (sin SDK, sin bundler)
 * Importador de Notas Mineduc
 *
 * Usa directamente la REST API de Cloud Firestore.
 * Compatible con content scripts de Chrome Extension (Manifest V3).
 *
 * Expone: window.FirebaseDB
 */
const FirebaseDB = (() => {
  "use strict";

  // ─── CONFIGURACIÓN ─────────────────────────────────────
  // Cambia projectId y apiKey por los de tu proyecto Firebase.
  const PROJECT_ID = "notas-academico";
  const API_KEY    = "API_KEY";

  const BASE = "https://firestore.googleapis.com/v1/projects/"
    + PROJECT_ID + "/databases/(default)/documents";

  // ─── HELPERS DE CONVERSIÓN ─────────────────────────────
  // Firestore REST devuelve valores tipados; estos helpers los convierten.

  function toFirestoreValue(val) {
    if (val === null || val === undefined) return { nullValue: null };
    if (typeof val === "boolean")          return { booleanValue: val };
    if (typeof val === "number")           return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
    if (typeof val === "string")           return { stringValue: val };
    if (val instanceof Date)               return { timestampValue: val.toISOString() };
    if (Array.isArray(val))                return { arrayValue: { values: val.map(toFirestoreValue) } };
    if (typeof val === "object") {
      var fields = {};
      for (var k in val) if (val.hasOwnProperty(k)) fields[k] = toFirestoreValue(val[k]);
      return { mapValue: { fields: fields } };
    }
    return { stringValue: String(val) };
  }

  function fromFirestoreValue(v) {
    if ("stringValue"    in v) return v.stringValue;
    if ("integerValue"   in v) return Number(v.integerValue);
    if ("doubleValue"    in v) return v.doubleValue;
    if ("booleanValue"   in v) return v.booleanValue;
    if ("timestampValue" in v) return v.timestampValue;
    if ("nullValue"      in v) return null;
    if ("arrayValue"     in v) return (v.arrayValue.values || []).map(fromFirestoreValue);
    if ("mapValue"       in v) return fromFirestoreFields(v.mapValue.fields || {});
    return null;
  }

  function fromFirestoreFields(fields) {
    var obj = {};
    for (var k in fields) if (fields.hasOwnProperty(k)) obj[k] = fromFirestoreValue(fields[k]);
    return obj;
  }

  function toFirestoreFields(obj) {
    var fields = {};
    for (var k in obj) if (obj.hasOwnProperty(k)) fields[k] = toFirestoreValue(obj[k]);
    return fields;
  }

  // ─── OPERACIONES CRUD ──────────────────────────────────

  /**
   * Consulta documentos con un filtro WHERE simple.
   * @param {string} coleccion — Nombre de la colección
   * @param {string} campo     — Campo a filtrar
   * @param {string} operador  — "EQUAL", "LESS_THAN", etc.
   * @param {*}      valor     — Valor a comparar
   * @returns {Promise<Array<{id: string, data: object}>>}
   */
  async function queryWhere(coleccion, campo, operador, valor) {
    var url = BASE + ":runQuery?key=" + API_KEY;
    var body = {
      structuredQuery: {
        from: [{ collectionId: coleccion }],
        where: {
          fieldFilter: {
            field: { fieldPath: campo },
            op: operador,
            value: toFirestoreValue(valor)
          }
        }
      }
    };

    var resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!resp.ok) throw new Error("Firestore query error: " + resp.status);

    var results = await resp.json();
    var docs = [];
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      if (r.document) {
        var parts = r.document.name.split("/");
        docs.push({
          id: parts[parts.length - 1],
          data: fromFirestoreFields(r.document.fields || {})
        });
      }
    }
    return docs;
  }

  /**
   * Obtiene un documento por su ID.
   */
  async function getDoc(coleccion, docId) {
    var url = BASE + "/" + coleccion + "/" + docId + "?key=" + API_KEY;
    var resp = await fetch(url);
    if (resp.status === 404) return null;
    if (!resp.ok) throw new Error("Firestore getDoc error: " + resp.status);
    var doc = await resp.json();
    return { id: docId, data: fromFirestoreFields(doc.fields || {}) };
  }

  /**
   * Actualiza campos de un documento existente (merge parcial).
   */
  async function updateDoc(coleccion, docId, campos) {
    var fieldPaths = Object.keys(campos).map(function(k) { return "updateMask.fieldPaths=" + k; }).join("&");
    var url = BASE + "/" + coleccion + "/" + docId + "?" + fieldPaths + "&key=" + API_KEY;
    var resp = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: toFirestoreFields(campos) })
    });
    if (!resp.ok) throw new Error("Firestore updateDoc error: " + resp.status);
    return await resp.json();
  }

  /**
   * Crea un documento nuevo en una colección.
   */
  async function createDoc(coleccion, campos) {
    var url = BASE + "/" + coleccion + "?key=" + API_KEY;
    var resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: toFirestoreFields(campos) })
    });
    if (!resp.ok) throw new Error("Firestore createDoc error: " + resp.status);
    var doc = await resp.json();
    var parts = doc.name.split("/");
    return parts[parts.length - 1];
  }

  // ─── API PÚBLICA ───────────────────────────────────────

  return {
    PROJECT_ID: PROJECT_ID,
    API_KEY: API_KEY,
    queryWhere: queryWhere,
    getDoc: getDoc,
    updateDoc: updateDoc,
    createDoc: createDoc,
    // Helpers expuestos para uso externo
    toFirestoreFields: toFirestoreFields,
    fromFirestoreFields: fromFirestoreFields
  };
})();

if (typeof window !== "undefined") window.FirebaseDB = FirebaseDB;
