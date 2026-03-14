/**
 * activacion.js — Módulo de activación de licencias
 * Importador de Notas Mineduc
 *
 * Depende de: firebase.js (FirebaseDB), licencias.js (Licencias)
 * Compatible con content scripts Chrome Extension (Manifest V3).
 *
 * Lógica de activación:
 *  1. Código no existe           → error
 *  2. "activado" + otra máquina  → bloquear
 *  3. "activado" + misma máquina → OK (reactivación)
 *  4. "disponible"               → activar, vincular machine_id
 *
 * Expone: window.Activacion
 */
const Activacion = (() => {
  "use strict";

  const CONFIG = {
    whatsappNumero: "593983274499",
    whatsappMensaje: "Quiero comprar el Importador de Notas Mineduc",
    precioTexto: "$5.00 USD"
  };

  // ─── GUARDAR LICENCIA EN STORAGE LOCAL ─────────────────

  function guardarLicenciaLocal(datos) {
    return new Promise(resolve => {
      const payload = { mineducLicencia: datos };
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set(payload, () => resolve());
      } else {
        try {
          localStorage.setItem("mineducLicencia", JSON.stringify(datos));
        } catch (e) { /* ok */ }
        resolve();
      }
    });
  }

  // ─── LIMPIAR LICENCIA LOCAL ────────────────────────────

  function limpiarLicenciaLocal() {
    return new Promise(resolve => {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.remove(["mineducLicencia"], () => resolve());
      } else {
        try { localStorage.removeItem("mineducLicencia"); } catch (e) { /* ok */ }
        resolve();
      }
    });
  }

  // ─── ACTIVAR LICENCIA ──────────────────────────────────
  /**
   * Proceso completo de activación:
   * - Verifica el código en Firestore
   * - Si está disponible: vincula machine_id, cambia estado a "activado"
   * - Guarda la licencia localmente
   *
   * @param {string} codigo  — Código de licencia
   * @param {string} usuario — Nombre/ID del usuario (opcional)
   * @returns {Promise<{exito: boolean, mensaje: string}>}
   */
  async function activarLicencia(codigo, usuario) {
    const codigoLimpio = (codigo || "").trim().toUpperCase();

    if (!codigoLimpio) {
      return { exito: false, mensaje: "Ingresa un código de licencia." };
    }
    if (codigoLimpio.length < 6) {
      return { exito: false, mensaje: "El código es demasiado corto." };
    }

    try {
      // Verificar en Firestore
      const verificacion = await Licencias.verificarCodigo(codigoLimpio);

      // Código no existe
      if (!verificacion.existe) {
        return { exito: false, mensaje: verificacion.mensaje };
      }

      // Ya activada en ESTA máquina → OK
      if (verificacion.activadaEnEstaMaquina) {
        await guardarLicenciaLocal({
          codigo: codigoLimpio,
          activada: true,
          fechaLocal: new Date().toISOString()
        });
        return { exito: true, mensaje: "Licencia válida. Plugin activo en este dispositivo." };
      }

      // Ya activada en OTRA máquina → bloquear
      if (!verificacion.disponible && !verificacion.activadaEnEstaMaquina) {
        return { exito: false, mensaje: "Esta licencia ya fue activada en otro dispositivo." };
      }

      // Disponible → activar y vincular
      const machineId = await Licencias.obtenerMachineId();

      await FirebaseDB.updateDoc(Licencias.COLECCION, verificacion.docId, {
        estado: "activado",
        machine_id: machineId,
        usuario: usuario || "usuario_desconocido",
        fecha_activacion: new Date().toISOString()
      });

      // Guardar localmente
      await guardarLicenciaLocal({
        codigo: codigoLimpio,
        activada: true,
        machineId: machineId,
        fechaLocal: new Date().toISOString()
      });

      return { exito: true, mensaje: "¡Licencia activada! Modo Pro habilitado." };

    } catch (error) {
      console.error("[Activacion] Error al activar:", error);
      return { exito: false, mensaje: "Error de conexión. Revisa tu internet e intenta de nuevo." };
    }
  }

  // ─── VERIFICAR LICENCIA AL INICIAR ─────────────────────
  /**
   * Verifica si hay licencia guardada localmente y valida contra Firestore.
   * @returns {Promise<boolean>}
   */
  async function verificarAlIniciar() {
    try {
      const licLocal = await Licencias.obtenerLicenciaLocal();
      if (!licLocal || !licLocal.activada || !licLocal.codigo) return false;

      // Verificar contra Firestore
      const verificacion = await Licencias.verificarCodigo(licLocal.codigo);
      return verificacion.activadaEnEstaMaquina === true;
    } catch (error) {
      console.error("[Activacion] Error al verificar:", error);
      return false;
    }
  }

  // ─── ABRIR WHATSAPP PARA COMPRA ────────────────────────

  function abrirWhatsAppCompra() {
    const mensaje = encodeURIComponent(CONFIG.whatsappMensaje);
    const url = "https://wa.me/" + CONFIG.whatsappNumero + "?text=" + mensaje;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  // ─── API PÚBLICA ───────────────────────────────────────

  return {
    CONFIG,
    activarLicencia,
    verificarAlIniciar,
    abrirWhatsAppCompra,
    guardarLicenciaLocal,
    limpiarLicenciaLocal
  };
})();

if (typeof window !== "undefined") window.Activacion = Activacion;
