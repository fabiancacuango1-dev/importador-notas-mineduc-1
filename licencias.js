/**
 * licencias.js — Módulo de verificación de licencias en Firestore
 * Importador de Notas Mineduc
 *
 * Depende de: firebase.js (FirebaseDB)
 * Compatible con content scripts Chrome Extension (Manifest V3).
 *
 * Colección Firestore: "licencias"
 * Campos por documento:
 *   codigo            string  — Código único (ej. "MINEDUC-A1B2C3D4E5F6")
 *   estado            string  — "disponible" | "activado"
 *   machine_id        string  — SHA-256 fingerprint del navegador
 *   usuario           string  — Identificador del usuario/docente
 *   fecha_activacion  string  — ISO 8601 timestamp
 *
 * Expone: window.Licencias
 */
const Licencias = (() => {
  "use strict";

  const COLECCION = "licencias";

  // ─── IDENTIFICADOR ÚNICO DE MÁQUINA ────────────────────
  // Genera un hash SHA-256 basado en propiedades del navegador.

  let _cacheMachineId = "";

  async function obtenerMachineId() {
    if (_cacheMachineId) return _cacheMachineId;

    const partes = [
      navigator.userAgent,
      navigator.language,
      screen.width + "x" + screen.height + "x" + screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.hardwareConcurrency || "unknown"
    ];
    const texto = partes.join("|");
    const datos = new TextEncoder().encode(texto);
    const hashBuffer = await crypto.subtle.digest("SHA-256", datos);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    _cacheMachineId = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    return _cacheMachineId;
  }

  // ─── BUSCAR LICENCIA EN FIRESTORE ──────────────────────

  async function buscarLicencia(codigo) {
    const codigoNorm = (codigo || "").trim().toUpperCase();
    if (!codigoNorm) return { encontrada: false, datos: null, docId: null };

    const docs = await FirebaseDB.queryWhere(COLECCION, "codigo", "EQUAL", codigoNorm);
    if (!docs.length) return { encontrada: false, datos: null, docId: null };

    return { encontrada: true, datos: docs[0].data, docId: docs[0].id };
  }

  // ─── VERIFICAR ESTADO DE LA LICENCIA ───────────────────
  /**
   * Verifica si un código existe y su estado actual.
   * @param {string} codigo — Código de licencia
   * @returns {Promise<{existe: boolean, disponible: boolean, activadaEnEstaMaquina: boolean, mensaje: string}>}
   */
  async function verificarCodigo(codigo) {
    const resultado = await buscarLicencia(codigo);

    if (!resultado.encontrada) {
      return {
        existe: false,
        disponible: false,
        activadaEnEstaMaquina: false,
        mensaje: "Código de licencia no encontrado."
      };
    }

    const datos = resultado.datos;
    const machineId = await obtenerMachineId();

    // Licencia disponible (no usada)
    if (datos.estado === "disponible") {
      return {
        existe: true,
        disponible: true,
        activadaEnEstaMaquina: false,
        mensaje: "Licencia disponible para activación.",
        docId: resultado.docId,
        datos: datos
      };
    }

    // Licencia activada en ESTA máquina
    if (datos.estado === "activado" && datos.machine_id === machineId) {
      return {
        existe: true,
        disponible: false,
        activadaEnEstaMaquina: true,
        mensaje: "Licencia válida. Ya está activada en este dispositivo.",
        docId: resultado.docId,
        datos: datos
      };
    }

    // Licencia activada en OTRA máquina
    if (datos.estado === "activado" && datos.machine_id !== machineId) {
      return {
        existe: true,
        disponible: false,
        activadaEnEstaMaquina: false,
        mensaje: "Esta licencia ya fue activada en otro dispositivo."
      };
    }

    return {
      existe: true,
      disponible: false,
      activadaEnEstaMaquina: false,
      mensaje: "Estado de licencia desconocido."
    };
  }

  // ─── VERIFICAR SI HAY LICENCIA ACTIVA EN STORAGE ──────

  async function estaActivaLocalmente() {
    return new Promise(resolve => {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(["mineducLicencia"], result => {
          const lic = result.mineducLicencia;
          resolve(Boolean(lic && lic.activada));
        });
      } else {
        try {
          const lic = JSON.parse(localStorage.getItem("mineducLicencia"));
          resolve(Boolean(lic && lic.activada));
        } catch (e) {
          resolve(false);
        }
      }
    });
  }

  // ─── OBTENER LICENCIA LOCAL ────────────────────────────

  async function obtenerLicenciaLocal() {
    return new Promise(resolve => {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(["mineducLicencia"], result => {
          resolve(result.mineducLicencia || null);
        });
      } else {
        try {
          resolve(JSON.parse(localStorage.getItem("mineducLicencia")));
        } catch (e) {
          resolve(null);
        }
      }
    });
  }

  // ─── API PÚBLICA ───────────────────────────────────────

  return {
    COLECCION,
    obtenerMachineId,
    buscarLicencia,
    verificarCodigo,
    estaActivaLocalmente,
    obtenerLicenciaLocal
  };
})();

if (typeof window !== "undefined") window.Licencias = Licencias;
