/**
 * licenseManager.js
 * Gestiona licencias de uso unico, prueba gratuita y validacion contra backend.
 */
const LicenseManager = (() => {
  const FREE_STUDENT_LIMIT = 30;

  function getLicenseApiBase() {
    return window.__mineducState?.licenseApiBase || "";
  }

  async function generateFingerprint() {
    const parts = [
      navigator.userAgent,
      navigator.language,
      screen.width + "x" + screen.height,
      Intl.DateTimeFormat().resolvedOptions().timeZone
    ];
    const raw = parts.join("|");
    const encoder = new TextEncoder();
    const data = encoder.encode(raw);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  }

  function storageGet(keys) {
    return new Promise(resolve => {
      if (!chrome?.storage?.local) { resolve({}); return; }
      chrome.storage.local.get(keys, result => resolve(result || {}));
    });
  }

  function storageSet(payload) {
    return new Promise(resolve => {
      if (!chrome?.storage?.local) { resolve(); return; }
      chrome.storage.local.set(payload, () => resolve());
    });
  }

  async function getLocalLicense() {
    const stored = await storageGet(["mineducLicense"]);
    return stored.mineducLicense || null;
  }

  async function saveLocalLicense(data) {
    await storageSet({ mineducLicense: data });
  }

  async function clearLocalLicense() {
    await storageSet({ mineducLicense: null });
  }

  async function isLicenseActive() {
    const license = await getLocalLicense();
    return Boolean(license && license.activated);
  }

  async function getStudentsUsed() {
    const stored = await storageGet(["mineducStudentsUsed"]);
    return Number(stored.mineducStudentsUsed || 0);
  }

  async function addStudentsUsed(count) {
    const current = await getStudentsUsed();
    await storageSet({ mineducStudentsUsed: current + count });
  }

  async function canProcessStudents(count) {
    const licensed = await isLicenseActive();
    if (licensed) return { allowed: true };

    const used = await getStudentsUsed();
    const remaining = FREE_STUDENT_LIMIT - used;

    if (remaining <= 0) {
      return {
        allowed: false,
        message: "Debe activar licencia para continuar. Limite de prueba gratuita alcanzado (30 estudiantes)."
      };
    }

    if (count > remaining) {
      return {
        allowed: false,
        message: `Solo quedan ${remaining} estudiantes en modo prueba. Activa tu licencia para importar sin limites.`
      };
    }

    return { allowed: true, remaining };
  }

  async function activateLicense(licenseKey, teacherId) {
    if (!licenseKey || !/^[A-Z0-9]{8,}$/.test(licenseKey.trim().toUpperCase())) {
      return { success: false, error: "Formato de licencia invalido." };
    }

    const fingerprint = await generateFingerprint();
    const apiBase = getLicenseApiBase();

    if (!apiBase) {
      return { success: false, error: "API de licencias no configurada." };
    }

    try {
      const response = await fetch(`${apiBase}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_key: licenseKey.trim().toUpperCase(),
          teacher_id: teacherId,
          browser_fingerprint: fingerprint
        })
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        return { success: false, error: data.error || "No se pudo activar la licencia." };
      }

      const licenseData = {
        key: licenseKey.trim().toUpperCase(),
        teacherId,
        fingerprint,
        activated: true,
        activatedAt: new Date().toISOString()
      };

      await saveLocalLicense(licenseData);
      return { success: true, license: licenseData };
    } catch (err) {
      return { success: false, error: "Error de conexion al validar licencia: " + (err.message || err) };
    }
  }

  async function validateLicenseBeforeImport(teacherId) {
    const license = await getLocalLicense();
    if (!license || !license.activated) {
      const check = await canProcessStudents(1);
      return check.allowed
        ? { valid: true, mode: "trial" }
        : { valid: false, error: check.message };
    }

    const apiBase = getLicenseApiBase();
    if (!apiBase) return { valid: true, mode: "licensed" };

    try {
      const fingerprint = await generateFingerprint();
      const params = new URLSearchParams({
        license_key: license.key,
        teacher_id: teacherId,
        browser_fingerprint: fingerprint
      });

      const response = await fetch(`${apiBase}/validate?${params.toString()}`, {
        method: "GET"
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        if (data.error === "LICENCIA YA UTILIZADA") {
          await clearLocalLicense();
          return { valid: false, error: "LICENCIA YA UTILIZADA en otro usuario o navegador." };
        }
        return { valid: false, error: data.error || "Licencia rechazada por el servidor." };
      }

      return { valid: true, mode: "licensed" };
    } catch (err) {
      return { valid: true, mode: "licensed" };
    }
  }

  return {
    FREE_STUDENT_LIMIT,
    generateFingerprint,
    getLocalLicense,
    isLicenseActive,
    getStudentsUsed,
    addStudentsUsed,
    canProcessStudents,
    activateLicense,
    validateLicenseBeforeImport,
    clearLocalLicense
  };
})();

if (typeof window !== "undefined") window.LicenseManager = LicenseManager;
