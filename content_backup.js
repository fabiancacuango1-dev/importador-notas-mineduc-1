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
    paymentHint: "mineducPaymentHint"
  };

  const RULES = {
    minGrade: 0,
    maxGrade: 10,
    rowSaveDelay: 250,
    pageWaitMs: 1200,
    similarityThreshold: 0.82,
    freeRuns: 3,
    maxTeachers: 2,
    premiumPriceUsd: 5.00
  };

  // En produccion, el checkout debe salir del backend usando la API oficial de PayPhone.
  // payphoneCheckoutUrl queda solo como respaldo si el backend aun no esta configurado.
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

  function checkStudentLimit() {
    if (!state.billing.premium && state.records.length > 20) {
      alert("El modo prueba solo permite importar hasta 20 estudiantes. Activa el modo Pro para continuar.");
      return false;
    }
    return true;
  }

  function ensureUI() {
    if (document.getElementById(IDS.launcher)) return;

    console.log("[Importador IA] Creando boton flotante y panel...");

    const launcher = document.createElement("button");
    launcher.id = IDS.launcher;
    launcher.textContent = "\u{1F4CB} Importar Notas";
    launcher.addEventListener("click", togglePanel);
    document.body.appendChild(launcher);
    console.log("[Importador IA] Boton flotante agregado al DOM.");

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
      <div class="mineduc-actions" id="${IDS.actionsContainer}">
        <button id="${IDS.selectButton}" type="button">\u{1F4C2} Seleccionar archivo</button>
        <button id="${IDS.templateButton}" type="button">\u{1F4C4} Plantilla</button>
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
      </ul>
      <section id="${IDS.billingSection}" class="mineduc-billing">
        <div id="${IDS.billingStatus}" class="mineduc-billing-status"></div>
        <button id="${IDS.payphoneButton}" type="button" class="mineduc-hidden">\u{1F4B3} Pagar con PayPhone</button>
        <button id="${IDS.paypalButton}" type="button" class="mineduc-hidden">\u{1F17F} Pagar con PayPal</button>
        <div class="mineduc-pay-actions" id="mineducPayActions" style="margin-bottom:10px;">
          <button id="mineducWhatsappBtn" type="button" style="background:#25d366;color:#fff;border:none;border-radius:8px;padding:10px 16px;font-size:15px;font-weight:700;box-shadow:0 1px 4px #0001;">Solicitar licencia por WhatsApp</button>
        </div>
        <div class="mineduc-license-box" id="mineducLicenseBox" style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <input id="mineducLicenseInput" type="text" placeholder="Ingresa tu licencia" style="flex:1;border:1px solid #bcd;color:#123;border-radius:8px;padding:8px;font-size:14px;" />
          <button id="mineducActivateBtn" type="button" style="background:#0f4aa1;color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:14px;font-weight:700;">Activar</button>
        </div>
        <small id="${IDS.paymentHint}" class="mineduc-help" style="color:#4a5c79;">Solicita tu licencia y act\u00EDvala aqu\u00ED para habilitar el modo Pro.</small>
      </section>
      <small class="mineduc-help">
        Tipos soportados: Excel, CSV, TXT. PDF/Word: analisis local por mejor esfuerzo.
      </small>
    `;

    const hiddenInput = document.createElement("input");
    hiddenInput.id = IDS.hiddenInput;
    hiddenInput.type = "file";
    hiddenInput.accept = ".xlsx,.xls,.csv,.txt,.pdf,.doc,.docx";
    hiddenInput.className = "mineduc-hidden";

    document.body.appendChild(panel);
    document.body.appendChild(hiddenInput);

    document.getElementById(IDS.closePanel).addEventListener("click", togglePanel);
    document.getElementById(IDS.templateButton).addEventListener("click", downloadTemplate);
    document.getElementById(IDS.selectButton).addEventListener("click", () => hiddenInput.click());
    document.getElementById(IDS.clearLoadButton).addEventListener("click", clearLoadedFileData);
    document.getElementById(IDS.executeButton).addEventListener("click", function() {
      if (!checkStudentLimit()) return;
      runMassImport();
    });
    document.getElementById(IDS.payphoneButton).addEventListener("click", openPayPhoneCheckout);
    document.getElementById(IDS.paypalButton).addEventListener("click", openPayPalCheckout);
    document.getElementById("mineducWhatsappBtn").addEventListener("click", function() {
      const numero = "593983274499";
      const mensaje = encodeURIComponent("Hola, deseo solicitar una licencia para el Importador de Notas. El costo es $5.00.");
      const url = `https://wa.me/${numero}?text=${mensaje}`;
      window.open(url, "_blank");
    });
    document.getElementById("mineducActivateBtn").addEventListener("click", function() {
      const input = document.getElementById("mineducLicenseInput");
      const code = input.value.trim();
      if (!code) {
        alert("Por favor ingresa un codigo de licencia.");
        return;
      }
      if (/^[A-Z0-9]{8,}$/.test(code)) {
        state.billing.premium = true;
        state.billing.licenseCode = code;
        saveTeacherBillingState();
        renderBillingState();
        const payActions = document.getElementById("mineducPayActions");
        const licenseBox = document.getElementById("mineducLicenseBox");
        if (payActions) payActions.style.display = "none";
        if (licenseBox) licenseBox.style.display = "none";
        alert("Licencia activada. Modo Pro habilitado.");
      } else {
        alert("Codigo de licencia invalido.");
      }
    });
    hiddenInput.addEventListener("change", onFilePicked);
  }

  async function bootstrap() {
    console.log("[Importador IA] Inicializando extension...");
    try {
      state.installId = await ensureInstallId();
      await loadBillingConfig();
      ensureUI();
      await syncTeacherContext({ silent: true });
      await refreshPaymentCapabilities();
      renderBillingState();
      updateCompatibilityStatus();
      registerRuntimeBridge();
      watchRouteChanges();
      console.log("[Importador IA] Extension cargada correctamente. Boton flotante visible.");
    } catch (error) {
      console.error("[Importador IA] Error critico al iniciar extension:", error);
    }
  }

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
  }

  function registerRuntimeBridge() {
    if (!chrome || !chrome.runtime || !chrome.runtime.onMessage) return;

    chrome.runtime.onMessage.addListener((message) => {
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
    });
  }

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

  // Enforce max-teacher limit: block a new (unknown) teacher once limit is reached
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

  function renderBillingState() {
    const teacherInfo = document.getElementById(IDS.teacherInfo);
    const status = document.getElementById(IDS.billingStatus);
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
      teacherInfo.textContent = teacherDetected ? `Docente: ${state.teacher.label}` : "Docente no detectado";
    }

    // --- Teacher limit reached: block all actions, show only the limit message ---
    if (state.teacherBlocked) {
      if (billingSection) billingSection.classList.remove("mineduc-hidden");
      if (actionsContainer) actionsContainer.classList.add("mineduc-hidden");
      if (advancedDiv) advancedDiv.classList.add("mineduc-hidden");
      if (featureList) featureList.classList.add("mineduc-hidden");
      if (payActions) payActions.classList.add("mineduc-hidden");
      if (licenseBox) licenseBox.classList.add("mineduc-hidden");
      if (status) {
        status.textContent = `Limite alcanzado: solo se permiten ${RULES.maxTeachers} docentes por navegador.`;
        status.className = "mineduc-billing-status blocked";
      }
      updateRunButtonState();
      return;
    }

    const mustShowBilling = (!state.billing.premium && state.billing.runsUsed >= RULES.freeRuns) || state.billing.paymentPending;

    if (billingSection) {
      billingSection.classList.toggle("mineduc-hidden", !mustShowBilling && !state.billing.premium);
    }
    if (actionsContainer) actionsContainer.classList.remove("mineduc-hidden");
    if (advancedDiv) advancedDiv.classList.remove("mineduc-hidden");
    if (featureList) featureList.classList.remove("mineduc-hidden");
    if (payActions) payActions.classList.toggle("mineduc-hidden", state.billing.premium);
    if (licenseBox) licenseBox.classList.toggle("mineduc-hidden", state.billing.premium);

    if (payButton) {
      const payphoneUnavailable = state.paymentCapabilities.payphoneReady === false;
      payButton.disabled = !teacherDetected || state.billing.premium;
      payButton.classList.toggle("mineduc-hidden", state.billing.premium);
      payButton.title = payphoneUnavailable
        ? `PayPhone no disponible: ${state.paymentCapabilities.payphoneError || "falta configuracion"}`
        : !teacherDetected
          ? "Debemos detectar el docente para vincular la suscripcion."
          : pendingFresh
            ? "Pago pendiente detectado. Puedes hacer clic para reabrir checkout y completar el pago."
            : "";
    }
    if (paypalButton) {
      const paypalUnavailable = state.paymentCapabilities.paypalReady === false;
      paypalButton.disabled = !teacherDetected || state.billing.premium;
      paypalButton.classList.toggle("mineduc-hidden", state.billing.premium);
      paypalButton.title = paypalUnavailable
        ? `PayPal no disponible: ${state.paymentCapabilities.paypalError || "falta configuracion"}`
        : !teacherDetected
          ? "Debemos detectar el docente para vincular la suscripcion."
          : pendingFresh
            ? "Pago pendiente detectado. Puedes hacer clic para reabrir checkout y completar el pago."
            : "";
    }

    if (!status) { updateRunButtonState(); return; }

    if (!mustShowBilling) {
      updateRunButtonState();
      return;
    }

    if (state.billing.premium) {
      status.textContent = "✅ Suscripcion activa. Importacion ilimitada habilitada.";
      status.className = "mineduc-billing-status ok";
    } else if (!teacherDetected) {
      status.textContent = "No se pudo identificar al docente. Recarga la pagina e intentalo de nuevo.";
      status.className = "mineduc-billing-status warn";
    } else if (state.billing.paymentPending) {
      status.textContent = `⏳ Verificando pago para ${state.teacher.label}...`;
      status.className = "mineduc-billing-status warn";
    } else {
      status.textContent = `Se agotaron las ${RULES.freeRuns} ejecuciones gratis. Activa tu suscripcion para continuar.`;
      status.className = "mineduc-billing-status blocked";
    }

    const paymentHint = document.getElementById(IDS.paymentHint);
    if (paymentHint) {
      if (state.billing.premium) {
        paymentHint.textContent = "Pago confirmado. Suscripcion activa para este docente en este navegador.";
      } else if (pendingFresh) {
        const providerLabel = state.billing.paymentProvider === "paypal" ? "PayPal" : "PayPhone";
        paymentHint.textContent = `Verificando pago por ${providerLabel} automaticamente cada 7 segundos. Si no avanza, vuelve a pulsar el boton de pago para reabrir checkout.`;
      } else {
        const tips = [];
        if (state.paymentCapabilities.payphoneReady === false) {
          tips.push("PayPhone no esta habilitado.");
        }
        if (state.paymentCapabilities.paypalReady === false) {
          tips.push("PayPal se habilita cuando configures PAYPAL_CLIENT_SECRET en Cloudflare.");
        }
        const extra = tips.length ? ` ${tips.join(" ")}` : "";
        paymentHint.textContent = "Al pagar por PayPhone o PayPal, la suscripcion se activa automaticamente para este docente." + extra;
      }
    }

    updateRunButtonState();
  }

  function updateLoadedActionsVisibility() {
    const clearLoadButton = document.getElementById(IDS.clearLoadButton);
    if (!clearLoadButton) return;
    clearLoadButton.classList.toggle("mineduc-hidden", state.records.length === 0);
  }

  function normalizeLicenseApiBase(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const withoutSlash = withProtocol.replace(/\/+$/, "");
    return /\/licenses$/i.test(withoutSlash) ? withoutSlash : `${withoutSlash}/licenses`;
  }

  function isLicenseApiBaseConfigured(value) {
    const base = String(value || "").trim();
    return Boolean(base) && !base.includes("TU_DOMINIO_API");
  }

  async function loadBillingConfig() {
    const stored = await storageGet(["billingConfig"]);
    const customBase = normalizeLicenseApiBase(stored?.billingConfig?.licenseApiBase);
    state.licenseApiBase = customBase || BILLING.licenseApiBase;
  }

  async function ensureLicenseApiBaseConfigured() {
    if (isLicenseApiBaseConfigured(state.licenseApiBase)) return state.licenseApiBase;

    const input = window.prompt(
      "Pega la URL de tu Worker de Cloudflare para pagos.\nEjemplo: https://mineduc-license-api.tu-cuenta.workers.dev"
    );
    if (!input) return "";

    const normalized = normalizeLicenseApiBase(input);
    if (!isLicenseApiBaseConfigured(normalized)) {
      alert("URL invalida. Debe ser una URL real de Cloudflare Worker.");
      return "";
    }

    state.licenseApiBase = normalized;
    await storageSet({
      billingConfig: {
        licenseApiBase: normalized,
        updatedAt: new Date().toISOString()
      }
    });

    await refreshPaymentCapabilities();

    return normalized;
  }

  function getLicenseApiRoot() {
    const base = String(state.licenseApiBase || "").trim().replace(/\/+$/, "");
    if (!base) return "";
    return base.replace(/\/licenses$/i, "");
  }

  async function refreshPaymentCapabilities() {
    if (!isLicenseApiBaseConfigured(state.licenseApiBase)) {
      state.paymentCapabilities.payphoneReady = true;
      state.paymentCapabilities.payphoneError = "";
      state.paymentCapabilities.paypalReady = false;
      state.paymentCapabilities.paypalError = "Configura primero la URL del Worker para habilitar PayPal.";
      return;
    }

    try {
      const apiRoot = getLicenseApiRoot();
      if (!apiRoot) {
        state.paymentCapabilities.paypalReady = false;
        state.paymentCapabilities.paypalError = "No se pudo determinar la URL del backend.";
        return;
      }

      const response = await fetch(`${state.licenseApiBase}/capabilities`, { method: "GET" });
      if (!response.ok) {
        state.paymentCapabilities.payphoneReady = true;
        state.paymentCapabilities.payphoneError = "";
        state.paymentCapabilities.paypalReady = false;
        state.paymentCapabilities.paypalError = `No disponible (${response.status}).`;
        return;
      }

      const payload = await response.json();
      state.paymentCapabilities.payphoneReady = Boolean(payload?.payphone?.ready ?? true);
      state.paymentCapabilities.payphoneError = String(payload?.payphone?.error || "");
      state.paymentCapabilities.paypalReady = Boolean(payload?.paypal?.ready);
      state.paymentCapabilities.paypalError = payload?.paypal?.ready
        ? ""
        : String(payload?.paypal?.error || payload?.error || "PayPal no esta listo en el backend.");
    } catch (error) {
      state.paymentCapabilities.payphoneReady = true;
      state.paymentCapabilities.payphoneError = "";
      state.paymentCapabilities.paypalReady = false;
      state.paymentCapabilities.paypalError = String(error?.message || "No se pudo validar PayPal.");
    }
  }

  function openPayPhoneCheckout() {
    if (!hasDetectedTeacherIdentity()) {
      alert("No pudimos identificar con seguridad al docente actual. Abre nuevamente tu cuenta en Academico y vuelve a intentarlo.");
      return;
    }

    if (state.paymentCapabilities.payphoneReady === false) {
      alert(`PayPhone no esta habilitado.\n\n${state.paymentCapabilities.payphoneError || "Revisa configuracion del backend."}`);
      return;
    }

    void beginAutomaticSubscriptionFlow("payphone");
  }

  function openPayPalCheckout() {
    if (!hasDetectedTeacherIdentity()) {
      alert("No pudimos identificar con seguridad al docente actual. Abre nuevamente tu cuenta en Academico y vuelve a intentarlo.");
      return;
    }

    void (async () => {
      await refreshPaymentCapabilities();
      if (!state.paymentCapabilities.paypalReady) {
        alert(
          "PayPal aun no esta habilitado en el backend.\n\n" +
            `${state.paymentCapabilities.paypalError || "Falta configuracion."}\n\n` +
            "Ejecuta: npx wrangler secret put PAYPAL_CLIENT_SECRET"
        );
        renderBillingState();
        return;
      }

      await beginAutomaticSubscriptionFlow("paypal");
    })();
  }

  function clearLoadedFileData() {
    state.records = [];
    state.byCedula = new Map();

    const input = document.getElementById(IDS.hiddenInput);
    if (input) input.value = "";

    setLoadedText("Archivo cargado: ninguno");
    updateLoadedActionsVisibility();
    updateRunButtonState();
    updateCompatibilityStatus();

    alert("Carga actual limpiada. Puedes seleccionar un nuevo archivo.");
  }

  async function beginAutomaticSubscriptionFlow(provider) {
    const normalizedProvider = provider === "paypal" ? "paypal" : "payphone";
    const apiBase = await ensureLicenseApiBaseConfigured();
    if (!apiBase && normalizedProvider === "paypal") {
      alert("Para PayPal debes configurar primero la URL real de tu Worker de Cloudflare.");
      return;
    }

    const session = await createCheckoutSession(normalizedProvider);
    if (session?.error) {
      alert(`No se pudo generar el checkout de ${normalizedProvider === "paypal" ? "PayPal" : "PayPhone"}.\n\nDetalle: ${session.error}`);
      return;
    }

    if (!session || !session.checkoutUrl) {
      const fallbackUrl = normalizedProvider === "payphone"
        ? String(BILLING.payphoneCheckoutUrl || "").trim()
        : String(BILLING.paypalCheckoutUrl || "").trim();
      if (!fallbackUrl) {
        const apiHint = !isLicenseApiBaseConfigured(state.licenseApiBase)
          ? "\nConfigura la URL real de tu Worker (ya puedes pegarla cuando te la pida el plugin)."
          : "";
        alert("No se pudo generar el checkout automatico. Verifica la configuracion del backend de pagos." + apiHint);
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
      const base = isLicenseApiBaseConfigured(state.licenseApiBase)
        ? state.licenseApiBase
        : await ensureLicenseApiBaseConfigured();

      if (!isLicenseApiBaseConfigured(base)) {
        return { error: "URL de Worker no configurada." };
      }

      const path = provider === "paypal" ? "paypal-checkout" : "payphone-checkout";
      const response = await fetch(`${base}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherKey: state.teacher.key,
          teacherLabel: state.teacher.label,
          installId: state.installId || "unknown"
        })
      });

      if (!response.ok) {
        let backendMessage = "Error desconocido del backend.";
        try {
          const payload = await response.json();
          backendMessage = String(payload?.error || payload?.message || backendMessage);
        } catch {
          backendMessage = await response.text();
        }

        if (/PAYPAL_CLIENT_ID|PAYPAL_CLIENT_SECRET/i.test(backendMessage)) {
          backendMessage += " | Configura el secreto con: npx wrangler secret put PAYPAL_CLIENT_SECRET";
        }

        return { error: `${response.status} - ${backendMessage}` };
      }

      return await response.json();
    } catch (error) {
      console.error("[Importador IA] No se pudo crear el checkout automatico:", error);
      return { error: String(error?.message || error || "Error de red") };
    }
  }

  async function checkAutomaticSubscriptionStatus() {
    try {
      const base = state.licenseApiBase;
      if (!isLicenseApiBaseConfigured(base)) {
        return { paid: false, pending: state.billing.paymentPending };
      }

      const query = `teacherKey=${encodeURIComponent(state.teacher.key)}&installId=${encodeURIComponent(state.installId || "")}`;
      const providers = state.billing.paymentProvider ? [state.billing.paymentProvider] : ["payphone", "paypal"];

      for (const provider of providers) {
        const path = provider === "paypal" ? "paypal-status" : "payphone-status";
        const url = `${base}/${path}?${query}`;
        const response = await fetch(url, { method: "GET" });
        if (!response.ok) continue;
        const payload = await response.json();
        const paid = Boolean(payload && payload.paid === true);
        const pending = Boolean(payload && payload.pending === true);
        if (!paid && !pending) continue;

        return {
          paid,
          pending,
          provider: String(payload?.provider || provider),
          licenseCode: String(payload?.licenseCode || "")
        };
      }

      return { paid: false, pending: false, provider: "", licenseCode: "" };
    } catch (error) {
      console.error("[Importador IA] Error consultando estado automatico:", error);
      return { paid: false, pending: state.billing.paymentPending };
    }
  }

  function startPayPhoneAutoCheck() {
    if (state.payphonePollTimer || state.billing.premium) return;
    state.payphonePollTimer = setInterval(async () => {
      const result = await checkAutomaticSubscriptionStatus();
      if (!result.paid) {
        state.billing.paymentPending = result.pending;
        state.billing.paymentProvider = result.pending ? String(result.provider || state.billing.paymentProvider || "") : "";
        state.billing.paymentPendingSince = result.pending
          ? state.billing.paymentPendingSince || new Date().toISOString()
          : "";
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
      alert(`Pago confirmado automaticamente para ${state.teacher.label}. Suscripcion activada.`);
    }, BILLING.autoCheckIntervalMs);
  }

  function stopPayPhoneAutoCheck() {
    if (!state.payphonePollTimer) return;
    clearInterval(state.payphonePollTimer);
    state.payphonePollTimer = null;
  }

  async function tryAutoActivateSubscription() {
    if (state.billing.premium) return;
    const result = await checkAutomaticSubscriptionStatus();
    if (!result.paid) {
      state.billing.paymentPending = result.pending;
      state.billing.paymentProvider = result.pending ? String(result.provider || state.billing.paymentProvider || "") : "";
      state.billing.paymentPendingSince = result.pending
        ? state.billing.paymentPendingSince || new Date().toISOString()
        : "";
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

  function updateCompatibilityStatus() {
    const compatible = isGradesView();
    const status = document.getElementById(IDS.status);
    if (!status) return;

    if (compatible) {
      status.textContent = "Listo para Paso 2: puedes ejecutar carga masiva.";
      status.className = "mineduc-status ok";
    } else {
      status.textContent = "Vista no compatible para Paso 2. Abre una materia con el boton lapiz.";
      status.className = "mineduc-status warn";
    }

    updateRunButtonState();
  }

  async function onFilePicked(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    try {
      setRunning(true, "Paso 1 en progreso: analizando archivo...");
      const records = await parseRecordsFromFile(file);

      if (!records.length) {
        alert("No se pudo extraer informacion valida. Prueba con Excel/CSV/TXT estructurado.");
        state.records = [];
        state.byCedula = new Map();
        setLoadedText("Archivo cargado: sin registros validos");
        return;
      }

      state.records = records.map((r, idx) => ({ ...r, id: `${idx + 1}` }));
      state.byCedula = new Map(state.records.filter((r) => r.cedula).map((r) => [r.cedula, r]));

      const withCedula = state.records.filter((r) => r.cedula).length;
      const withNameOnly = state.records.length - withCedula;

      setLoadedText(
        `Archivo cargado: ${file.name} | Registros validos: ${state.records.length} | Coincidencia por nombre: ${withNameOnly}`
      );
      updateLoadedActionsVisibility();

      const autoRun = document.getElementById(IDS.oneClickOption).checked;
      if (autoRun && isGradesView()) {
        await runMassImport();
      }
    } catch (error) {
      console.error("[Importador IA] Error al analizar archivo:", error);
      alert("No se pudo leer el archivo. Verifica formato y contenido.");
      setLoadedText("Archivo cargado: error");
      updateLoadedActionsVisibility();
    } finally {
      setRunning(false);
      updateRunButtonState();
      event.target.value = "";
    }
  }

  async function runMassImport() {
    if (state.running) return;
    if (!hasAccess()) {
      renderBillingState();
      const panel = document.getElementById(IDS.panel);
      if (panel) panel.classList.remove("mineduc-hidden");
      alert(
        `Ya usaste tus ${RULES.freeRuns} ejecuciones gratis para ${state.teacher.label}.\n` +
          `Paga la suscripcion de $${RULES.premiumPriceUsd} en PayPhone o PayPal para seguir importando.`
      );
      return;
    }

    if (!state.records.length) {
      alert("Primero selecciona un archivo.");
      return;
    }

    if (!isGradesView()) {
      alert("No estas en la tabla de calificaciones por estudiante.");
      return;
    }

    const autoSave = document.getElementById(IDS.saveOption).checked;
    const autoNext = document.getElementById(IDS.nextOption).checked;
    const smartMatch = document.getElementById(IDS.smartOption).checked;

    const pending = new Set(state.records.map((r) => r.id));
    let totalFilled = 0;
    let pagesVisited = 0;

    const diagnostics = {
      notFound: [],
      weakMatches: []
    };

    try {
      setRunning(true, "Paso 2 en progreso: ejecutando carga masiva...");

      while (true) {
        await waitForGradeTable();
        pagesVisited += 1;

        const result = await fillCurrentPage({
          pending,
          autoSave,
          smartMatch,
          diagnostics
        });

        totalFilled += result.filled;
        console.log(`[Importador IA] Pagina ${pagesVisited}: ${result.filled} notas aplicadas.`);

        if (!autoNext || pending.size === 0) break;
        const moved = await moveToNextPage();
        if (!moved) break;
      }

      for (const id of pending) {
        const rec = state.records.find((r) => r.id === id);
        if (rec) diagnostics.notFound.push({ cedula: rec.cedula, nombre: rec.nombre, nota: rec.nota });
      }

      if (diagnostics.notFound.length) console.warn("[Importador IA] Registros no encontrados:", diagnostics.notFound);
      if (diagnostics.weakMatches.length)
        console.warn("[Importador IA] Coincidencias inteligentes usadas:", diagnostics.weakMatches);

      if (!state.billing.premium) {
        state.billing.runsUsed += 1;
        await saveTeacherBillingState();
      }

      renderBillingState();

      if (!state.billing.premium && state.billing.runsUsed >= RULES.freeRuns) {
        const panel = document.getElementById(IDS.panel);
        if (panel) panel.classList.remove("mineduc-hidden");
        alert(
          `Has completado tus ${RULES.freeRuns} ejecuciones gratis para ${state.teacher.label}.\n` +
            `Ahora debes pagar la suscripcion de $${RULES.premiumPriceUsd} en PayPhone o PayPal para seguir subiendo notas.`
        );
      }

      alert(
        `Carga finalizada.\n` +
          `Notas aplicadas: ${totalFilled}\n` +
          `Pendientes: ${diagnostics.notFound.length}\n` +
          `Coincidencias IA por nombre: ${diagnostics.weakMatches.length}`
      );
    } catch (error) {
      console.error("[Importador IA] Error durante carga:", error);
      alert("Error durante la carga masiva. Revisa consola.");
    } finally {
      setRunning(false);
    }
  }

  async function fillCurrentPage(config) {
    const rows = Array.from(document.querySelectorAll("table tr"));
    let filled = 0;

    for (const row of rows) {
      const cells = row.querySelectorAll("td");
      if (!cells.length) continue;

      const student = extractStudentFromRow(row, cells);
      if (!student.nombre && !student.cedula) continue;

      const record = pickRecordForStudent(student, config.pending, config.smartMatch);
      if (!record) continue;

      const input = row.querySelector("input[type='text'], input[type='number'], input:not([type])");
      if (!input) continue;

      setInputValue(input, record.nota);

      if (config.autoSave) {
        const saveButton = findSaveButton(row);
        if (saveButton) {
          saveButton.click();
          await sleep(RULES.rowSaveDelay);
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

    return { filled };
  }

  function pickRecordForStudent(student, pending, smartMatch) {
    if (student.cedula && state.byCedula.has(student.cedula)) {
      const exactCed = state.byCedula.get(student.cedula);
      if (exactCed && pending.has(exactCed.id)) return { ...exactCed, _aiScore: 1 };
    }

    if (!student.nombre) return null;

    const candidates = state.records.filter((r) => pending.has(r.id) && r.nombre);
    if (!candidates.length) return null;

    const exactName = candidates.find((r) => r.nombre === student.nombre);
    if (exactName) return { ...exactName, _aiScore: 1 };
    if (!smartMatch) return null;

    let best = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      const score = nameSimilarity(candidate.nombre, student.nombre);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }

    if (!best || bestScore < RULES.similarityThreshold) return null;
    return { ...best, _aiScore: Number(bestScore.toFixed(3)) };
  }

  function nameSimilarity(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;

    const aTokens = a.split(" ").filter(Boolean);
    const bTokens = b.split(" ").filter(Boolean);
    const inter = aTokens.filter((t) => bTokens.includes(t)).length;
    const union = new Set([...aTokens, ...bTokens]).size || 1;
    const tokenScore = inter / union;
    const levScore = 1 - levenshtein(a, b) / Math.max(a.length, b.length, 1);

    return tokenScore * 0.55 + levScore * 0.45;
  }

  function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i += 1) dp[i][0] = i;
    for (let j = 0; j <= n; j += 1) dp[0][j] = j;

    for (let i = 1; i <= m; i += 1) {
      for (let j = 1; j <= n; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }

    return dp[m][n];
  }

  function extractStudentFromRow(row, cells) {
    const cellTexts = Array.from(cells).map((cell) => cleanText(cell.innerText));

    let cedula = "";
    for (const text of cellTexts) {
      const c = sanitizeCedula(text);
      if (c.length >= 9) {
        cedula = c;
        break;
      }
    }

    const name = cellTexts
      .filter((t) => /[A-Za-z]/.test(t))
      .filter((t) => !/guardar|siguiente|anterior|calificacion|accion|trimestre|supletorio/i.test(t))
      .sort((a, b) => b.length - a.length)[0] || "";

    return { cedula, nombre: normalizeName(name) };
  }

  function isGradesView() {
    const hasInput = document.querySelectorAll("table input").length > 0;
    const hasSave = Array.from(document.querySelectorAll("button, input[type='button'], input[type='submit']")).some(
      (el) => /guardar/i.test(el.textContent || el.value || "")
    );
    return hasInput || hasSave;
  }

  async function moveToNextPage() {
    const next = findNextButton();
    if (!next || isDisabled(next)) return false;

    next.click();
    await sleep(RULES.pageWaitMs);
    return true;
  }

  function findNextButton() {
    const nodes = Array.from(document.querySelectorAll("button, a, input[type='button'], input[type='submit']"));
    return nodes.find((el) => /siguiente/i.test(el.textContent || el.value || "")) || null;
  }

  function isDisabled(el) {
    return Boolean(el.disabled) || el.getAttribute("aria-disabled") === "true";
  }

  async function waitForGradeTable() {
    const timeout = Date.now() + 10000;
    while (Date.now() < timeout) {
      if (document.querySelectorAll("table tr td").length > 0) return;
      await sleep(150);
    }
  }

  function findSaveButton(row) {
    const candidates = Array.from(row.querySelectorAll("button, input[type='button'], input[type='submit']"));
    return candidates.find((btn) => /guardar/i.test(btn.textContent || btn.value || "")) || candidates[0] || null;
  }

  function setInputValue(input, value) {
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
    if (descriptor && descriptor.set) descriptor.set.call(input, String(value));
    else input.value = String(value);

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function parseRecordsFromFile(file) {
    const name = (file.name || "").toLowerCase();

    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const rows = await parseExcelRows(file);
      return normalizeRowsToRecords(rows);
    }

    if (name.endsWith(".csv") || name.endsWith(".txt")) {
      const text = await readTextFile(file);
      const rows = textToRows(text);
      const fromRows = normalizeRowsToRecords(rows);
      if (fromRows.length) return fromRows;
      return parseUnstructuredText(text);
    }

    if (name.endsWith(".pdf") || name.endsWith(".doc") || name.endsWith(".docx")) {
      const text = await extractTextBestEffort(file);
      const rows = textToRows(text);
      const fromRows = normalizeRowsToRecords(rows);
      if (fromRows.length) return fromRows;
      return parseUnstructuredText(text);
    }

    throw new Error("Tipo de archivo no soportado");
  }

  function parseExcelRows(file) {
    return new Promise((resolve, reject) => {
      if (typeof XLSX === "undefined") {
        reject(new Error("SheetJS no esta disponible"));
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
      reader.onload = (e) => {
        try {
          const workbook = XLSX.read(e.target.result, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
          resolve(rows);
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  function readTextFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("No se pudo leer texto."));
      reader.onload = (e) => resolve(String(e.target.result || ""));
      reader.readAsText(file, "utf-8");
    });
  }

  function extractTextBestEffort(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("No se pudo leer binario."));
      reader.onload = (e) => {
        const buffer = e.target.result;
        try {
          const utf = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
          if (utf && utf.length > 20) {
            resolve(utf);
            return;
          }
        } catch (err) {
          // Continue to fallback below.
        }

        try {
          const latin = new TextDecoder("iso-8859-1", { fatal: false }).decode(buffer);
          resolve(latin || "");
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  function textToRows(text) {
    const lines = String(text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) return [];

    const sep = detectDelimiter(lines.slice(0, 5).join("\n"));
    return lines.map((line) => line.split(sep).map((v) => cleanText(v)));
  }

  function detectDelimiter(sample) {
    const first = String(sample || "").split(/\r?\n/)[0] || "";
    const scores = [
      { d: ";", c: (first.match(/;/g) || []).length },
      { d: ",", c: (first.match(/,/g) || []).length },
      { d: "\t", c: (first.match(/\t/g) || []).length },
      { d: "|", c: (first.match(/\|/g) || []).length }
    ];

    scores.sort((a, b) => b.c - a.c);
    return scores[0].c > 0 ? scores[0].d : ";";
  }

  function normalizeRowsToRecords(rows) {
    if (!Array.isArray(rows) || !rows.length) return [];

    const cfg = detectColumns(rows);
    const dedupe = new Map();

    for (let i = cfg.startAt; i < rows.length; i += 1) {
      const row = rows[i] || [];
      const cedula = cfg.cedulaIndex >= 0 ? sanitizeCedula(row[cfg.cedulaIndex]) : "";
      const nombre = cfg.nombreIndex >= 0 ? normalizeName(row[cfg.nombreIndex]) : "";
      const nota = cfg.notaIndex >= 0 ? sanitizeGrade(row[cfg.notaIndex]) : null;

      if (nota === null) continue;
      if (!cedula && !nombre) continue;

      const key = cedula || nombre;
      dedupe.set(key, { cedula, nombre, nota });
    }

    return Array.from(dedupe.values());
  }

  function detectColumns(rows) {
    const maxHeaderRows = Math.min(rows.length, 6);

    for (let r = 0; r < maxHeaderRows; r += 1) {
      const headers = (rows[r] || []).map((h) => normalizeHeader(h));
      const notaIndex = findHeaderIndex(headers, ["nota", "calificacion", "puntaje", "score"]);
      const cedulaIndex = findHeaderIndex(headers, ["cedula", "identificacion", "numero de cedula", "dni"]);
      const nombreIndex = findHeaderIndex(headers, ["nombre", "estudiante", "apellidos y nombres", "alumno"]);

      if (notaIndex !== -1 && (cedulaIndex !== -1 || nombreIndex !== -1)) {
        return {
          startAt: r + 1,
          cedulaIndex,
          nombreIndex,
          notaIndex
        };
      }
    }

    const first = rows[0] || [];
    return {
      startAt: 0,
      cedulaIndex: first.length >= 2 ? 0 : -1,
      nombreIndex: first.length >= 3 ? 1 : 0,
      notaIndex: first.length >= 3 ? 2 : 1
    };
  }

  function parseUnstructuredText(text) {
    const lines = String(text || "")
      .split(/\r?\n/)
      .map((line) => cleanText(line))
      .filter(Boolean);

    const output = [];

    for (const line of lines) {
      const gradeMatch = line.match(/(\d{1,2}(?:[\.,]\d{1,2})?)\s*$/);
      if (!gradeMatch) continue;

      const nota = sanitizeGrade(gradeMatch[1]);
      if (nota === null) continue;

      const base = line.slice(0, gradeMatch.index).trim();
      const cedMatch = base.match(/\b\d{9,13}\b/);
      const cedula = cedMatch ? sanitizeCedula(cedMatch[0]) : "";

      const namePart = normalizeName(base.replace(/\b\d{9,13}\b/, " "));
      if (!cedula && !namePart) continue;

      output.push({ cedula, nombre: namePart, nota });
    }

    const dedupe = new Map();
    for (const rec of output) {
      const key = rec.cedula || rec.nombre;
      dedupe.set(key, rec);
    }

    return Array.from(dedupe.values());
  }

  function findHeaderIndex(headers, aliases) {
    return headers.findIndex((h) => aliases.some((alias) => h.includes(alias)));
  }

  function sanitizeCedula(value) {
    if (value === undefined || value === null) return "";
    const digits = String(value).replace(/\D/g, "");
    if (digits.length === 9) return digits.padStart(10, "0");
    return digits;
  }

  function sanitizeGrade(value) {
    if (value === undefined || value === null || value === "") return null;
    const txt = String(value).trim().replace(/\s+/g, "").replace(/,/g, ".");
    if (!/^\d+(\.\d+)?$/.test(txt)) return null;

    const n = Number(txt);
    if (Number.isNaN(n) || n < RULES.minGrade || n > RULES.maxGrade) return null;
    return formatGrade(n);
  }

  function formatGrade(n) {
    return n.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
  }

  function normalizeName(value) {
    return cleanText(value)
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeHeader(value) {
    return cleanText(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function setLoadedText(text) {
    const el = document.getElementById(IDS.loaded);
    if (el) el.textContent = text;
  }

  function setRunning(running, statusText) {
    state.running = running;
    const status = document.getElementById(IDS.status);
    if (statusText && status) {
      status.textContent = statusText;
      status.className = "mineduc-status";
    }
    updateRunButtonState();
  }

  function updateRunButtonState() {
    const run = document.getElementById(IDS.executeButton);
    if (!run) return;
    updateLoadedActionsVisibility();
    run.disabled = state.running || state.teacherBlocked || !state.records.length || !isGradesView() || !hasAccess();
  }

  function hasDetectedTeacherIdentity() {
    return state.teacher.key !== "DOCENTE_DESCONOCIDO" && state.teacher.key.length >= 6;
  }

  function detectAcademicTeacher() {
    const selectors = [
      "#ctl00_lblUsuario",
      "#ctl00_lblDocente",
      "#lblUsuario",
      "#lblDocente",
      "[id*='lblUsuario']",
      "[id*='lblDocente']",
      "[id*='usuario']",
      ".user-name",
      ".username",
      ".usuario",
      ".profile-name",
      ".user-info",
      ".navbar-text",
      ".dropdown-toggle"
    ];

    const candidates = [];
    const seen = new Set();

    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((node) => {
        const text = cleanText(node.textContent || "");
        if (!text || seen.has(text)) return;
        seen.add(text);
        candidates.push(text);
      });
    }

    const bodyText = cleanText(document.body?.innerText || "").slice(0, 15000);
    const patterns = [
      /(?:usuario|docente|bienvenido(?:\/?a)?|welcome)\s*:?\s*([A-Za-zÁÉÍÓÚÑáéíóúü.\- ]{6,80})/gi,
      /([A-ZÁÉÍÓÚÑ]{2,}(?:\s+[A-ZÁÉÍÓÚÑ]{2,}){1,5})/g
    ];

    for (const pattern of patterns) {
      for (const match of bodyText.matchAll(pattern)) {
        const value = cleanText(match[1] || match[0] || "");
        if (!value || seen.has(value)) continue;
        seen.add(value);
        candidates.push(value);
      }
    }

    const best = candidates
      .map((label) => ({ label, key: normalizeTeacherKey(label) }))
      .filter((item) => item.key && item.key.length >= 6)
      .filter((item) => !/ACADEMICO|IMPORTADOR|NOTAS|SISTEMA|GENERAL|INICIO|MENU/.test(item.key))
      .sort((a, b) => b.key.length - a.key.length)[0];

    if (!best) {
      return {
        key: "DOCENTE_DESCONOCIDO",
        label: "Docente no detectado"
      };
    }

    return best;
  }

  function normalizeTeacherKey(value) {
    return cleanText(value)
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function downloadTemplate() {
    const rows = [
      ["Cedula", "Nombre", "Nota"],
      ["0606373421", "BRAVO TIXI MARIA CRUZ", "8.5"],
      ["0650372949", "DAQUILEMA BUNAY DAVID ESTEBAN", "7.2"],
      ["0606379568", "DAQUILEMA GUARACA OMAR GILBERTO", "9"]
    ];

    try {
      if (typeof XLSX !== "undefined") {
        const ws = XLSX.utils.aoa_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
        XLSX.writeFile(wb, "plantilla_notas_mineduc.xlsx");
        return;
      }

      const csv = rows.map((r) => r.join(";")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "plantilla_notas_mineduc.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("[Importador IA] Error al descargar plantilla:", error);
      alert("No se pudo generar la plantilla.");
    }
  }

  async function ensureInstallId() {
    const stored = await storageGet(["installId"]);
    if (stored.installId) return stored.installId;
    const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
    const ts = Date.now().toString(36).toUpperCase();
    const id = "BRW-" + rand + "-" + ts;
    await storageSet({ installId: id });
    return id;
  }

  function storageGet(keys) {
    return new Promise((resolve) => {
      if (!chrome || !chrome.storage || !chrome.storage.local) {
        resolve({});
        return;
      }

      chrome.storage.local.get(keys, (result) => resolve(result || {}));
    });
  }

  function storageSet(payload) {
    return new Promise((resolve) => {
      if (!chrome || !chrome.storage || !chrome.storage.local) {
        resolve();
        return;
      }

      chrome.storage.local.set(payload, () => resolve());
    });
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
