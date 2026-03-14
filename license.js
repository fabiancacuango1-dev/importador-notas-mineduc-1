/**
 * license.js — Sistema de licencias via Cloudflare Worker API
 * Importador de Notas Mineduc
 *
 * Usa el backend Worker: mineduc-license-api.fabiancacuango1.workers.dev
 * NO depende de Firebase/Firestore.
 * Patron IIFE compatible con content scripts Chrome Extension (Manifest V3).
 *
 * Expone: window.FirebaseLicense
 */
const FirebaseLicense = (() => {
  "use strict";

  const API_BASE = "https://mineduc-license-api.fabiancacuango1.workers.dev";
  const FREE_STUDENT_LIMIT = 30;

  var _cacheValida = false;
  var _cacheMaquinaId = "";

  // ─── STORAGE HELPERS ───────────────────────────────────

  function storageGet(keys) {
    return new Promise(function (resolve) {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(keys, function (r) { resolve(r || {}); });
      } else {
        var result = {};
        keys.forEach(function (k) {
          try { result[k] = JSON.parse(localStorage.getItem(k)); } catch (e) { result[k] = null; }
        });
        resolve(result);
      }
    });
  }

  function storageSet(payload) {
    return new Promise(function (resolve) {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set(payload, function () { resolve(); });
      } else {
        for (var k in payload) {
          if (payload.hasOwnProperty(k)) {
            try { localStorage.setItem(k, JSON.stringify(payload[k])); } catch (e) { /* ok */ }
          }
        }
        resolve();
      }
    });
  }

  // ─── IDENTIFICADOR ÚNICO DE MÁQUINA (SHA-256) ─────────

  async function obtenerMaquinaId() {
    if (_cacheMaquinaId) return _cacheMaquinaId;

    var partes = [
      navigator.userAgent,
      navigator.language,
      screen.width + "x" + screen.height + "x" + screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.hardwareConcurrency || "unknown"
    ];
    var texto = partes.join("|");
    var datos = new TextEncoder().encode(texto);
    var hashBuffer = await crypto.subtle.digest("SHA-256", datos);
    var hashArray = Array.from(new Uint8Array(hashBuffer));
    _cacheMaquinaId = hashArray.map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
    return _cacheMaquinaId;
  }

  // ─── ACTIVAR LICENCIA VIA WORKER API ───────────────────

  async function activarLicencia(codigo, teacherId) {
    try {
      var fingerprint = await obtenerMaquinaId();
      var codigoNorm = (codigo || "").trim().toUpperCase();
      if (!codigoNorm) return { exito: false, mensaje: "Código vacío." };

      console.log("[License] Activando código via Worker:", codigoNorm);
      var resp = await fetch(API_BASE + "/licenses/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_key: codigoNorm,
          teacher_id: teacherId || "unknown",
          browser_fingerprint: fingerprint
        })
      });

      var data = await resp.json();
      console.log("[License] Respuesta activate:", JSON.stringify(data));

      if (data.success) {
        _cacheValida = true;
        return { exito: true, mensaje: data.message || "¡Licencia activada! Modo Pro habilitado." };
      }
      return { exito: false, mensaje: data.error || "No se pudo activar la licencia." };
    } catch (error) {
      console.error("[License] Error al activar:", error);
      return { exito: false, mensaje: "Error de conexión. Revisa tu internet." };
    }
  }

  // ─── VALIDAR LICENCIA VIA WORKER API ───────────────────

  async function verificarLicencia(codigo) {
    if (!codigo) return false;
    if (_cacheValida) return true;

    try {
      var fingerprint = await obtenerMaquinaId();
      var license = await getLocalLicense();
      var teacherId = (license && license.teacherId) || "";

      var params = new URLSearchParams({
        license_key: codigo,
        teacher_id: teacherId,
        browser_fingerprint: fingerprint
      });

      var resp = await fetch(API_BASE + "/licenses/validate?" + params.toString(), { method: "GET" });
      var data = await resp.json();
      console.log("[License] Respuesta validate:", JSON.stringify(data));

      if (data.valid) {
        _cacheValida = true;
        return true;
      }
      return false;
    } catch (error) {
      console.error("[License] Error al verificar:", error);
      // Si hay error de red, confiar en la cache local
      var local = await getLocalLicense();
      return Boolean(local && local.activated);
    }
  }

  // ─── LOCAL LICENSE STORAGE ─────────────────────────────

  async function getLocalLicense() {
    var stored = await storageGet(["mineducFirebaseLicense"]);
    return stored.mineducFirebaseLicense || null;
  }

  async function saveLocalLicense(data) {
    await storageSet({ mineducFirebaseLicense: data });
  }

  async function clearLocalLicense() {
    _cacheValida = false;
    await storageSet({ mineducFirebaseLicense: null });
  }

  async function isLicenseActive() {
    var license = await getLocalLicense();
    if (!license || !license.activated) return false;
    return await verificarLicencia(license.key);
  }

  // ─── STUDENT USAGE TRACKING ────────────────────────────

  async function getStudentsUsed() {
    var stored = await storageGet(["mineducStudentsUsed"]);
    return Number(stored.mineducStudentsUsed || 0);
  }

  async function addStudentsUsed(count) {
    var current = await getStudentsUsed();
    await storageSet({ mineducStudentsUsed: current + count });
  }

  async function canProcessStudents(count) {
    var licensed = await isLicenseActive();
    if (licensed) return { allowed: true };

    var used = await getStudentsUsed();
    var remaining = FREE_STUDENT_LIMIT - used;

    if (remaining <= 0) {
      return { allowed: false, message: "Límite de prueba gratuita alcanzado (30 estudiantes). Activa tu licencia." };
    }
    if (count > remaining) {
      return { allowed: false, message: "Solo quedan " + remaining + " estudiantes en modo prueba. Activa tu licencia." };
    }
    return { allowed: true, remaining: remaining };
  }

  /**
   * Activar licencia — interfaz publica compatible con content.js / paymentModal.js
   */
  async function activateLicense(licenseKey, teacherId) {
    var key = (licenseKey || "").trim().toUpperCase();
    if (!key || key.length < 4) {
      return { success: false, error: "Código de licencia inválido." };
    }

    var result = await activarLicencia(key, teacherId || "");

    if (result.exito) {
      var licenseData = {
        key: key,
        teacherId: teacherId,
        fingerprint: await obtenerMaquinaId(),
        activated: true,
        activatedAt: new Date().toISOString()
      };
      await saveLocalLicense(licenseData);
      return { success: true, license: licenseData };
    }

    return { success: false, error: result.mensaje };
  }

  /**
   * Validar licencia antes de importar.
   */
  async function validateLicenseBeforeImport(teacherId) {
    var license = await getLocalLicense();
    if (!license || !license.activated) {
      var check = await canProcessStudents(1);
      return check.allowed ? { valid: true, mode: "trial" } : { valid: false, error: check.message };
    }

    var ok = await verificarLicencia(license.key);
    if (!ok) {
      await clearLocalLicense();
      return { valid: false, error: "Licencia inválida o vinculada a otro dispositivo." };
    }
    return { valid: true, mode: "licensed" };
  }

  // ─── API PÚBLICA ───────────────────────────────────────

  return {
    FREE_STUDENT_LIMIT: FREE_STUDENT_LIMIT,
    obtenerMaquinaId: obtenerMaquinaId,
    activarLicencia: activarLicencia,
    verificarLicencia: verificarLicencia,
    isLicenseActive: isLicenseActive,
    getLocalLicense: getLocalLicense,
    getStudentsUsed: getStudentsUsed,
    addStudentsUsed: addStudentsUsed,
    canProcessStudents: canProcessStudents,
    activateLicense: activateLicense,
    validateLicenseBeforeImport: validateLicenseBeforeImport,
    clearLocalLicense: clearLocalLicense
  };
})();

if (typeof window !== "undefined") window.FirebaseLicense = FirebaseLicense;
