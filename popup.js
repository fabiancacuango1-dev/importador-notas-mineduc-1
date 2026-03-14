/**
 * popup.js — Lógica del popup de la extensión
 * Importador de Notas Mineduc
 *
 * Gestiona:
 *  - Botón de compra por WhatsApp
 *  - Activación de licencia (envía mensaje al content script)
 *  - Estado visual de la licencia
 */

const comprarWhatsAppBtn = document.getElementById("comprarWhatsAppBtn");
const codigoLicenciaInput = document.getElementById("codigoLicenciaInput");
const activarLicenciaBtn = document.getElementById("activarLicenciaBtn");
const stateEl = document.getElementById("state");
const premiumBadge = document.getElementById("premiumBadge");

// Número de WhatsApp del administrador
const WHATSAPP_NUMERO = "593983274499";
const WHATSAPP_MENSAJE = "Quiero comprar la licencia del Importador de Notas Mineduc";

// ─── HELPERS ─────────────────────────────────────────────

function setStatus(texto, tipo) {
  stateEl.textContent = texto;
  stateEl.className = tipo || "";
}

function mostrarPremium() {
  premiumBadge.classList.add("visible");
  activarLicenciaBtn.disabled = true;
  codigoLicenciaInput.disabled = true;
  comprarWhatsAppBtn.disabled = true;
  setStatus("✅ Licencia activa", "ok");
}

function enviarMensajeAlContentScript(mensaje) {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) {
        reject(new Error("No hay pestaña activa."));
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, mensaje, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  });
}

// ─── VERIFICAR ESTADO AL ABRIR POPUP ─────────────────────

async function verificarEstadoInicial() {
  // Primero revisar chrome.storage
  if (chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["mineducLicencia", "mineducFirebaseLicense"], (result) => {
      const lic = result.mineducLicencia || result.mineducFirebaseLicense;
      if (lic && (lic.activada || lic.activated)) {
        mostrarPremium();
      }
    });
  }

  // También intentar preguntar al content script
  try {
    const resp = await enviarMensajeAlContentScript({ type: "CHECK_LICENSE_STATUS" });
    if (resp && resp.active) {
      mostrarPremium();
    }
  } catch (e) {
    // Content script puede no estar cargado si no estamos en la página de Academico
  }
}

// ─── BOTÓN: COMPRAR POR WHATSAPP ─────────────────────────

comprarWhatsAppBtn.addEventListener("click", () => {
  const mensaje = encodeURIComponent(WHATSAPP_MENSAJE);
  const url = `https://wa.me/${WHATSAPP_NUMERO}?text=${mensaje}`;
  chrome.tabs.create({ url: url });
});

// ─── BOTÓN: ACTIVAR LICENCIA ─────────────────────────────

activarLicenciaBtn.addEventListener("click", async () => {
  const codigo = codigoLicenciaInput.value.trim().toUpperCase();

  if (!codigo) {
    setStatus("Ingresa un código de licencia.", "error");
    return;
  }

  if (codigo.length < 6) {
    setStatus("El código es demasiado corto.", "error");
    return;
  }

  setStatus("Verificando licencia...", "");
  activarLicenciaBtn.disabled = true;

  try {
    // Enviar al content script para que active vía FirebaseDB
    const resp = await enviarMensajeAlContentScript({
      type: "ACTIVATE_LICENSE",
      codigo: codigo
    });

    if (resp && resp.exito) {
      mostrarPremium();
      // También guardar en chrome.storage como respaldo
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          mineducLicencia: {
            codigo: codigo,
            activada: true,
            fechaLocal: new Date().toISOString()
          }
        });
      }
    } else {
      setStatus(resp?.mensaje || "No se pudo activar la licencia.", "error");
      activarLicenciaBtn.disabled = false;
    }
  } catch (error) {
    // Si el content script no está disponible, intentar activación directa vía storage
    setStatus("Abre la página de Académico para activar la licencia.", "error");
    activarLicenciaBtn.disabled = false;
  }
});

// ─── INICIALIZAR ─────────────────────────────────────────

verificarEstadoInicial();
