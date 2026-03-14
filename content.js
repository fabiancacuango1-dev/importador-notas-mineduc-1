/**
 * content.js — Orquestador principal del Importador de Notas Mineduc.
 * Coordina los modulos: FirebaseLicense, FormatHandler, BulkUploader, CivicaAutoFill, PaymentModal, PremiumUI.
 */
(() => {
  const IDS = {
    launcher: "mineducNotasLauncher",
    panel: "mineducNotasPanel",
    hiddenInput: "mineducNotasInput",
    selectButton: "mineducSelectExcelBtn",
    executeButton: "mineducRunImportBtn",
    templateButton: "mineducTemplateBtn",
    clearLoadButton: "mineducClearLoadBtn",
    actionsContainer: "mineducActionsContainer",
    status: "mineducStatusText",
    loaded: "mineducLoadedText",
    saveOption: "mineducOptionSave",
    nextOption: "mineducOptionNext",
    smartOption: "mineducOptionSmart",
    oneClickOption: "mineducOptionOneClick",
    closePanel: "mineducPanelClose",
    teacherInfo: "mineducTeacherInfo",
    billingSection: "mineducBillingSection",
    billingStatus: "mineducBillingStatus",
    payphoneButton: "mineducPayphoneBtn",
    paypalButton: "mineducPaypalBtn",
    paymentHint: "mineducPaymentHint",
    formatSelect: "mineducFormatSelect",
    premiumButton: "mineducPremiumBtn"
  };

  const RULES = {
    minGrade: 0,
    maxGrade: 10,
    rowSaveDelay: 250,
    pageWaitMs: 1200,
    similarityThreshold: 0.82,
    freeRuns: 3,
    maxTeachers: 2,
    premiumPriceUsd: 5.00,
    freeStudentLimit: 30
  };

  const BILLING = {
    payphoneCheckoutUrl: "https://ppls.me/p7aXRq2flYO7ofkHtfhFlQ",
    paypalCheckoutUrl: "",
    licenseApiBase: "https://mineduc-license-api.fabiancacuango1.workers.dev/licenses",
    autoCheckIntervalMs: 7000,
    localPendingTtlMs: 15 * 60 * 1000,
  };

  const state = {
    running: false,
    records: [],
    byCedula: new Map(),
    lastUrl: location.href,
    panelAutoOpened: false,
    licenseApiBase: BILLING.licenseApiBase,
    teacherBlocked: false,
    installId: null,
    teacher: {
      key: "DOCENTE_DESCONOCIDO",
      label: "Docente no detectado"
    },
    payphonePollTimer: null,
    paymentCapabilities: {
      payphoneReady: null,
      payphoneError: "",
      paypalReady: null,
      paypalError: ""
    },
    billing: {
      premium: false,
      runsUsed: 0,
      paymentPending: false,
      paymentPendingSince: "",
      paymentProvider: "",
      licenseCode: ""
    }
  };

  // Exponer state para que los modulos (FirebaseLicense, etc.) lean licenseApiBase
  window.__mineducState = state;

  // ═══════════════════════════════════════════════════════════
  //  LICENCIA GUARD — Inicialización antipiratería
  // ═══════════════════════════════════════════════════════════

  async function initLicenseGuard() {
    if (typeof LicenseGuard === "undefined") return;

    // Verificar si hay pre-activación del instalador
    var preKey = await LicenseGuard.checkPreactivation();
    if (preKey && typeof FirebaseLicense !== "undefined") {
      var preResult = await FirebaseLicense.activateLicense(preKey, state.teacher.key);
      if (preResult.success) {
        state.billing.premium = true;
        state.billing.licenseCode = preKey;
        console.log("[Importador] Licencia pre-activada desde instalador");
      }
    }

    // Inicializar validación periódica y anti-manipulación
    var guardResult = await LicenseGuard.initialize();
    if (guardResult.active) {
      state.billing.premium = true;
    } else if (guardResult.reason === "tampered" || guardResult.reason === "device-mismatch") {
      state.billing.premium = false;
      console.warn("[Importador] Licencia invalidada:", guardResult.reason);
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  LICENCIA Y PRUEBA GRATUITA (delega a FirebaseLicense)
  // ═══════════════════════════════════════════════════════════

  async function checkLicenseOrTrial() {
    if (typeof FirebaseLicense !== "undefined") {
      var licensed = await FirebaseLicense.isLicenseActive();
      if (licensed) {
        if (typeof PremiumUI !== "undefined") PremiumUI.hideTrialWarning();
        return { allowed: true, mode: "licensed" };
      }
    }

    if (state.billing.premium) {
      if (typeof PremiumUI !== "undefined") PremiumUI.hideTrialWarning();
      return { allowed: true, mode: "premium" };
    }

    // Prueba gratuita: limite por cantidad de estudiantes
    if (typeof FirebaseLicense !== "undefined") {
      var check = await FirebaseLicense.canProcessStudents(state.records.length);
      if (!check.allowed && typeof PremiumUI !== "undefined") {
        PremiumUI.showTrialWarning(0);
      } else if (check.remaining !== undefined && typeof PremiumUI !== "undefined") {
        PremiumUI.showTrialWarning(check.remaining);
      }
      return check;
    }

    // Fallback si FirebaseLicense no cargo
    if (state.records.length > RULES.freeStudentLimit) {
      if (typeof PremiumUI !== "undefined") PremiumUI.showTrialWarning(0);
      return { allowed: false, message: "El modo prueba solo permite hasta " + RULES.freeStudentLimit + " estudiantes. Activa el modo Pro." };
    }
    return { allowed: true, mode: "trial" };
  }

  async function handleActivateLicense(code) {
    if (!code) {
      alert("Por favor ingresa un codigo de licencia.");
      return;
    }

    if (typeof FirebaseLicense !== "undefined") {
      var teacherId = state.teacher.key;
      var result = await FirebaseLicense.activateLicense(code, teacherId);

      if (result.success) {
        state.billing.premium = true;
        state.billing.licenseCode = code;
        await saveTeacherBillingState();
        renderBillingState();
        var payActions = document.getElementById("mineducPayActions");
        var licenseBox = document.getElementById("mineducLicenseBox");
        if (payActions) payActions.style.display = "none";
        if (licenseBox) licenseBox.style.display = "none";
        alert("¡Licencia activada! Modo Pro habilitado.");
      } else {
        alert(result.error || "No se pudo activar la licencia.");
      }
    } else {
      alert("Sistema de licencias no disponible. Recarga la pagina.");
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  UI: CREACION DEL PANEL Y BOTON FLOTANTE
  // ═══════════════════════════════════════════════════════════

  function ensureUI() {
    if (document.getElementById(IDS.launcher)) return;
    console.log("[Importador IA] Creando boton flotante y panel...");

    const launcher = document.createElement("button");
    launcher.id = IDS.launcher;
    launcher.textContent = "\u{1F4CB} Importar Notas";
    launcher.addEventListener("click", togglePanel);
    document.body.appendChild(launcher);

    if (document.getElementById(IDS.panel)) return;

    const panel = document.createElement("div");
    panel.id = IDS.panel;
    panel.className = "mineduc-hidden";
    panel.innerHTML = `
      <div class="mineduc-head">
        <h3>Importador de Notas</h3>
        <button id="${IDS.closePanel}" type="button">\u2715</button>
      </div>
      <div id="${IDS.teacherInfo}" class="mineduc-teacher">Docente no detectado</div>
      <div id="${IDS.status}" class="mineduc-status">Verificando vista...</div>
      <div id="${IDS.loaded}" class="mineduc-loaded">Archivo cargado: ninguno</div>

      <div class="mineduc-format-row">
        <label for="${IDS.formatSelect}" class="mineduc-format-label">Formato:</label>
        <select id="${IDS.formatSelect}" class="mineduc-format-select">
          <option value="normal">Normal (0-10)</option>
          <option value="vocacional">Orientacion vocacional</option>
          <option value="civica">Civica</option>
        </select>
      </div>

      <div class="mineduc-actions" id="${IDS.actionsContainer}">
        <button id="${IDS.selectButton}" type="button">\u{1F4C2} Seleccionar archivo</button>
        <button id="${IDS.premiumButton}" type="button" class="mineduc-premium-btn">\u2B50 Premium</button>
        <button id="${IDS.clearLoadButton}" type="button" class="mineduc-hidden">\u{1F5D1} Limpiar carga</button>
        <button id="${IDS.executeButton}" type="button" disabled>\u25B6 Ejecutar carga masiva</button>
      </div>

      <div class="mineduc-advanced">
        <label><input type="checkbox" id="${IDS.saveOption}" checked /> Guardar cada fila</label>
        <label><input type="checkbox" id="${IDS.nextOption}" checked /> Paginar automaticamente</label>
        <label><input type="checkbox" id="${IDS.smartOption}" checked /> Coincidencia inteligente IA</label>
        <label><input type="checkbox" id="${IDS.oneClickOption}" /> Un clic: cargar y ejecutar</label>
      </div>

      <ul class="mineduc-feature-list">
        <li>Carga por cedula o nombre inteligente</li>
        <li>Paginacion automatica</li>
        <li>Guardado fila a fila</li>
        <li>Formatos: Normal, Vocacional, C\u00edvica</li>
      </ul>

      <section id="${IDS.billingSection}" class="mineduc-billing">
        <div id="${IDS.billingStatus}" class="mineduc-billing-status"></div>
        <button id="${IDS.payphoneButton}" type="button" class="mineduc-hidden" style="display:none!important;"></button>
        <button id="${IDS.paypalButton}" type="button" class="mineduc-hidden" style="display:none!important;"></button>
        <div class="mineduc-pay-actions" id="mineducPayActions" style="margin-bottom:10px;">
          <button id="mineducWhatsappBtn" type="button" class="mineduc-whatsapp-btn">💬 Solicitar licencia por WhatsApp</button>
        </div>
        <div class="mineduc-license-box" id="mineducLicenseBox">
          <input id="mineducLicenseInput" type="text" placeholder="Ingresa tu licencia" class="mineduc-license-input" />
          <button id="mineducActivateBtn" type="button" class="mineduc-activate-btn">Activar</button>
        </div>
        <small id="${IDS.paymentHint}" class="mineduc-help" style="color:#4a5c79;">Solicita tu licencia y act\u00edvala aqu\u00ed para habilitar el modo Pro.</small>
      </section>

      <small class="mineduc-help">
        Tipos soportados: Excel, CSV, TXT. PDF/Word: an\u00e1lisis local por mejor esfuerzo.
      </small>
    `;

    const hiddenInput = document.createElement("input");
    hiddenInput.id = IDS.hiddenInput;
    hiddenInput.type = "file";
    hiddenInput.accept = ".xlsx,.xls,.csv,.txt,.pdf,.doc,.docx";
    hiddenInput.className = "mineduc-hidden";

    document.body.appendChild(panel);
    document.body.appendChild(hiddenInput);

    // Event listeners
    document.getElementById(IDS.closePanel).addEventListener("click", togglePanel);
    document.getElementById(IDS.selectButton).addEventListener("click", () => hiddenInput.click());
    document.getElementById(IDS.clearLoadButton).addEventListener("click", clearLoadedFileData);
    document.getElementById(IDS.executeButton).addEventListener("click", () => runMassImport());
    document.getElementById(IDS.payphoneButton).addEventListener("click", openPayPhoneCheckout);
    document.getElementById(IDS.paypalButton).addEventListener("click", openPayPalCheckout);

    // Botón Premium → abre modal de pago
    document.getElementById(IDS.premiumButton).addEventListener("click", function () {
      if (typeof PaymentModal !== "undefined") {
        PaymentModal.open();
      } else {
        alert("El modulo de pago no esta disponible. Recarga la pagina.");
      }
    });

    document.getElementById(IDS.formatSelect).addEventListener("change", function () {
      if (typeof FormatHandler !== "undefined") FormatHandler.setFormat(this.value);
      updateCompatibilityStatus();
      updateRunButtonState();
      console.log("[Importador IA] Formato cambiado a:", this.value);
      // Auto-descargar plantilla al cambiar formato
      downloadTemplate();
    });

    document.getElementById("mineducWhatsappBtn").addEventListener("click", function () {
      var numero = "593983274499";
      var mensaje = encodeURIComponent("Quiero comprar la licencia del Importador de Notas Mineduc");
      window.open("https://wa.me/" + numero + "?text=" + mensaje, "_blank", "noopener,noreferrer");
    });

    document.getElementById("mineducActivateBtn").addEventListener("click", function () {
      const input = document.getElementById("mineducLicenseInput");
      const code = (input.value || "").trim().toUpperCase();
      handleActivateLicense(code);
    });

    hiddenInput.addEventListener("change", onFilePicked);
    console.log("[Importador IA] Panel y boton flotante creados.");
  }

  // ═══════════════════════════════════════════════════════════
  //  BOOTSTRAP
  // ═══════════════════════════════════════════════════════════

  async function bootstrap() {
    console.log("[Importador IA] Inicializando extension...");
    try {
      state.installId = await ensureInstallId();
      await loadBillingConfig();
      // Inicializar LicenseGuard (antipiratería + pre-activación instalador)
      await initLicenseGuard();
      ensureUI();
      await syncTeacherContext({ silent: true });
      await refreshPaymentCapabilities();
      renderBillingState();
      updateCompatibilityStatus();
      // Inicializar indicadores Premium
      if (typeof PremiumUI !== "undefined") await PremiumUI.refresh();
      registerRuntimeBridge();
      watchRouteChanges();
      console.log("[Importador IA] Extension cargada correctamente.");
    } catch (error) {
      console.error("[Importador IA] Error critico al iniciar:", error);
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  TOGGLE / NAV / OBSERVER
  // ═══════════════════════════════════════════════════════════

  function togglePanel() {
    const panel = document.getElementById(IDS.panel);
    if (!panel) return;
    panel.classList.toggle("mineduc-hidden");
    updateCompatibilityStatus();
  }

  function watchRouteChanges() {
    setInterval(() => {
      if (state.lastUrl === location.href) return;
      state.lastUrl = location.href;
      state.panelAutoOpened = false;
      void syncTeacherContext({ silent: true });
      updateCompatibilityStatus();
      autoOpenPanelIfCompatible();
    }, 500);

    setInterval(() => {
      void syncTeacherContext({ silent: true });
    }, 4000);

    const observer = new MutationObserver(() => {
      if (!document.getElementById(IDS.launcher) || !document.getElementById(IDS.panel)) {
        ensureUI();
        void syncTeacherContext({ silent: true });
        renderBillingState();
        updateCompatibilityStatus();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    autoOpenPanelIfCompatible();
  }

  function autoOpenPanelIfCompatible() {
    if (state.panelAutoOpened || !isGradesView()) return;
    const panel = document.getElementById(IDS.panel);
    if (!panel) return;
    panel.classList.remove("mineduc-hidden");
    state.panelAutoOpened = true;
    // Auto-descargar plantilla del formato actual al abrir panel por primera vez
    try { downloadTemplate(); } catch (e) { /* ignore */ }
  }

  function registerRuntimeBridge() {
    if (!chrome || !chrome.runtime || !chrome.runtime.onMessage) return;
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || !message.type) return;
      if (message.type === "OPEN_IMPORTER_PANEL") {
        ensureUI();
        const panel = document.getElementById(IDS.panel);
        if (panel) panel.classList.remove("mineduc-hidden");
        updateCompatibilityStatus();
      }
      if (message.type === "OPEN_FILE_PICKER") {
        ensureUI();
        const panel = document.getElementById(IDS.panel);
        if (panel) panel.classList.remove("mineduc-hidden");
        const input = document.getElementById(IDS.hiddenInput);
        if (input) input.click();
      }

      // ── Activar licencia desde popup ──
      if (message.type === "ACTIVATE_LICENSE") {
        (async () => {
          try {
            let resultado;
            if (typeof Activacion !== "undefined") {
              resultado = await Activacion.activarLicencia(message.codigo, state.teacher.key);
            } else if (typeof FirebaseLicense !== "undefined") {
              const r = await FirebaseLicense.activateLicense(message.codigo, state.teacher.key);
              resultado = r.success ? { exito: true, mensaje: "¡Licencia activada! Modo Pro habilitado." } : { exito: false, mensaje: r.error };
            } else {
              resultado = { exito: false, mensaje: "Sistema de licencias no disponible." };
            }
            if (resultado.exito) {
              state.billing.premium = true;
              state.billing.licenseCode = message.codigo;
              await saveTeacherBillingState();
              renderBillingState();
              if (typeof PremiumUI !== "undefined") await PremiumUI.refresh();
            }
            sendResponse(resultado);
          } catch (e) {
            sendResponse({ exito: false, mensaje: "Error de conexión." });
          }
        })();
        return true; // mantener canal abierto para sendResponse async
      }

      // ── Consultar estado de licencia desde popup ──
      if (message.type === "CHECK_LICENSE_STATUS") {
        (async () => {
          let active = state.billing.premium;
          if (!active && typeof FirebaseLicense !== "undefined") {
            active = await FirebaseLicense.isLicenseActive();
          }
          if (!active && typeof Licencias !== "undefined") {
            active = await Licencias.estaActivaLocalmente();
          }
          sendResponse({ active: active });
        })();
        return true;
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  TEACHER CONTEXT & BILLING STATE
  // ═══════════════════════════════════════════════════════════

  async function syncTeacherContext(options = {}) {
    const { silent = false } = options;
    const detected = detectAcademicTeacher();
    const nextKey = detected.key || "DOCENTE_DESCONOCIDO";
    const previousKey = state.teacher.key;

    state.teacher.key = nextKey;
    state.teacher.label = detected.label || "Docente no detectado";

    await loadTeacherBillingState();
    await tryAutoActivateSubscription();
    renderBillingState();

    if (!silent && previousKey && previousKey !== nextKey) {
      alert("Se detecto un docente diferente. La extension cargo el estado individual de ese usuario academico.");
    }
  }

  async function loadTeacherBillingState() {
    const stored = await storageGet(["teacherPlans"]);
    const plans = stored.teacherPlans || {};
    const current = plans[state.teacher.key] || {};
    state.billing.premium = Boolean(current.premium);
    state.billing.paymentPending = Boolean(current.paymentPending);
    state.billing.paymentPendingSince = String(current.paymentPendingSince || "");
    state.billing.paymentProvider = String(current.paymentProvider || "");
    state.billing.runsUsed = Number(current.runsUsed || 0);
    state.billing.licenseCode = String(current.licenseCode || "");

    if (state.billing.paymentPending && !isLocalPendingFresh()) {
      state.billing.paymentPending = false;
      state.billing.paymentPendingSince = "";
      state.billing.paymentProvider = "";
      await saveTeacherBillingState();
    }

    const knownKeys = Object.keys(plans).filter(k => k !== "DOCENTE_DESCONOCIDO" && k.length >= 6);
    const isKnown = knownKeys.includes(state.teacher.key);
    const isUnknown = state.teacher.key === "DOCENTE_DESCONOCIDO";
    state.teacherBlocked = !isKnown && !isUnknown && knownKeys.length >= RULES.maxTeachers;

    if (state.billing.premium) stopPayPhoneAutoCheck();
    else if (state.billing.paymentPending) startPayPhoneAutoCheck();
  }

  async function saveTeacherBillingState() {
    const stored = await storageGet(["teacherPlans"]);
    const plans = stored.teacherPlans || {};
    plans[state.teacher.key] = {
      premium: state.billing.premium,
      paymentPending: state.billing.paymentPending,
      paymentPendingSince: state.billing.paymentPendingSince,
      paymentProvider: state.billing.paymentProvider,
      runsUsed: state.billing.runsUsed,
      licenseCode: state.billing.licenseCode,
      teacherLabel: state.teacher.label,
      updatedAt: new Date().toISOString()
    };
    await storageSet({ teacherPlans: plans });
  }

  function remainingFreeRuns() {
    return Math.max(0, RULES.freeRuns - state.billing.runsUsed);
  }

  function hasAccess() {
    if (state.teacherBlocked) return false;
    return state.billing.premium || state.billing.runsUsed < RULES.freeRuns;
  }

  function isLocalPendingFresh() {
    const since = new Date(state.billing.paymentPendingSince || "").getTime();
    if (!since || Number.isNaN(since)) return false;
    return Date.now() - since <= BILLING.localPendingTtlMs;
  }

  // ═══════════════════════════════════════════════════════════
  //  RENDER BILLING STATE
  // ═══════════════════════════════════════════════════════════

  function renderBillingState() {
    const teacherInfo = document.getElementById(IDS.teacherInfo);
    const statusEl = document.getElementById(IDS.billingStatus);
    const billingSection = document.getElementById(IDS.billingSection);
    const payButton = document.getElementById(IDS.payphoneButton);
    const paypalButton = document.getElementById(IDS.paypalButton);
    const actionsContainer = document.getElementById(IDS.actionsContainer);
    const advancedDiv = document.querySelector(".mineduc-advanced");
    const featureList = document.querySelector(".mineduc-feature-list");
    const payActions = document.querySelector(".mineduc-pay-actions");
    const licenseBox = document.querySelector(".mineduc-license-box");
    const teacherDetected = hasDetectedTeacherIdentity();
    const pendingFresh = state.billing.paymentPending && isLocalPendingFresh();

    if (teacherInfo) {
      teacherInfo.textContent = teacherDetected ? "Docente: " + state.teacher.label : "Docente no detectado";
    }

    if (state.teacherBlocked) {
      if (billingSection) billingSection.classList.remove("mineduc-hidden");
      if (actionsContainer) actionsContainer.classList.add("mineduc-hidden");
      if (advancedDiv) advancedDiv.classList.add("mineduc-hidden");
      if (featureList) featureList.classList.add("mineduc-hidden");
      if (payActions) payActions.classList.add("mineduc-hidden");
      if (licenseBox) licenseBox.classList.add("mineduc-hidden");
      if (statusEl) {
        statusEl.textContent = "Limite alcanzado: solo se permiten " + RULES.maxTeachers + " docentes por navegador.";
        statusEl.className = "mineduc-billing-status blocked";
      }
      updateRunButtonState();
      return;
    }

    const mustShowBilling = (!state.billing.premium && state.billing.runsUsed >= RULES.freeRuns) || state.billing.paymentPending;

    if (billingSection) billingSection.classList.toggle("mineduc-hidden", !mustShowBilling && !state.billing.premium);
    if (actionsContainer) actionsContainer.classList.remove("mineduc-hidden");
    if (advancedDiv) advancedDiv.classList.remove("mineduc-hidden");
    if (featureList) featureList.classList.remove("mineduc-hidden");
    if (payActions) payActions.classList.toggle("mineduc-hidden", state.billing.premium);
    if (licenseBox) licenseBox.classList.toggle("mineduc-hidden", state.billing.premium);

    // PayPhone y PayPal ocultos permanentemente en panel lateral
    if (payButton) payButton.style.display = "none";
    if (paypalButton) paypalButton.style.display = "none";

    if (!statusEl) { updateRunButtonState(); return; }
    if (!mustShowBilling) { updateRunButtonState(); return; }

    if (state.billing.premium) {
      statusEl.textContent = "\u2705 Suscripcion activa. Importacion ilimitada habilitada.";
      statusEl.className = "mineduc-billing-status ok";
    } else if (!teacherDetected) {
      statusEl.textContent = "No se pudo identificar al docente. Recarga la pagina.";
      statusEl.className = "mineduc-billing-status warn";
    } else if (state.billing.paymentPending) {
      statusEl.textContent = "\u23F3 Verificando pago para " + state.teacher.label + "...";
      statusEl.className = "mineduc-billing-status warn";
    } else {
      statusEl.textContent = "Se agotaron las " + RULES.freeRuns + " ejecuciones gratis. Activa tu suscripcion.";
      statusEl.className = "mineduc-billing-status blocked";
    }

    const paymentHint = document.getElementById(IDS.paymentHint);
    if (paymentHint) {
      if (state.billing.premium) {
        paymentHint.textContent = "Pago confirmado. Suscripcion activa para este docente.";
      } else if (pendingFresh) {
        var label = state.billing.paymentProvider === "paypal" ? "PayPal" : "PayPhone";
        paymentHint.textContent = "Verificando pago por " + label + " cada 7 segundos...";
      } else {
        var tips = [];
        if (state.paymentCapabilities.payphoneReady === false) tips.push("PayPhone no habilitado.");
        if (state.paymentCapabilities.paypalReady === false) tips.push("PayPal requiere configuracion.");
        paymentHint.textContent = "Solicita tu licencia o paga para activar modo Pro." + (tips.length ? " " + tips.join(" ") : "");
      }
    }
    updateRunButtonState();
  }

  // ═══════════════════════════════════════════════════════════
  //  BILLING CONFIG / PAYMENT APIS
  // ═══════════════════════════════════════════════════════════

  function normalizeLicenseApiBase(value) {
    var raw = String(value || "").trim();
    if (!raw) return "";
    var withProtocol = /^https?:\/\//i.test(raw) ? raw : "https://" + raw;
    var withoutSlash = withProtocol.replace(/\/+$/, "");
    return /\/licenses$/i.test(withoutSlash) ? withoutSlash : withoutSlash + "/licenses";
  }

  function isLicenseApiBaseConfigured(value) {
    var base = String(value || "").trim();
    return Boolean(base) && !base.includes("TU_DOMINIO_API");
  }

  async function loadBillingConfig() {
    var stored = await storageGet(["billingConfig"]);
    var customBase = normalizeLicenseApiBase(stored?.billingConfig?.licenseApiBase);
    state.licenseApiBase = customBase || BILLING.licenseApiBase;
  }

  async function ensureLicenseApiBaseConfigured() {
    if (isLicenseApiBaseConfigured(state.licenseApiBase)) return state.licenseApiBase;
    var input = window.prompt("Pega la URL de tu Worker de Cloudflare para pagos.\nEjemplo: https://mineduc-license-api.tu-cuenta.workers.dev");
    if (!input) return "";
    var normalized = normalizeLicenseApiBase(input);
    if (!isLicenseApiBaseConfigured(normalized)) {
      alert("URL invalida.");
      return "";
    }
    state.licenseApiBase = normalized;
    await storageSet({ billingConfig: { licenseApiBase: normalized, updatedAt: new Date().toISOString() } });
    await refreshPaymentCapabilities();
    return normalized;
  }

  function getLicenseApiRoot() {
    var base = String(state.licenseApiBase || "").trim().replace(/\/+$/, "");
    if (!base) return "";
    return base.replace(/\/licenses$/i, "");
  }

  async function refreshPaymentCapabilities() {
    if (!isLicenseApiBaseConfigured(state.licenseApiBase)) {
      state.paymentCapabilities.payphoneReady = true;
      state.paymentCapabilities.payphoneError = "";
      state.paymentCapabilities.paypalReady = false;
      state.paymentCapabilities.paypalError = "Configura primero la URL del Worker.";
      return;
    }
    try {
      var response = await fetch(state.licenseApiBase + "/capabilities", { method: "GET" });
      if (!response.ok) {
        state.paymentCapabilities.payphoneReady = true;
        state.paymentCapabilities.paypalReady = false;
        state.paymentCapabilities.paypalError = "No disponible (" + response.status + ").";
        return;
      }
      var payload = await response.json();
      state.paymentCapabilities.payphoneReady = Boolean(payload?.payphone?.ready ?? true);
      state.paymentCapabilities.payphoneError = String(payload?.payphone?.error || "");
      state.paymentCapabilities.paypalReady = Boolean(payload?.paypal?.ready);
      state.paymentCapabilities.paypalError = payload?.paypal?.ready ? "" : String(payload?.paypal?.error || "PayPal no listo.");
    } catch (error) {
      state.paymentCapabilities.payphoneReady = true;
      state.paymentCapabilities.paypalReady = false;
      state.paymentCapabilities.paypalError = String(error?.message || "Error de red.");
    }
  }

  function openPayPhoneCheckout() {
    if (!hasDetectedTeacherIdentity()) {
      alert("No pudimos identificar al docente. Recarga la pagina.");
      return;
    }
    if (state.paymentCapabilities.payphoneReady === false) {
      alert("PayPhone no habilitado.\n\n" + state.paymentCapabilities.payphoneError);
      return;
    }
    void beginAutomaticSubscriptionFlow("payphone");
  }

  function openPayPalCheckout() {
    if (!hasDetectedTeacherIdentity()) {
      alert("No pudimos identificar al docente. Recarga la pagina.");
      return;
    }
    void (async () => {
      await refreshPaymentCapabilities();
      if (!state.paymentCapabilities.paypalReady) {
        alert("PayPal no habilitado.\n\n" + state.paymentCapabilities.paypalError);
        renderBillingState();
        return;
      }
      await beginAutomaticSubscriptionFlow("paypal");
    })();
  }

  async function beginAutomaticSubscriptionFlow(provider) {
    var normalizedProvider = provider === "paypal" ? "paypal" : "payphone";
    var apiBase = await ensureLicenseApiBaseConfigured();
    if (!apiBase && normalizedProvider === "paypal") {
      alert("Configura primero la URL de tu Worker de Cloudflare.");
      return;
    }

    var session = await createCheckoutSession(normalizedProvider);
    if (session?.error) {
      alert("Error de checkout: " + session.error);
      return;
    }

    if (!session || !session.checkoutUrl) {
      var fallbackUrl = normalizedProvider === "payphone"
        ? String(BILLING.payphoneCheckoutUrl || "").trim()
        : String(BILLING.paypalCheckoutUrl || "").trim();
      if (!fallbackUrl) {
        alert("No se pudo generar el checkout.");
        return;
      }
      state.billing.paymentPending = true;
      state.billing.paymentPendingSince = new Date().toISOString();
      state.billing.paymentProvider = normalizedProvider;
      await saveTeacherBillingState();
      startPayPhoneAutoCheck();
      renderBillingState();
      window.open(fallbackUrl, "_blank", "noopener,noreferrer");
      return;
    }

    state.billing.paymentPending = true;
    state.billing.paymentPendingSince = new Date().toISOString();
    state.billing.paymentProvider = normalizedProvider;
    await saveTeacherBillingState();
    startPayPhoneAutoCheck();
    renderBillingState();
    window.open(session.checkoutUrl, "_blank", "noopener,noreferrer");
  }

  async function createCheckoutSession(provider) {
    try {
      var base = isLicenseApiBaseConfigured(state.licenseApiBase)
        ? state.licenseApiBase
        : await ensureLicenseApiBaseConfigured();
      if (!isLicenseApiBaseConfigured(base)) return { error: "URL de Worker no configurada." };

      var path = provider === "paypal" ? "paypal-checkout" : "payphone-checkout";
      var response = await fetch(base + "/" + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherKey: state.teacher.key,
          teacherLabel: state.teacher.label,
          installId: state.installId || "unknown"
        })
      });

      if (!response.ok) {
        var msg = "Error del backend.";
        try { var p = await response.json(); msg = p?.error || p?.message || msg; } catch (_e) { msg = await response.text(); }
        return { error: response.status + " - " + msg };
      }
      return await response.json();
    } catch (error) {
      return { error: String(error?.message || "Error de red") };
    }
  }

  async function checkAutomaticSubscriptionStatus() {
    try {
      var base = state.licenseApiBase;
      if (!isLicenseApiBaseConfigured(base)) return { paid: false, pending: state.billing.paymentPending };

      var query = "teacherKey=" + encodeURIComponent(state.teacher.key) + "&installId=" + encodeURIComponent(state.installId || "");
      var providers = state.billing.paymentProvider ? [state.billing.paymentProvider] : ["payphone", "paypal"];

      for (var i = 0; i < providers.length; i++) {
        var prov = providers[i];
        var path = prov === "paypal" ? "paypal-status" : "payphone-status";
        var response = await fetch(base + "/" + path + "?" + query, { method: "GET" });
        if (!response.ok) continue;
        var payload = await response.json();
        var paid = Boolean(payload?.paid);
        var pending = Boolean(payload?.pending);
        if (!paid && !pending) continue;
        return { paid: paid, pending: pending, provider: String(payload?.provider || prov), licenseCode: String(payload?.licenseCode || "") };
      }
      return { paid: false, pending: false, provider: "", licenseCode: "" };
    } catch (error) {
      return { paid: false, pending: state.billing.paymentPending };
    }
  }

  function startPayPhoneAutoCheck() {
    if (state.payphonePollTimer || state.billing.premium) return;
    state.payphonePollTimer = setInterval(async () => {
      var result = await checkAutomaticSubscriptionStatus();
      if (!result.paid) {
        state.billing.paymentPending = result.pending;
        state.billing.paymentProvider = result.pending ? String(result.provider || state.billing.paymentProvider || "") : "";
        state.billing.paymentPendingSince = result.pending ? state.billing.paymentPendingSince || new Date().toISOString() : "";
        await saveTeacherBillingState();
        renderBillingState();
        return;
      }
      state.billing.premium = true;
      state.billing.paymentPending = false;
      state.billing.paymentPendingSince = "";
      state.billing.paymentProvider = "";
      state.billing.licenseCode = result.licenseCode || state.billing.licenseCode;
      await saveTeacherBillingState();
      stopPayPhoneAutoCheck();
      renderBillingState();
      alert("Pago confirmado para " + state.teacher.label + ". Suscripcion activada.");
    }, BILLING.autoCheckIntervalMs);
  }

  function stopPayPhoneAutoCheck() {
    if (!state.payphonePollTimer) return;
    clearInterval(state.payphonePollTimer);
    state.payphonePollTimer = null;
  }

  async function tryAutoActivateSubscription() {
    if (state.billing.premium) return;
    var result = await checkAutomaticSubscriptionStatus();
    if (!result.paid) {
      state.billing.paymentPending = result.pending;
      state.billing.paymentProvider = result.pending ? String(result.provider || state.billing.paymentProvider || "") : "";
      state.billing.paymentPendingSince = result.pending ? state.billing.paymentPendingSince || new Date().toISOString() : "";
      await saveTeacherBillingState();
      if (state.billing.paymentPending) startPayPhoneAutoCheck();
      return;
    }
    state.billing.premium = true;
    state.billing.paymentPending = false;
    state.billing.paymentPendingSince = "";
    state.billing.paymentProvider = "";
    state.billing.licenseCode = result.licenseCode || state.billing.licenseCode;
    await saveTeacherBillingState();
    stopPayPhoneAutoCheck();
  }

  // ═══════════════════════════════════════════════════════════
  //  COMPATIBILITY, STATUS, BUTTON
  // ═══════════════════════════════════════════════════════════

  function isGradesView() {
    var hasInput = document.querySelectorAll("table input").length > 0;
    var hasSelect = document.querySelectorAll("table select").length > 0;
    var hasSave = Array.from(document.querySelectorAll("button, input[type='button'], input[type='submit']"))
      .some(function (el) { return /guardar/i.test(el.textContent || el.value || ""); });
    return hasInput || hasSelect || hasSave;
  }

  function getActiveFormat() {
    if (typeof FormatHandler !== "undefined") return FormatHandler.getFormat();
    var sel = document.getElementById(IDS.formatSelect);
    return sel ? sel.value : "normal";
  }

  function getFormatLabel(format) {
    if (typeof FormatHandler !== "undefined") return FormatHandler.getFormatLabel(format);
    var labels = { normal: "Normal (0-10)", vocacional: "Orientacion vocacional", civica: "Civica" };
    return labels[format] || format;
  }

  function updateCompatibilityStatus() {
    var compatible = isGradesView();
    var statusEl = document.getElementById(IDS.status);
    if (!statusEl) return;

    var format = getActiveFormat();
    var formatLabel = getFormatLabel(format);

    if (compatible) {
      statusEl.textContent = "Listo \u2014 formato: " + formatLabel + ". Puedes ejecutar carga masiva.";
      statusEl.className = "mineduc-status ok";
    } else {
      statusEl.textContent = "Vista no compatible (" + formatLabel + "). Abre una materia con el boton lapiz.";
      statusEl.className = "mineduc-status warn";
    }
    updateRunButtonState();
  }

  function updateRunButtonState() {
    var run = document.getElementById(IDS.executeButton);
    if (!run) return;
    updateLoadedActionsVisibility();
    run.disabled = state.running || state.teacherBlocked || !state.records.length || !isGradesView() || !hasAccess();
  }

  function updateLoadedActionsVisibility() {
    var clearBtn = document.getElementById(IDS.clearLoadButton);
    if (clearBtn) clearBtn.classList.toggle("mineduc-hidden", state.records.length === 0);
  }

  function clearLoadedFileData() {
    state.records = [];
    state.byCedula = new Map();
    var input = document.getElementById(IDS.hiddenInput);
    if (input) input.value = "";
    setLoadedText("Archivo cargado: ninguno");
    updateLoadedActionsVisibility();
    updateRunButtonState();
    updateCompatibilityStatus();
    alert("Carga limpiada.");
  }

  // ═══════════════════════════════════════════════════════════
  //  FILE PARSING — delega a FormatHandler para vocacional/civica
  // ═══════════════════════════════════════════════════════════

  async function onFilePicked(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;

    try {
      setRunning(true, "Paso 1: analizando archivo...");
      var format = getActiveFormat();
      var records;

      if ((format === "civica" || format === "vocacional") && typeof FormatHandler !== "undefined") {
        var rows = await parseFileToRows(file);
        records = FormatHandler.parseRecordsForFormat(rows, format);
        if (!records || !records.length) {
          alert("No se encontraron registros validos para el formato seleccionado.");
          state.records = [];
          state.byCedula = new Map();
          setLoadedText("Archivo cargado: sin registros validos");
          return;
        }
        var validation = FormatHandler.validateRecords(records, format);
        if (!validation.valid) {
          var errMsg = validation.errors.slice(0, 5).map(function (e) { return "Fila " + e.row + ": " + e.error; }).join("\n");
          alert("Errores de validacion (" + format + "):\n" + errMsg);
        }
        records = validation.records;
      } else {
        records = await parseRecordsFromFile(file);
      }

      if (!records.length) {
        alert("No se pudo extraer informacion valida.");
        state.records = [];
        state.byCedula = new Map();
        setLoadedText("Archivo cargado: sin registros validos");
        return;
      }

      state.records = records.map(function (r, idx) { return Object.assign({}, r, { id: String(idx + 1) }); });
      state.byCedula = new Map(state.records.filter(function (r) { return r.cedula; }).map(function (r) { return [r.cedula, r]; }));

      var withCedula = state.records.filter(function (r) { return r.cedula; }).length;
      var withNameOnly = state.records.length - withCedula;

      setLoadedText(
        file.name + " | " + state.records.length + " registros | Formato: " + getFormatLabel(format) + " | Por nombre: " + withNameOnly
      );
      updateLoadedActionsVisibility();

      var autoRun = document.getElementById(IDS.oneClickOption).checked;
      if (autoRun && isGradesView()) await runMassImport();
    } catch (error) {
      console.error("[Importador IA] Error:", error);
      alert("No se pudo leer el archivo.");
      setLoadedText("Archivo cargado: error");
      updateLoadedActionsVisibility();
    } finally {
      setRunning(false);
      updateRunButtonState();
      event.target.value = "";
    }
  }

  async function parseFileToRows(file) {
    var name = (file.name || "").toLowerCase();
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) return parseExcelRows(file);
    if (name.endsWith(".csv") || name.endsWith(".txt")) {
      var text = await readTextFile(file);
      return textToRows(text);
    }
    if (name.endsWith(".pdf") || name.endsWith(".doc") || name.endsWith(".docx")) {
      var text2 = await extractTextBestEffort(file);
      return textToRows(text2);
    }
    throw new Error("Tipo de archivo no soportado");
  }

  // ═══════════════════════════════════════════════════════════
  //  CARGA MASIVA — ORQUESTACION POR FORMATO
  // ═══════════════════════════════════════════════════════════

  async function runMassImport() {
    if (state.running) return;

    // 1. Verificar licencia/trial
    var licenseCheck = await checkLicenseOrTrial();
    if (!licenseCheck.allowed) {
      alert(licenseCheck.message || "Debe activar licencia para continuar.");
      renderBillingState();
      var panel = document.getElementById(IDS.panel);
      if (panel) panel.classList.remove("mineduc-hidden");
      return;
    }

    // 2. Validar licencia contra Firebase
    if (typeof FirebaseLicense !== "undefined") {
      var backendValidation = await FirebaseLicense.validateLicenseBeforeImport(state.teacher.key);
      if (!backendValidation.valid) {
        alert(backendValidation.error);
        return;
      }
    }

    if (!hasAccess()) {
      renderBillingState();
      var panel2 = document.getElementById(IDS.panel);
      if (panel2) panel2.classList.remove("mineduc-hidden");
      alert("Ya usaste tus " + RULES.freeRuns + " ejecuciones gratis. Activa tu suscripcion.");
      return;
    }

    if (!state.records.length) { alert("Primero selecciona un archivo."); return; }
    if (!isGradesView()) { alert("No estas en la tabla de calificaciones."); return; }

    var format = getActiveFormat();
    var autoSave = document.getElementById(IDS.saveOption).checked;
    var autoNext = document.getElementById(IDS.nextOption).checked;
    var smartMatch = document.getElementById(IDS.smartOption).checked;

    try {
      setRunning(true, "Paso 2: ejecutando carga masiva (" + getFormatLabel(format) + ")...");

      var result;

      if (format === "civica" && typeof CivicaAutoFill !== "undefined") {
        // === FORMATO CIVICA ===
        setRunning(true, "Carga Civica: seleccionando estudiantes y llenando habilidades...");
        result = await CivicaAutoFill.runCivicaPaginated({
          records: state.records,
          byCedula: state.byCedula,
          autoNext: autoNext,
          onProgress: function (students, skills) {
            var statusEl = document.getElementById(IDS.status);
            if (statusEl) statusEl.textContent = "Civica: " + students + " estudiantes, " + skills + " habilidades llenadas...";
            console.log("[Civica] " + students + " estudiantes, " + skills + " habilidades");
          }
        });

        if (!state.billing.premium && typeof FirebaseLicense !== "undefined") {
          await FirebaseLicense.addStudentsUsed(result.studentsProcessed || 0);
        }

        alert(
          "Carga Civica finalizada.\n" +
          "Estudiantes procesados: " + (result.studentsProcessed || 0) + "\n" +
          "Habilidades llenadas: " + (result.totalFilled || 0) + "\n" +
          "Paginas: " + (result.pagesVisited || 0)
        );

      } else if ((format === "normal" || format === "vocacional") && typeof BulkUploader !== "undefined") {
        // === FORMATO NORMAL / VOCACIONAL (via BulkUploader) ===
        result = await BulkUploader.runBulkImport({
          records: state.records,
          byCedula: state.byCedula,
          autoSave: autoSave,
          autoNext: autoNext,
          smartMatch: smartMatch,
          format: format,
          onProgress: function (page, filled, remaining) {
            console.log("[Importador] Pag " + page + ": " + filled + " aplicadas, " + remaining + " pendientes");
          }
        });

        if (!state.billing.premium && typeof FirebaseLicense !== "undefined") {
          await FirebaseLicense.addStudentsUsed(result.totalFilled || 0);
        }

        if (result.diagnostics && result.diagnostics.notFound && result.diagnostics.notFound.length)
          console.warn("[Importador IA] No encontrados:", result.diagnostics.notFound);
        if (result.diagnostics && result.diagnostics.weakMatches && result.diagnostics.weakMatches.length)
          console.warn("[Importador IA] Coincidencias IA:", result.diagnostics.weakMatches);

        alert(
          "Carga finalizada.\n" +
          "Notas aplicadas: " + (result.totalFilled || 0) + "\n" +
          "Pendientes: " + (result.diagnostics ? result.diagnostics.notFound.length : 0) + "\n" +
          "Coincidencias IA: " + (result.diagnostics ? result.diagnostics.weakMatches.length : 0)
        );

      } else {
        // === FALLBACK: logica interna original para normal ===
        result = await runLegacyImport({ autoSave: autoSave, autoNext: autoNext, smartMatch: smartMatch });
      }

      if (!state.billing.premium) {
        state.billing.runsUsed += 1;
        await saveTeacherBillingState();
      }
      renderBillingState();

      if (!state.billing.premium && state.billing.runsUsed >= RULES.freeRuns) {
        var panelEl = document.getElementById(IDS.panel);
        if (panelEl) panelEl.classList.remove("mineduc-hidden");
        alert("Has usado tus " + RULES.freeRuns + " ejecuciones gratis. Activa tu suscripcion.");
      }
    } catch (error) {
      console.error("[Importador IA] Error durante carga:", error);
      alert("Error durante la carga masiva. Revisa consola.");
    } finally {
      setRunning(false);
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  LEGACY IMPORT (fallback si los modulos no cargaron)
  // ═══════════════════════════════════════════════════════════

  async function runLegacyImport(config) {
    var pending = new Set(state.records.map(function (r) { return r.id; }));
    var totalFilled = 0;
    var pagesVisited = 0;
    var diagnostics = { notFound: [], weakMatches: [] };

    while (true) {
      await waitForGradeTable();
      pagesVisited += 1;

      var result = await fillCurrentPageLegacy({
        pending: pending,
        autoSave: config.autoSave,
        smartMatch: config.smartMatch,
        diagnostics: diagnostics
      });

      totalFilled += result.filled;
      console.log("[Importador IA] Pagina " + pagesVisited + ": " + result.filled + " notas aplicadas.");

      if (!config.autoNext || pending.size === 0) break;
      var moved = await moveToNextPage();
      if (!moved) break;
    }

    for (var id of pending) {
      var rec = state.records.find(function (r) { return r.id === id; });
      if (rec) diagnostics.notFound.push({ cedula: rec.cedula, nombre: rec.nombre, nota: rec.nota });
    }

    return { totalFilled: totalFilled, pagesVisited: pagesVisited, diagnostics: diagnostics };
  }

  async function fillCurrentPageLegacy(config) {
    var rows = Array.from(document.querySelectorAll("table tr"));
    var filled = 0;

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var cells = row.querySelectorAll("td");
      if (!cells.length) continue;

      var student = extractStudentFromRow(row, cells);
      if (!student.nombre && !student.cedula) continue;

      var record = pickRecordForStudent(student, config.pending, config.smartMatch);
      if (!record) continue;

      var input = row.querySelector("input[type='text'], input[type='number'], input:not([type])");
      if (!input) continue;

      setInputValue(input, record.nota);

      if (config.autoSave) {
        var saveButton = findSaveButton(row);
        if (saveButton) {
          saveButton.click();
          await sleep(RULES.rowSaveDelay);
          // Handle SweetAlert2 confirmation dialog ("¿Estás seguro?" → "Sí, guardar")
          if (typeof BulkUploader !== "undefined" && BulkUploader.waitForConfirmAndAccept) {
            await BulkUploader.waitForConfirmAndAccept();
          }
        }
      }

      if (record._aiScore && record._aiScore < 1) {
        config.diagnostics.weakMatches.push({
          cedula: record.cedula,
          excel: record.nombre,
          sistema: student.nombre,
          score: record._aiScore
        });
      }

      config.pending.delete(record.id);
      filled += 1;
    }
    return { filled: filled };
  }

  function pickRecordForStudent(student, pending, smartMatch) {
    if (student.cedula && state.byCedula.has(student.cedula)) {
      var exactCed = state.byCedula.get(student.cedula);
      if (exactCed && pending.has(exactCed.id)) return Object.assign({}, exactCed, { _aiScore: 1 });
    }

    if (!student.nombre) return null;

    var candidates = state.records.filter(function (r) { return pending.has(r.id) && r.nombre; });
    if (!candidates.length) return null;

    var exactName = candidates.find(function (r) { return r.nombre === student.nombre; });
    if (exactName) return Object.assign({}, exactName, { _aiScore: 1 });
    if (!smartMatch) return null;

    var best = null;
    var bestScore = 0;
    for (var i = 0; i < candidates.length; i++) {
      var score = nameSimilarity(candidates[i].nombre, student.nombre);
      if (score > bestScore) { best = candidates[i]; bestScore = score; }
    }

    if (!best || bestScore < RULES.similarityThreshold) return null;
    return Object.assign({}, best, { _aiScore: Number(bestScore.toFixed(3)) });
  }

  function nameSimilarity(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    var aTokens = a.split(" ").filter(Boolean);
    var bTokens = b.split(" ").filter(Boolean);
    var inter = aTokens.filter(function (t) { return bTokens.includes(t); }).length;
    var union = new Set([].concat(aTokens, bTokens)).size || 1;
    var tokenScore = inter / union;
    var levScore = 1 - levenshtein(a, b) / Math.max(a.length, b.length, 1);
    return tokenScore * 0.55 + levScore * 0.45;
  }

  function levenshtein(a, b) {
    var m = a.length, n = b.length;
    var dp = Array.from({ length: m + 1 }, function () { return Array(n + 1).fill(0); });
    for (var i = 0; i <= m; i++) dp[i][0] = i;
    for (var j = 0; j <= n; j++) dp[0][j] = j;
    for (var i2 = 1; i2 <= m; i2++) {
      for (var j2 = 1; j2 <= n; j2++) {
        var cost = a[i2 - 1] === b[j2 - 1] ? 0 : 1;
        dp[i2][j2] = Math.min(dp[i2 - 1][j2] + 1, dp[i2][j2 - 1] + 1, dp[i2 - 1][j2 - 1] + cost);
      }
    }
    return dp[m][n];
  }

  function extractStudentFromRow(row, cells) {
    var cellTexts = Array.from(cells).map(function (cell) { return cleanText(cell.innerText); });
    var cedula = "";
    for (var i = 0; i < cellTexts.length; i++) {
      var c = sanitizeCedula(cellTexts[i]);
      if (c.length >= 9) { cedula = c; break; }
    }
    var name = cellTexts
      .filter(function (t) { return /[A-Za-z]/.test(t); })
      .filter(function (t) { return !/guardar|siguiente|anterior|calificacion|accion|trimestre|supletorio/i.test(t); })
      .sort(function (a, b) { return b.length - a.length; })[0] || "";
    return { cedula: cedula, nombre: normalizeName(name) };
  }

  async function moveToNextPage() {
    var next = findNextButton();
    if (!next || isDisabled(next)) return false;
    next.click();
    await sleep(RULES.pageWaitMs);
    return true;
  }

  function findNextButton() {
    var nodes = Array.from(document.querySelectorAll("button, a, input[type='button'], input[type='submit']"));
    return nodes.find(function (el) { return /siguiente/i.test(el.textContent || el.value || ""); }) || null;
  }

  function isDisabled(el) {
    return Boolean(el.disabled) || el.getAttribute("aria-disabled") === "true";
  }

  async function waitForGradeTable() {
    var timeout = Date.now() + 10000;
    while (Date.now() < timeout) {
      if (document.querySelectorAll("table tr td").length > 0) return;
      await sleep(150);
    }
  }

  function findSaveButton(row) {
    var candidates = Array.from(row.querySelectorAll("button, input[type='button'], input[type='submit']"));
    return candidates.find(function (btn) { return /guardar/i.test(btn.textContent || btn.value || ""); }) || candidates[0] || null;
  }

  function setInputValue(input, value) {
    var descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
    if (descriptor && descriptor.set) descriptor.set.call(input, String(value));
    else input.value = String(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // ═══════════════════════════════════════════════════════════
  //  TEACHER DETECTION
  // ═══════════════════════════════════════════════════════════

  function hasDetectedTeacherIdentity() {
    return state.teacher.key !== "DOCENTE_DESCONOCIDO" && state.teacher.key.length >= 6;
  }

  function detectAcademicTeacher() {
    var selectors = [
      "#ctl00_lblUsuario", "#ctl00_lblDocente", "#lblUsuario", "#lblDocente",
      "[id*='lblUsuario']", "[id*='lblDocente']", "[id*='usuario']",
      ".user-name", ".username", ".usuario", ".profile-name", ".user-info",
      ".navbar-text", ".dropdown-toggle"
    ];
    var candidates = [];
    var seen = new Set();

    for (var s = 0; s < selectors.length; s++) {
      document.querySelectorAll(selectors[s]).forEach(function (node) {
        var text = cleanText(node.textContent || "");
        if (!text || seen.has(text)) return;
        seen.add(text);
        candidates.push(text);
      });
    }

    var bodyText = cleanText(document.body?.innerText || "").slice(0, 15000);
    var patterns = [
      /(?:usuario|docente|bienvenido(?:\/?a)?|welcome)\s*:?\s*([A-Za-z\u00C1\u00C9\u00CD\u00D3\u00DA\u00D1\u00E1\u00E9\u00ED\u00F3\u00FA\u00F1.\- ]{6,80})/gi,
      /([A-Z\u00C1\u00C9\u00CD\u00D3\u00DA\u00D1]{2,}(?:\s+[A-Z\u00C1\u00C9\u00CD\u00D3\u00DA\u00D1]{2,}){1,5})/g
    ];
    for (var p = 0; p < patterns.length; p++) {
      for (var match of bodyText.matchAll(patterns[p])) {
        var value = cleanText(match[1] || match[0] || "");
        if (!value || seen.has(value)) continue;
        seen.add(value);
        candidates.push(value);
      }
    }

    var best = candidates
      .map(function (label) { return { label: label, key: normalizeTeacherKey(label) }; })
      .filter(function (item) { return item.key && item.key.length >= 6; })
      .filter(function (item) { return !/ACADEMICO|IMPORTADOR|NOTAS|SISTEMA|GENERAL|INICIO|MENU/.test(item.key); })
      .sort(function (a, b) { return b.key.length - a.key.length; })[0];

    return best || { key: "DOCENTE_DESCONOCIDO", label: "Docente no detectado" };
  }

  function normalizeTeacherKey(value) {
    return cleanText(value).toUpperCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, " ")
      .replace(/\s+/g, " ").trim();
  }

  // ═══════════════════════════════════════════════════════════
  //  TEMPLATE DOWNLOAD — ajustado por formato
  // ═══════════════════════════════════════════════════════════

  function downloadTemplate() {
    var format = getActiveFormat();
    var rows;

    if (format === "vocacional") {
      rows = [
        ["Cedula", "Nombre", "Nota"],
        ["0606373421", "BRAVO TIXI MARIA CRUZ", "A+"],
        ["0650372949", "DAQUILEMA BUNAY DAVID ESTEBAN", "B+"],
        ["0606379568", "DAQUILEMA GUARACA OMAR GILBERTO", "A-"]
      ];
    } else if (format === "civica") {
      rows = [
        ["Cedula", "Nombre", "Autoconocimiento", "Pensamiento Critico", "Manejo de Problemas", "Toma de Decisiones", "Trabajo en Equipo", "Empatia", "Manejo de Conflictos", "Comunicacion Efectiva/Asertiva", "Manejo de Emociones y Sentimientos"],
        ["0606373421", "BRAVO TIXI MARIA CRUZ", "SIEMPRE", "FRECUENTEMENTE", "SIEMPRE", "OCASIONALMENTE", "SIEMPRE", "FRECUENTEMENTE", "SIEMPRE", "FRECUENTEMENTE", "SIEMPRE"],
        ["0650372949", "DAQUILEMA BUNAY DAVID ESTEBAN", "FRECUENTEMENTE", "SIEMPRE", "FRECUENTEMENTE", "SIEMPRE", "FRECUENTEMENTE", "SIEMPRE", "SIEMPRE", "SIEMPRE", "FRECUENTEMENTE"],
        ["0606379568", "DAQUILEMA GUARACA OMAR GILBERTO", "OCASIONALMENTE", "FRECUENTEMENTE", "SIEMPRE", "FRECUENTEMENTE", "SIEMPRE", "FRECUENTEMENTE", "FRECUENTEMENTE", "SIEMPRE", "SIEMPRE"]
      ];
    } else {
      rows = [
        ["Cedula", "Nombre", "Nota"],
        ["0606373421", "BRAVO TIXI MARIA CRUZ", "8.5"],
        ["0650372949", "DAQUILEMA BUNAY DAVID ESTEBAN", "7.2"],
        ["0606379568", "DAQUILEMA GUARACA OMAR GILBERTO", "9"]
      ];
    }

    try {
      if (typeof XLSX !== "undefined") {
        var ws = XLSX.utils.aoa_to_sheet(rows);
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
        XLSX.writeFile(wb, "plantilla_" + format + "_mineduc.xlsx");
        return;
      }
      var csv = rows.map(function (r) { return r.join(";"); }).join("\n");
      var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "plantilla_" + format + "_mineduc.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("[Importador IA] Error al descargar plantilla:", error);
      alert("No se pudo generar la plantilla.");
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  FILE PARSING (normal grades — logica interna)
  // ═══════════════════════════════════════════════════════════

  async function parseRecordsFromFile(file) {
    var name = (file.name || "").toLowerCase();
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      var rows = await parseExcelRows(file);
      return normalizeRowsToRecords(rows);
    }
    if (name.endsWith(".csv") || name.endsWith(".txt")) {
      var text = await readTextFile(file);
      var rows2 = textToRows(text);
      var fromRows = normalizeRowsToRecords(rows2);
      if (fromRows.length) return fromRows;
      return parseUnstructuredText(text);
    }
    if (name.endsWith(".pdf") || name.endsWith(".doc") || name.endsWith(".docx")) {
      var text2 = await extractTextBestEffort(file);
      var rows3 = textToRows(text2);
      var fromRows2 = normalizeRowsToRecords(rows3);
      if (fromRows2.length) return fromRows2;
      return parseUnstructuredText(text2);
    }
    throw new Error("Tipo de archivo no soportado");
  }

  function parseExcelRows(file) {
    return new Promise(function (resolve, reject) {
      if (typeof XLSX === "undefined") { reject(new Error("SheetJS no disponible")); return; }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("No se pudo leer el archivo.")); };
      reader.onload = function (e) {
        try {
          var wb = XLSX.read(e.target.result, { type: "array" });
          var sheet = wb.Sheets[wb.SheetNames[0]];
          resolve(XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }));
        } catch (err) { reject(err); }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  function readTextFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("No se pudo leer texto.")); };
      reader.onload = function (e) { resolve(String(e.target.result || "")); };
      reader.readAsText(file, "utf-8");
    });
  }

  function extractTextBestEffort(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("No se pudo leer binario.")); };
      reader.onload = function (e) {
        var buffer = e.target.result;
        try {
          var utf = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
          if (utf && utf.length > 20) { resolve(utf); return; }
        } catch (_e) { /* fallthrough */ }
        try {
          resolve(new TextDecoder("iso-8859-1", { fatal: false }).decode(buffer) || "");
        } catch (err) { reject(err); }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  function textToRows(text) {
    var lines = String(text || "").split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    if (!lines.length) return [];
    var sep = detectDelimiter(lines.slice(0, 5).join("\n"));
    return lines.map(function (l) { return l.split(sep).map(function (v) { return cleanText(v); }); });
  }

  function detectDelimiter(sample) {
    var first = String(sample || "").split(/\r?\n/)[0] || "";
    var scores = [
      { d: ";", c: (first.match(/;/g) || []).length },
      { d: ",", c: (first.match(/,/g) || []).length },
      { d: "\t", c: (first.match(/\t/g) || []).length },
      { d: "|", c: (first.match(/\|/g) || []).length }
    ];
    scores.sort(function (a, b) { return b.c - a.c; });
    return scores[0].c > 0 ? scores[0].d : ";";
  }

  function normalizeRowsToRecords(rows) {
    if (!Array.isArray(rows) || !rows.length) return [];
    var cfg = detectColumns(rows);
    var dedupe = new Map();
    for (var i = cfg.startAt; i < rows.length; i++) {
      var row = rows[i] || [];
      var cedula = cfg.cedulaIndex >= 0 ? sanitizeCedula(row[cfg.cedulaIndex]) : "";
      var nombre = cfg.nombreIndex >= 0 ? normalizeName(row[cfg.nombreIndex]) : "";
      var nota = cfg.notaIndex >= 0 ? sanitizeGrade(row[cfg.notaIndex]) : null;
      if (nota === null || (!cedula && !nombre)) continue;
      dedupe.set(cedula || nombre, { cedula: cedula, nombre: nombre, nota: nota });
    }
    return Array.from(dedupe.values());
  }

  function detectColumns(rows) {
    var maxHeaderRows = Math.min(rows.length, 6);
    for (var r = 0; r < maxHeaderRows; r++) {
      var headers = (rows[r] || []).map(function (h) { return normalizeHeader(h); });
      var notaIndex = findHeaderIndex(headers, ["nota", "calificacion", "puntaje", "score"]);
      var cedulaIndex = findHeaderIndex(headers, ["cedula", "identificacion", "numero de cedula", "dni"]);
      var nombreIndex = findHeaderIndex(headers, ["nombre", "estudiante", "apellidos y nombres", "alumno"]);
      if (notaIndex !== -1 && (cedulaIndex !== -1 || nombreIndex !== -1)) {
        return { startAt: r + 1, cedulaIndex: cedulaIndex, nombreIndex: nombreIndex, notaIndex: notaIndex };
      }
    }
    var first = rows[0] || [];
    return {
      startAt: 0,
      cedulaIndex: first.length >= 2 ? 0 : -1,
      nombreIndex: first.length >= 3 ? 1 : 0,
      notaIndex: first.length >= 3 ? 2 : 1
    };
  }

  function parseUnstructuredText(text) {
    var lines = String(text || "").split(/\r?\n/).map(function (l) { return cleanText(l); }).filter(Boolean);
    var output = [];
    for (var i = 0; i < lines.length; i++) {
      var gradeMatch = lines[i].match(/(\d{1,2}(?:[\.,]\d{1,2})?)\s*$/);
      if (!gradeMatch) continue;
      var nota = sanitizeGrade(gradeMatch[1]);
      if (nota === null) continue;
      var base = lines[i].slice(0, gradeMatch.index).trim();
      var cedMatch = base.match(/\b\d{9,13}\b/);
      var cedula = cedMatch ? sanitizeCedula(cedMatch[0]) : "";
      var namePart = normalizeName(base.replace(/\b\d{9,13}\b/, " "));
      if (!cedula && !namePart) continue;
      output.push({ cedula: cedula, nombre: namePart, nota: nota });
    }
    var dedupe = new Map();
    for (var j = 0; j < output.length; j++) dedupe.set(output[j].cedula || output[j].nombre, output[j]);
    return Array.from(dedupe.values());
  }

  // ═══════════════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════════════

  function findHeaderIndex(headers, aliases) {
    return headers.findIndex(function (h) { return aliases.some(function (a) { return h.includes(a); }); });
  }

  function sanitizeCedula(value) {
    if (value === undefined || value === null) return "";
    var digits = String(value).replace(/\D/g, "");
    if (digits.length === 9) return digits.padStart(10, "0");
    return digits;
  }

  function sanitizeGrade(value) {
    if (value === undefined || value === null || value === "") return null;
    var txt = String(value).trim().replace(/\s+/g, "").replace(/,/g, ".");
    if (!/^\d+(\.\d+)?$/.test(txt)) return null;
    var n = Number(txt);
    if (Number.isNaN(n) || n < RULES.minGrade || n > RULES.maxGrade) return null;
    return formatGrade(n);
  }

  function formatGrade(n) {
    return n.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
  }

  function normalizeName(value) {
    return cleanText(value).toUpperCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, " ")
      .replace(/\s+/g, " ").trim();
  }

  function normalizeHeader(value) {
    return cleanText(value).toLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ")
      .replace(/\s+/g, " ").trim();
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function setLoadedText(text) {
    var el = document.getElementById(IDS.loaded);
    if (el) el.textContent = text;
  }

  function setRunning(running, statusText) {
    state.running = running;
    var statusEl = document.getElementById(IDS.status);
    if (statusText && statusEl) {
      statusEl.textContent = statusText;
      statusEl.className = "mineduc-status";
    }
    updateRunButtonState();
  }

  async function ensureInstallId() {
    var stored = await storageGet(["installId"]);
    if (stored.installId) return stored.installId;
    var rand = Math.random().toString(36).slice(2, 10).toUpperCase();
    var ts = Date.now().toString(36).toUpperCase();
    var id = "BRW-" + rand + "-" + ts;
    await storageSet({ installId: id });
    return id;
  }

  function storageGet(keys) {
    return new Promise(function (resolve) {
      if (!chrome || !chrome.storage || !chrome.storage.local) { resolve({}); return; }
      chrome.storage.local.get(keys, function (result) { resolve(result || {}); });
    });
  }

  function storageSet(payload) {
    return new Promise(function (resolve) {
      if (!chrome || !chrome.storage || !chrome.storage.local) { resolve(); return; }
      chrome.storage.local.set(payload, function () { resolve(); });
    });
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  // ═══════════════════════════════════════════════════════════
  //  INIT
  // ═══════════════════════════════════════════════════════════

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
