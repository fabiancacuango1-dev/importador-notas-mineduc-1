/**
 * activate.js — Funciones de activación y compra por WhatsApp
 * Importador de Notas Mineduc
 *
 * Depende de: license.js (FirebaseLicense)
 * Patron IIFE compatible con content scripts Chrome Extension.
 *
 * No crea UI propia — se integra con el panel existente de content.js.
 * Provee funciones auxiliares que content.js puede invocar.
 *
 * Expone: window.ActivateHelper
 */
const ActivateHelper = (() => {
  "use strict";

  const CONFIG = {
    whatsappNumero: "593983274499",
    whatsappMensaje: "Quiero comprar la licencia del Importador de Notas Mineduc",
    precioTexto: "$5.00 USD"
  };

  // ─── ABRIR WHATSAPP ────────────────────────────────────

  function abrirWhatsApp() {
    var mensaje = encodeURIComponent(CONFIG.whatsappMensaje);
    var url = "https://wa.me/" + CONFIG.whatsappNumero + "?text=" + mensaje;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  // ─── PROCESAR ACTIVACIÓN ───────────────────────────────

  /**
   * Valida el código y delega a FirebaseLicense.activateLicense.
   * Retorna formato compatible con content.js (success/error).
   */
  async function procesarActivacion(codigo, teacherId) {
    var codigoLimpio = (codigo || "").trim().toUpperCase();

    if (!codigoLimpio) {
      return { success: false, error: "Ingresa un código de licencia." };
    }
    if (codigoLimpio.length < 6) {
      return { success: false, error: "El código es demasiado corto." };
    }

    if (typeof FirebaseLicense === "undefined") {
      return { success: false, error: "Sistema de licencias no disponible." };
    }

    return await FirebaseLicense.activateLicense(codigoLimpio, teacherId || "");
  }

  // ─── VERIFICAR AL INICIAR ──────────────────────────────

  /**
   * Verifica si ya hay licencia activa en este dispositivo.
   * @returns {Promise<boolean>}
   */
  async function verificarAlIniciar() {
    if (typeof FirebaseLicense === "undefined") return false;
    return await FirebaseLicense.isLicenseActive();
  }

  // ─── API PÚBLICA ───────────────────────────────────────

  return {
    CONFIG: CONFIG,
    abrirWhatsApp: abrirWhatsApp,
    procesarActivacion: procesarActivacion,
    verificarAlIniciar: verificarAlIniciar
  };
})();

if (typeof window !== "undefined") window.ActivateHelper = ActivateHelper;
