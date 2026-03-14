# Configuracion de pagos oficiales (PayPhone automatico)

Este proyecto ya trae:
- 3 ejecuciones gratis por docente.
- Bloqueo automatico al llegar a 3.
- Suscripcion Premium ilimitada por $1.99.
- Activacion automatica sin codigo manual.
- Separacion de estado por docente detectado en Academico.

## 1) Configurar el enlace de pago
Edita [content.js](/Users/luisfabiancacuangoeugenio/Documents/Programacion%20/importador-notas-mineduc/content.js) en el objeto `BILLING`:

- `payphoneCheckoutUrl`: tu enlace real de PayPhone.
- `licenseApiBase`: la URL publica de tu Worker/API.

Ejemplo:
- `https://ppls.me/p7aXRq2flYO7ofkHtfhFlQ`
- `https://tu-worker.tudominio.com/licenses`

## 2) Activacion automatica
La extension ya hace esto sola:
1. Detecta el docente activo.
2. Cuando se abre el pago, registra una intencion en backend.
3. Empieza a consultar automaticamente el estado del pago.
4. Cuando el webhook confirma el cobro, activa Premium para ese docente.

## 3) Requisito clave de PayPhone
Para que la activacion sea automatica de verdad, el webhook debe incluir el identificador del docente en un campo como:
- `reference`
- `clientTransactionId`
- `metadata.teacherKey`

Si tu enlace `ppls.me` no permite enviar ese identificador, debes generar el cobro desde la API de PayPhone para adjuntar ese `teacherKey`.

## 4) Consideraciones
- El contador gratis y el estado Premium se guardan por docente en `chrome.storage.local`.
- Si cambia el usuario academico, la extension carga el estado comercial de ese otro docente.
- La seguridad real depende del backend y del webhook de PayPhone, no del almacenamiento local.
