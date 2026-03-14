/**
 * licenseGuard.js — Sistema antipiratería y validación periódica
 * Importador de Notas Mineduc
 *
 * Se inyecta como content script adicional ANTES de license.js.
 * Implementa:
 *  - Fingerprint de dispositivo robusto (SHA-256)
 *  - Validación periódica contra el servidor
 *  - Detección de manipulación del storage
 *  - Auto-desactivación si la licencia es inválida
 *  - Pre-activación desde instalador (license_preactivation.json)
 *
 * Expone: window.LicenseGuard
 */
const LicenseGuard = (() => {
  "use strict";

  // ═══ CONFIGURACIÓN ═══

  const CONFIG = {
    // Intervalo de revalidación: cada 4 horas
    revalidateIntervalMs: 4 * 60 * 60 * 1000,
    // Intervalo de heartbeat en sesión activa: cada 30 min
    heartbeatIntervalMs: 30 * 60 * 1000,
    // Máximo tiempo offline permitido antes de bloquear: 7 días
    maxOfflineMs: 7 * 24 * 60 * 60 * 1000,
    // Storage keys
    storageKeys: {
      license: "mineducFirebaseLicense",
      fingerprint: "mineducDeviceFingerprint",
      lastValidation: "mineducLastValidation",
      installSignature: "mineducInstallSignature",
      validationFailCount: "mineducValidationFailCount",
    },
    // Máximo fallos de validación antes de bloquear
    maxValidationFails: 3,
  };

  let _heartbeatTimer = null;
  let _cachedFingerprint = "";

  // ═══ FINGERPRINTING DE DISPOSITIVO ═══

  async function generateDeviceFingerprint() {
    if (_cachedFingerprint) return _cachedFingerprint;

    const components = [];

    // Hardware
    components.push("ua:" + navigator.userAgent);
    components.push("lang:" + navigator.language);
    components.push("langs:" + (navigator.languages || []).join(","));
    components.push(
      "screen:" +
        screen.width +
        "x" +
        screen.height +
        "x" +
        screen.colorDepth +
        "x" +
        (screen.pixelDepth || "")
    );
    components.push("cores:" + (navigator.hardwareConcurrency || "?"));
    components.push("tz:" + Intl.DateTimeFormat().resolvedOptions().timeZone);
    components.push("platform:" + (navigator.platform || ""));

    // WebGL renderer (identificador de GPU)
    try {
      const canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (gl) {
        const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
        if (debugInfo) {
          components.push(
            "gpu:" + gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
          );
        }
      }
    } catch (_) {
      /* silenciar */
    }

    // Touch support
    components.push("touch:" + navigator.maxTouchPoints);

    // Memory (si disponible)
    if (navigator.deviceMemory) {
      components.push("mem:" + navigator.deviceMemory);
    }

    const raw = components.join("|");
    const data = new TextEncoder().encode(raw);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    _cachedFingerprint = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return _cachedFingerprint;
  }

  // ═══ STORAGE HELPERS ═══

  function storageGet(keys) {
    return new Promise((resolve) => {
      if (
        typeof chrome !== "undefined" &&
        chrome.storage &&
        chrome.storage.local
      ) {
        chrome.storage.local.get(keys, (r) => resolve(r || {}));
      } else {
        const result = {};
        keys.forEach((k) => {
          try {
            result[k] = JSON.parse(localStorage.getItem(k));
          } catch (_) {
            result[k] = null;
          }
        });
        resolve(result);
      }
    });
  }

  function storageSet(payload) {
    return new Promise((resolve) => {
      if (
        typeof chrome !== "undefined" &&
        chrome.storage &&
        chrome.storage.local
      ) {
        chrome.storage.local.set(payload, () => resolve());
      } else {
        for (const k in payload) {
          if (Object.prototype.hasOwnProperty.call(payload, k)) {
            try {
              localStorage.setItem(k, JSON.stringify(payload[k]));
            } catch (_) {
              /* ok */
            }
          }
        }
        resolve();
      }
    });
  }

  // ═══ FIRMA DE INTEGRIDAD ═══
  // Genera un hash del estado de la licencia para detectar manipulación

  async function computeIntegritySignature(licenseData, fingerprint) {
    const payload =
      (licenseData.key || "") +
      "|" +
      (licenseData.teacherId || "") +
      "|" +
      fingerprint +
      "|" +
      (licenseData.activatedAt || "");
    const data = new TextEncoder().encode(payload);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function verifyStorageIntegrity() {
    const stored = await storageGet([
      CONFIG.storageKeys.license,
      CONFIG.storageKeys.installSignature,
      CONFIG.storageKeys.fingerprint,
    ]);

    const license = stored[CONFIG.storageKeys.license];
    const savedSignature = stored[CONFIG.storageKeys.installSignature];
    const savedFingerprint = stored[CONFIG.storageKeys.fingerprint];

    if (!license || !license.activated) return { valid: false, reason: "no-license" };

    const currentFingerprint = await generateDeviceFingerprint();

    // Verificar que el fingerprint no cambió (mismo dispositivo)
    if (savedFingerprint && savedFingerprint !== currentFingerprint) {
      return { valid: false, reason: "device-mismatch" };
    }

    // Verificar firma de integridad
    if (savedSignature) {
      const expectedSignature = await computeIntegritySignature(
        license,
        currentFingerprint
      );
      if (savedSignature !== expectedSignature) {
        return { valid: false, reason: "tampered" };
      }
    }

    return { valid: true, license };
  }

  // ═══ VALIDACIÓN PERIÓDICA CONTRA SERVIDOR ═══

  async function validateWithServer(forceCheck) {
    const stored = await storageGet([
      CONFIG.storageKeys.license,
      CONFIG.storageKeys.lastValidation,
      CONFIG.storageKeys.validationFailCount,
    ]);

    const license = stored[CONFIG.storageKeys.license];
    if (!license || !license.activated || !license.key) {
      return { valid: false, reason: "no-license" };
    }

    const lastValidation = stored[CONFIG.storageKeys.lastValidation] || 0;
    const now = Date.now();

    // Si no es forzada, verificar si necesita revalidación
    if (!forceCheck && now - lastValidation < CONFIG.revalidateIntervalMs) {
      return { valid: true, cached: true };
    }

    const fingerprint = await generateDeviceFingerprint();
    const apiBase =
      (typeof window.__mineducState !== "undefined" &&
        window.__mineducState.licenseApiBase) ||
      "https://mineduc-license-api.fabiancacuango1.workers.dev";

    try {
      const params = new URLSearchParams({
        license_key: license.key,
        teacher_id: license.teacherId || "",
        browser_fingerprint: fingerprint,
      });

      const resp = await fetch(apiBase + "/licenses/validate?" + params.toString(), {
        method: "GET",
      });
      const data = await resp.json();

      if (data.valid) {
        // Revalidación exitosa
        await storageSet({
          [CONFIG.storageKeys.lastValidation]: now,
          [CONFIG.storageKeys.fingerprint]: fingerprint,
          [CONFIG.storageKeys.validationFailCount]: 0,
        });

        // Actualizar firma de integridad
        const sig = await computeIntegritySignature(license, fingerprint);
        await storageSet({ [CONFIG.storageKeys.installSignature]: sig });

        return { valid: true, serverVerified: true };
      } else {
        // Licencia rechazada por el servidor
        const failCount =
          (stored[CONFIG.storageKeys.validationFailCount] || 0) + 1;
        await storageSet({
          [CONFIG.storageKeys.validationFailCount]: failCount,
        });

        if (failCount >= CONFIG.maxValidationFails) {
          await deactivateLicense("server-rejected");
          return { valid: false, reason: "server-rejected", deactivated: true };
        }

        return { valid: false, reason: "server-rejected", failCount };
      }
    } catch (networkError) {
      // Error de red — verificar tiempo offline
      const offlineTime = now - lastValidation;
      if (offlineTime > CONFIG.maxOfflineMs) {
        await deactivateLicense("offline-expired");
        return { valid: false, reason: "offline-too-long", deactivated: true };
      }

      // Permitir uso offline temporal
      return { valid: true, offline: true, offlineTime };
    }
  }

  // ═══ DESACTIVACIÓN AUTOMÁTICA ═══

  async function deactivateLicense(reason) {
    console.warn("[LicenseGuard] Desactivando licencia. Razón:", reason);

    const stored = await storageGet([CONFIG.storageKeys.license]);
    const license = stored[CONFIG.storageKeys.license];

    if (license) {
      license.activated = false;
      license.deactivatedAt = new Date().toISOString();
      license.deactivationReason = reason;
    }

    await storageSet({
      [CONFIG.storageKeys.license]: license,
      [CONFIG.storageKeys.installSignature]: null,
    });

    // Notificar a otros módulos
    if (typeof window.__mineducState !== "undefined") {
      window.__mineducState.billing.premium = false;
    }

    // Actualizar UI si PremiumUI está disponible
    if (typeof PremiumUI !== "undefined" && PremiumUI.refresh) {
      PremiumUI.refresh();
    }
  }

  // ═══ HEARTBEAT — validación en segundo plano ═══

  function startHeartbeat() {
    if (_heartbeatTimer) return;

    _heartbeatTimer = setInterval(async () => {
      const result = await validateWithServer(false);
      if (result.deactivated) {
        stopHeartbeat();
      }
    }, CONFIG.heartbeatIntervalMs);
  }

  function stopHeartbeat() {
    if (_heartbeatTimer) {
      clearInterval(_heartbeatTimer);
      _heartbeatTimer = null;
    }
  }

  // ═══ INICIALIZACIÓN ═══

  async function initialize() {
    // 1. Verificar integridad del storage
    const integrity = await verifyStorageIntegrity();
    if (integrity.valid === false && integrity.reason === "tampered") {
      console.warn("[LicenseGuard] Manipulación detectada en el storage");
      await deactivateLicense("tampered");
      return { active: false, reason: "tampered" };
    }

    if (integrity.valid === false && integrity.reason === "device-mismatch") {
      console.warn("[LicenseGuard] Dispositivo no coincide");
      await deactivateLicense("device-mismatch");
      return { active: false, reason: "device-mismatch" };
    }

    // 2. Validar contra servidor
    const serverResult = await validateWithServer(false);

    if (serverResult.valid) {
      startHeartbeat();
      return { active: true, mode: serverResult.offline ? "offline" : "online" };
    }

    return { active: false, reason: serverResult.reason };
  }

  // ═══ PRE-ACTIVACIÓN DESDE INSTALADOR ═══

  async function checkPreactivation() {
    try {
      // Buscar archivo de pre-activación creado por el instalador
      // Este se lee vía fetch relativo al directorio de la extensión
      const resp = await fetch(
        chrome.runtime.getURL("license_preactivation.json")
      );
      if (!resp.ok) return null;

      const preact = await resp.json();
      if (preact && preact.preactivated && preact.licenseKey) {
        return preact.licenseKey;
      }
    } catch (_) {
      // No hay archivo de preactivación (normal si el usuario no ingresó código)
    }
    return null;
  }

  // ═══ API PÚBLICA ═══

  return {
    initialize,
    generateDeviceFingerprint,
    validateWithServer,
    verifyStorageIntegrity,
    checkPreactivation,
    startHeartbeat,
    stopHeartbeat,
    deactivateLicense,
    CONFIG,
  };
})();

if (typeof window !== "undefined") window.LicenseGuard = LicenseGuard;
