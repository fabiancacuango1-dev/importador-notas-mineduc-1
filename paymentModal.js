/**
 * paymentModal.js — Modal de pago Premium
 * Importador de Notas Mineduc
 *
 * Depende de: license.js (FirebaseLicense), activate.js (ActivateHelper)
 * Patron IIFE compatible con content scripts Chrome Extension (Manifest V3).
 *
 * Métodos de pago: PayPal y WhatsApp únicamente.
 * Expone: window.PaymentModal
 */
const PaymentModal = (() => {
  "use strict";

  const MODAL_ID = "mineducPremiumModal";
  const OVERLAY_ID = "mineducPremiumOverlay";

  const WHATSAPP_NUM = "593983274499";
  const WHATSAPP_MSG = "Quiero comprar la licencia del Importador de Notas Mineduc";

  // ─── CREAR MODAL ───────────────────────────────────────

  function buildModal() {
    if (document.getElementById(MODAL_ID)) return;

    // Overlay
    var overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.className = "mineduc-modal-overlay";
    overlay.addEventListener("click", close);

    // Modal
    var modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.className = "mineduc-modal";
    modal.innerHTML = [
      '<div class="mineduc-modal-header">',
      '  <h3>\u2B50 Activar versi\u00f3n Premium</h3>',
      '  <button id="mineducModalClose" type="button" class="mineduc-modal-close">\u2715</button>',
      '</div>',

      '<div class="mineduc-modal-body">',
      '  <div class="mineduc-modal-benefits">',
      '    <p class="mineduc-modal-subtitle">Beneficios:</p>',
      '    <ul>',
      '      <li>\u2705 Importaci\u00f3n ilimitada de estudiantes</li>',
      '      <li>\u2705 Automatizaci\u00f3n completa</li>',
      '      <li>\u2705 Soporte para formatos Normal, Vocacional y C\u00edvica</li>',
      '      <li>\u2705 Sin l\u00edmite de carga</li>',
      '    </ul>',
      '    <p class="mineduc-modal-price">Precio: <strong>$5.00 USD</strong> \u2014 pago \u00fanico</p>',
      '  </div>',

      '  <div class="mineduc-modal-divider"></div>',

      '  <p class="mineduc-modal-subtitle">Solicitar licencia:</p>',
      '  <div class="mineduc-modal-pay-grid">',
      '    <button id="mineducModalWhatsApp" type="button" class="mineduc-modal-pay-btn mineduc-pay-whatsapp" style="width:100%">',
      '      \uD83D\uDCAC Solicitar por WhatsApp ($5 USD)',
      '    </button>',
      '  </div>',
      '  <small class="mineduc-modal-pay-hint">Realiza tu pago por WhatsApp y recibir\u00e1s el c\u00f3digo de licencia.</small>',

      '  <div class="mineduc-modal-divider"></div>',

      '  <p class="mineduc-modal-subtitle">\uD83D\uDD11 Activar licencia</p>',
      '  <div class="mineduc-modal-license-row">',
      '    <input id="mineducModalLicenseInput" type="text" placeholder="Ej: MINEDUC-A1B2C3D4" class="mineduc-modal-license-input" />',
      '    <button id="mineducModalActivateBtn" type="button" class="mineduc-modal-activate-btn">Activar</button>',
      '  </div>',
      '  <p id="mineducModalMsg" class="mineduc-modal-msg"></p>',
      '</div>'
    ].join("\n");

    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    // ─── EVENTOS ─────────────────────────────────────────

    document.getElementById("mineducModalClose").addEventListener("click", close);

    document.getElementById("mineducModalWhatsApp").addEventListener("click", function () {
      var msg = encodeURIComponent(WHATSAPP_MSG);
      window.open("https://wa.me/" + WHATSAPP_NUM + "?text=" + msg, "_blank", "noopener,noreferrer");
    });

    document.getElementById("mineducModalActivateBtn").addEventListener("click", handleModalActivation);

    // Enter en el input
    document.getElementById("mineducModalLicenseInput").addEventListener("keydown", function (e) {
      if (e.key === "Enter") handleModalActivation();
    });
  }

  // ─── ACTIVAR DESDE MODAL ──────────────────────────────

  async function handleModalActivation() {
    var input = document.getElementById("mineducModalLicenseInput");
    var btn = document.getElementById("mineducModalActivateBtn");
    var code = (input.value || "").trim().toUpperCase();

    if (!code) { showMsg("Ingresa un c\u00f3digo de licencia.", "warn"); return; }
    if (code.length < 6) { showMsg("El c\u00f3digo es demasiado corto.", "warn"); return; }

    btn.disabled = true;
    btn.textContent = "Verificando...";
    showMsg("Conectando con Firebase...", "info");

    var teacherId = "";
    if (typeof window.__mineducState !== "undefined") {
      teacherId = window.__mineducState.teacher ? window.__mineducState.teacher.key : "";
    }

    var result;
    if (typeof FirebaseLicense !== "undefined") {
      result = await FirebaseLicense.activateLicense(code, teacherId);
    } else {
      result = { success: false, error: "Sistema de licencias no cargado." };
    }

    if (result.success) {
      showMsg("\u2705 \u00a1Licencia activada! Cerrando...", "ok");
      // Actualizar state global
      if (typeof window.__mineducState !== "undefined") {
        window.__mineducState.billing.premium = true;
        window.__mineducState.billing.licenseCode = code;
      }
      // Notificar a premiumUI
      if (typeof PremiumUI !== "undefined") PremiumUI.refresh();
      setTimeout(close, 1200);
    } else {
      showMsg(result.error || "No se pudo activar la licencia.", "warn");
      btn.disabled = false;
      btn.textContent = "Activar";
    }
  }

  // ─── MENSAJES ──────────────────────────────────────────

  function showMsg(text, type) {
    var el = document.getElementById("mineducModalMsg");
    if (!el) return;
    el.textContent = text;
    el.className = "mineduc-modal-msg" + (type === "ok" ? " ok" : type === "warn" ? " warn" : "");
  }

  // ─── ABRIR / CERRAR ───────────────────────────────────

  function open() {
    buildModal();
    var overlay = document.getElementById(OVERLAY_ID);
    var modal = document.getElementById(MODAL_ID);
    if (overlay) overlay.classList.add("visible");
    if (modal) modal.classList.add("visible");
    // Reset mensaje
    showMsg("", "");
    var input = document.getElementById("mineducModalLicenseInput");
    if (input) { input.value = ""; input.focus(); }
    var btn = document.getElementById("mineducModalActivateBtn");
    if (btn) { btn.disabled = false; btn.textContent = "Activar"; }
  }

  function close() {
    var overlay = document.getElementById(OVERLAY_ID);
    var modal = document.getElementById(MODAL_ID);
    if (overlay) overlay.classList.remove("visible");
    if (modal) modal.classList.remove("visible");
  }

  function isOpen() {
    var modal = document.getElementById(MODAL_ID);
    return modal ? modal.classList.contains("visible") : false;
  }

  // ─── API PÚBLICA ───────────────────────────────────────

  return {
    open: open,
    close: close,
    isOpen: isOpen
  };
})();

if (typeof window !== "undefined") window.PaymentModal = PaymentModal;
