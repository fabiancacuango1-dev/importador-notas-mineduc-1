# Despliegue robusto con PayPhone + Cloudflare Worker

Esta es la forma recomendada para dejar la activacion automatica funcionando de verdad en produccion.

## 1. Requisitos

- Cuenta de Cloudflare.
- `wrangler` instalado.
- Credenciales reales de PayPhone.
- URL publica del Worker.
- Webhook configurado en PayPhone.

## 2. Entrar a la carpeta del backend

```bash
cd "/Users/luisfabiancacuangoeugenio/Documents/Programacion /importador-notas-mineduc/backend-license-api"
```

## 3. Instalar Wrangler si no lo tienes

```bash
npm install -g wrangler
```

## 4. Iniciar sesion en Cloudflare

```bash
wrangler login
```

## 5. Crear el KV Namespace

```bash
wrangler kv namespace create LICENSES_KV
```

Toma el `id` que devuelve el comando y ponlo en `wrangler.toml` donde dice:

```toml
[[kv_namespaces]]
binding = "LICENSES_KV"
id = "REEMPLAZAR_CON_TU_KV_ID"
```

## 6. Configurar variables publicas en `wrangler.toml`

Deben quedar asi, ajustando solo tus valores reales:

```toml
[vars]
ALLOWED_ORIGIN = "https://academico.educarecuador.gob.ec"
PAYPHONE_API_URL = "https://pay.payphonetodoesposible.com/api/button/Prepare"
PAYPHONE_RESPONSE_URL = "https://academico.educarecuador.gob.ec/"
PAYPHONE_CURRENCY = "USD"
PAYPHONE_AMOUNT_CENTS = "199"
PAYPHONE_PAYMENT_BASE_URL = "https://pay.payphonetodoesposible.com"
PAYPHONE_CHECKOUT_URL = "https://ppls.me/p7aXRq2flYO7ofkHtfhFlQ"
```

Notas:
- `PAYPHONE_CHECKOUT_URL` queda como respaldo.
- Si la API oficial responde con URL de pago, ese valor de respaldo no se usa.

## 7. Configurar secretos reales

Ejecuta estos comandos:

```bash
wrangler secret put PAYPHONE_API_TOKEN
wrangler secret put PAYPHONE_STORE_ID
wrangler secret put PAYPHONE_WEBHOOK_SECRET
```

Y en `wrangler.toml` puedes dejar este tiempo para expirar pagos pendientes viejos:

```toml
PENDING_PAYMENT_TTL_MINUTES = "30"
```

Valores esperados:
- `PAYPHONE_API_TOKEN`: token privado de tu cuenta PayPhone.
- `PAYPHONE_STORE_ID`: identificador real de tu comercio o store.
- `PAYPHONE_WEBHOOK_SECRET`: secreto que usaras para validar el webhook si luego decides endurecer esa validacion.

## 8. Desplegar el Worker

```bash
wrangler deploy
```

Eso te devolvera una URL parecida a esta:

```text
https://mineduc-license-api.tu-cuenta.workers.dev
```

## 9. Configurar la extension para usar el Worker

En [content.js](/Users/luisfabiancacuangoeugenio/Documents/Programacion%20/importador-notas-mineduc/content.js) cambia:

```js
licenseApiBase: "https://TU_DOMINIO_API/licenses"
```

por algo asi:

```js
licenseApiBase: "https://mineduc-license-api.tu-cuenta.workers.dev/licenses"
```

## 10. Configurar el webhook en PayPhone

En el panel o configuracion de PayPhone, apunta el webhook a:

```text
https://mineduc-license-api.tu-cuenta.workers.dev/webhooks/payphone
```

## 11. Campo que debe viajar en el pago

Para que la activacion automatica funcione por docente, el pago debe incluir una referencia unica del docente.

Este proyecto usa:

```text
reference = DOC-NOMBRE-DEL-DOCENTE
```

o tambien puede llegar como:
- `clientTransactionId`
- `metadata.teacherKey`

## 12. Prueba real recomendada

Haz esta prueba completa:

1. Entra con un docente.
2. Consume las 3 ejecuciones gratis.
3. Pulsa pagar.
4. Verifica que el Worker cree el checkout.
5. Completa el pago.
6. Verifica que PayPhone llame al webhook.
7. Confirma que `GET /licenses/payphone-status?teacherKey=...` devuelva `paid: true`.
8. Confirma que la extension active Premium sola.

## 13. Si algo falla

Revisa en este orden:

1. Que `licenseApiBase` apunte al Worker correcto.
2. Que `PAYPHONE_API_TOKEN` y `PAYPHONE_STORE_ID` sean reales.
3. Que PayPhone envie `reference` o `clientTransactionId` en el webhook.
4. Que el webhook llegue a `/webhooks/payphone`.
5. Que el KV namespace este bien enlazado.

## 14. Recomendacion final

Para salir rapido puedes usar el respaldo `ppls.me`, pero para una activacion verdaderamente robusta debes usar la API oficial con referencia por docente y webhook activo.