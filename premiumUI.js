/**
 * premiumUI.js — Indicadores visuales del estado Premium
 * Importador de Notas Mineduc
 *
 * Depende de: license.js (FirebaseLicense), paymentModal.js (PaymentModal)
 * Patron IIFE compatible con content scripts Chrome Extension (Manifest V3).
 *
 * Responsabilidades:
 *  - Mostrar/ocultar el botón Premium en el panel
 *  - Mostrar badge "Premium activado" cuando hay licencia
 *  - Mostrar indicador inferior "Suscripción Premium activa"
 *  - Mostrar alerta de modo prueba cuando se excede el límite
 *
 * Expone: window.PremiumUI
 */
const PremiumUI = (() => {
  "use strict";

  const PREMIUM_BTN_ID  = "mineducPremiumBtn";
  const PREMIUM_BADGE_ID = "mineducPremiumBadge";
  const PREMIUM_FOOTER_ID = "mineducPremiumFooter";
  const TRIAL_WARN_ID   = "mineducTrialWarning";

  // ─── REFRESH — punto de entrada principal ──────────────
  // Llama a esto cada vez que cambie el estado de billing.

  async function refresh() {
    var isPremium = false;

    // 1. Revisar state global
    if (typeof window.__mineducState !== "undefined" && window.__mineducState.billing) {
      isPremium = Boolean(window.__mineducState.billing.premium);
    }

    // 2. Si no hay premium en state, consultar FirebaseLicense
    if (!isPremium && typeof FirebaseLicense !== "undefined") {
      isPremium = await FirebaseLicense.isLicenseActive();
      if (isPremium && typeof window.__mineducState !== "undefined") {
        window.__mineducState.billing.premium = true;
      }
    }

    updatePremiumButton(isPremium);
    updatePremiumBadge(isPremium);
    updatePremiumFooter(isPremium);

    // Ocultar secciones de pago viejas si está premium
    if (isPremium) {
      hideOldBillingUI();
    }
  }

  // ─── BOTÓN PREMIUM (en la barra de acciones) ──────────

  function updatePremiumButton(isPremium) {
    var btn = document.getElementById(PREMIUM_BTN_ID);
    if (!btn) return;

    if (isPremium) {
      btn.classList.add("mineduc-hidden");
    } else {
      btn.classList.remove("mineduc-hidden");
    }
  }

  // ─── BADGE "Premium activado" (junto al título) ───────

  function updatePremiumBadge(isPremium) {
    var badge = document.getElementById(PREMIUM_BADGE_ID);

    if (isPremium) {
      if (!badge) {
        badge = document.createElement("span");
        badge.id = PREMIUM_BADGE_ID;
        badge.className = "mineduc-premium-badge";
        badge.textContent = "\u2705 Premium activado";
        var header = document.querySelector(".mineduc-head h3");
        if (header && header.parentNode) {
          header.parentNode.insertBefore(badge, header.nextSibling);
        }
      }
      badge.classList.remove("mineduc-hidden");
    } else {
      if (badge) badge.classList.add("mineduc-hidden");
    }
  }

  // ─── FOOTER PREMIUM (parte inferior del panel) ────────

  function updatePremiumFooter(isPremium) {
    var footer = document.getElementById(PREMIUM_FOOTER_ID);

    if (isPremium) {
      if (!footer) {
        footer = document.createElement("div");
        footer.id = PREMIUM_FOOTER_ID;
        footer.className = "mineduc-premium-footer";
        footer.innerHTML = '<span class="mineduc-premium-footer-check">\u2714</span> Suscripci\u00f3n Premium activa<br><small>Importaci\u00f3n ilimitada habilitada</small>';
        var panel = document.getElementById("mineducNotasPanel");
        if (panel) panel.appendChild(footer);
      }
      footer.classList.remove("mineduc-hidden");
    } else {
      if (footer) footer.classList.add("mineduc-hidden");
    }
  }

  // ─── OCULTAR UI DE PAGO VIEJA ─────────────────────────

  function hideOldBillingUI() {
    var payActions = document.getElementById("mineducPayActions");
    var licenseBox = document.getElementById("mineducLicenseBox");
    var billingSection = document.getElementById("mineducBillingSection");
    if (payActions) payActions.classList.add("mineduc-hidden");
    if (licenseBox) licenseBox.classList.add("mineduc-hidden");
    if (billingSection) billingSection.classList.add("mineduc-hidden");
  }

  // ─── ALERTA DE MODO PRUEBA ─────────────────────────────

  /**
   * Muestra una advertencia cuando quedan pocos estudiantes en modo prueba.
   * @param {number} remaining — Estudiantes restantes
   */
  function showTrialWarning(remaining) {
    var warn = document.getElementById(TRIAL_WARN_ID);

    if (remaining > 10) {
      if (warn) warn.classList.add("mineduc-hidden");
      return;
    }

    if (!warn) {
      warn = document.createElement("div");
      warn.id = TRIAL_WARN_ID;
      warn.className = "mineduc-trial-warning";
      var panel = document.getElementById("mineducNotasPanel");
      var actions = document.getElementById("mineducActionsContainer");
      if (panel && actions) {
        panel.insertBefore(warn, actions.nextSibling);
      } else if (panel) {
        panel.appendChild(warn);
      }
    }

    if (remaining <= 0) {
      warn.innerHTML = '\u26A0\uFE0F L\u00edmite de prueba alcanzado. <a href="#" id="mineducTrialUpgrade">Activa tu licencia Premium</a> para continuar.';
    } else {
      warn.innerHTML = 'Solo quedan <strong>' + remaining + '</strong> estudiantes en modo prueba. <a href="#" id="mineducTrialUpgrade">Activa tu licencia Premium</a> para continuar.';
    }
    warn.classList.remove("mineduc-hidden");

    // Link abre el modal
    var link = document.getElementById("mineducTrialUpgrade");
    if (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        if (typeof PaymentModal !== "undefined") PaymentModal.open();
      });
    }
  }

  /**
   * Oculta la advertencia de prueba.
   */
  function hideTrialWarning() {
    var warn = document.getElementById(TRIAL_WARN_ID);
    if (warn) warn.classList.add("mineduc-hidden");
  }

  // ─── API PÚBLICA ───────────────────────────────────────

  return {
    refresh: refresh,
    showTrialWarning: showTrialWarning,
    hideTrialWarning: hideTrialWarning
  };
})();

if (typeof window !== "undefined") window.PremiumUI = PremiumUI;
