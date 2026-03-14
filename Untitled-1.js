import { crearPanelActivacion } from "./activate.js";

const contenedor = document.getElementById("mineducLicenseBox");
crearPanelActivacion(contenedor, () => {
  // callback cuando se activa — habilitar funciones Pro
  state.billing.isActive = true;
});