# Backend de suscripciones (Produccion)

Este backend activa la suscripcion Premium automaticamente para la extension, separada por docente del sistema academico.

## Objetivo
- 3 ejecuciones gratis por docente.
- Suscripcion de $1.99 por PayPhone.
- Activacion automatica sin codigo manual.
- Un docente no comparte la activacion con otro docente distinto.

## Endpoints
- `POST /licenses/payphone-checkout`
  - Input: `{ teacherKey, teacherLabel }`
  - Output: `{ checkoutUrl, reference, amount, teacherKey }`
  - Este endpoint prepara la referencia del docente y, si configuras la API oficial, crea el checkout real en PayPhone.

- `GET /licenses/payphone-status?teacherKey=...`
  - Output: `{ paid, pending, status, licenseCode }`
  - La extension consulta este endpoint automaticamente.

- `POST /webhooks/payphone`
  - Recibe confirmacion de PayPhone.
  - Activa la suscripcion para el `teacherKey` recibido en la referencia o metadata del pago.

## Flujo recomendado
1. La extension detecta el docente activo en Academico.
2. Al agotar 3 ejecuciones gratis, la extension solicita `POST /licenses/payphone-checkout`.
3. El worker devuelve `reference` y `checkoutUrl`.
4. La extension abre el checkout y empieza a consultar `GET /licenses/payphone-status`.
4. El webhook `POST /webhooks/payphone` marca el pago como `active` para ese docente.
5. La extension detecta `paid=true` y activa Premium automaticamente.

## Requisito importante para PayPhone
Para que la activacion sea realmente automatica, el webhook de PayPhone debe entregar un identificador del docente, por ejemplo en alguno de estos campos:
- `reference`
- `clientTransactionId`
- `metadata.teacherKey`
- `custom_fields.teacherKey`

Si tu enlace `ppls.me` no permite enviar ese identificador, debes crear el cobro desde la API de PayPhone usando un `reference` por docente. El worker ya esta listo para consumir ese dato cuando llegue en el webhook.

## Contrato recomendado con PayPhone
Este worker ya intenta crear el checkout usando estas variables:

- `PAYPHONE_API_URL`
- `PAYPHONE_API_TOKEN`
- `PAYPHONE_STORE_ID`
- `PAYPHONE_RESPONSE_URL`
- `PAYPHONE_AMOUNT_CENTS`
- `PAYPHONE_CURRENCY`

Si faltan `PAYPHONE_API_TOKEN` o `PAYPHONE_STORE_ID`, el worker cae al enlace `PAYPHONE_CHECKOUT_URL` como respaldo.

Cuando generes el checkout desde la API oficial, envia al menos:

```json
{
  "amount": 199,
  "amountWithTax": 199,
  "tax": 0,
  "clientTransactionId": "DOC-NOMBRE-DEL-DOCENTE",
  "reference": "DOC-NOMBRE-DEL-DOCENTE",
  "storeId": "TU_STORE_ID",
  "currency": "USD"
}
```

En el webhook, el worker ya intenta leer el docente desde cualquiera de estos campos:
- `reference`
- `clientTransactionId`
- `metadata.teacherKey`
- `custom_fields.teacherKey`

Ejemplo minimo de webhook que este worker reconoce:

```json
{
  "event": "PAYMENT_APPROVED",
  "data": {
    "id": "trxn_123456",
    "status": "PAID",
    "reference": "DOC-JUAN-PEREZ"
  }
}
```

## Seguridad minima
- Validar secreto del webhook de PayPhone con `PAYPHONE_WEBHOOK_SECRET`.
- Restringir CORS a la extension o a tu dominio.
- Guardar logs de pagos por `teacherKey` y `paymentId`.
- Aplicar rate limit al endpoint de status si luego migras a base de datos.
- Expirar pagos pendientes viejos con `PENDING_PAYMENT_TTL_MINUTES` para evitar checkouts reciclados indefinidamente.
- Reutilizar checkouts pendientes recientes para evitar cobros duplicados al mismo docente.

## Archivos
- `worker.js`: API HTTP base para intentos, status y webhook.
- `schema.sql`: tabla SQL sugerida si migras de KV a base de datos.
- `wrangler.toml`: ejemplo de despliegue.

## Integracion extension
En `content.js`, configurar:
- `BILLING.licenseApiBase = "https://TU_DOMINIO_API/licenses"`
- `BILLING.payphoneCheckoutUrl = "TU_LINK_O_CHECKOUT_PAYPHONE"` solo como respaldo temporal
