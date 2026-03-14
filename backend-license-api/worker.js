export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(env) });
    }

    try {
      if (url.pathname === "/health" && request.method === "GET") {
        return json({ ok: true, service: "mineduc-license-api" }, env);
      }

      if (url.pathname === "/privacy-policy" && request.method === "GET") {
        return privacyPolicyPage();
      }

      if (url.pathname === "/health/paypal" && request.method === "GET") {
        const details = await getPayPalHealth(env);
        return json(details, env, details.ok ? 200 : 503);
      }

      if (url.pathname === "/licenses/capabilities" && request.method === "GET") {
        const details = await getPaymentCapabilities(env);
        return json(details, env, 200);
      }

      if (url.pathname === "/licenses/payphone-checkout" && request.method === "POST") {
        const body = await request.json();
        const teacherKey = sanitizeTeacherKey(body?.teacherKey);
        const teacherLabel = sanitizeTeacherLabel(body?.teacherLabel);

        if (!teacherKey) return json({ error: "teacherKey is required" }, env, 400);

        const checkout = await createPayPhoneCheckoutSession({ teacherKey, teacherLabel }, env);
        return json(checkout, env);
      }

      if (url.pathname === "/licenses/paypal-checkout" && request.method === "POST") {
        const body = await request.json();
        const teacherKey = sanitizeTeacherKey(body?.teacherKey);
        const teacherLabel = sanitizeTeacherLabel(body?.teacherLabel);

        if (!teacherKey) return json({ error: "teacherKey is required" }, env, 400);

        const checkout = await createPayPalCheckoutSession({ teacherKey, teacherLabel }, env);
        return json(checkout, env);
      }

      if (url.pathname === "/licenses/payphone-status" && request.method === "GET") {
        const teacherKey = sanitizeTeacherKey(url.searchParams.get("teacherKey"));
        if (!teacherKey) return json({ error: "teacherKey is required" }, env, 400);

        const plan = await getTeacherPlan(teacherKey, env);
        return json(
          {
            paid: Boolean(plan?.paid),
            pending: plan?.status === "pending",
            provider: plan?.provider || "payphone",
            status: plan?.status || "none",
            licenseCode: plan?.licenseCode || ""
          },
          env
        );
      }

      if (url.pathname === "/licenses/paypal-status" && request.method === "GET") {
        const teacherKey = sanitizeTeacherKey(url.searchParams.get("teacherKey"));
        if (!teacherKey) return json({ error: "teacherKey is required" }, env, 400);

        const plan = await getTeacherPlan(teacherKey, env);
        const resolved = await resolvePayPalPendingPlan(plan, teacherKey, env);
        return json(
          {
            paid: Boolean(resolved?.paid),
            pending: resolved?.status === "pending",
            provider: resolved?.provider || "paypal",
            status: resolved?.status || "none",
            licenseCode: resolved?.licenseCode || ""
          },
          env
        );
      }

      if (url.pathname === "/licenses/activate" && request.method === "POST") {
        const body = await request.json();
        const licenseKey = sanitizeLicenseKey(body?.license_key);
        const teacherId = sanitizeTeacherKey(body?.teacher_id);
        const fingerprint = sanitizeFingerprint(body?.browser_fingerprint);

        if (!licenseKey) return json({ error: "license_key es requerido" }, env, 400);
        if (!teacherId) return json({ error: "teacher_id es requerido" }, env, 400);

        const result = await activateLicense({ licenseKey, teacherId, fingerprint }, env);
        return json(result, env, result.success ? 200 : 409);
      }

      if (url.pathname === "/licenses/validate" && request.method === "GET") {
        const licenseKey = sanitizeLicenseKey(url.searchParams.get("license_key"));
        const teacherId = sanitizeTeacherKey(url.searchParams.get("teacher_id"));
        const fingerprint = sanitizeFingerprint(url.searchParams.get("browser_fingerprint"));

        if (!licenseKey) return json({ error: "license_key es requerido" }, env, 400);

        const result = await validateLicense({ licenseKey, teacherId, fingerprint }, env);
        return json(result, env, result.valid ? 200 : 403);
      }

      // Generate license codes (admin)
      if (url.pathname === "/licenses/generate" && request.method === "POST") {
        const body = await request.json();
        const count = Math.min(Math.max(parseInt(body?.count) || 10, 1), 500);
        const adminKey = body?.admin_key || "";
        // Simple admin auth via env secret or default key
        const expectedKey = env.ADMIN_KEY || "mineduc-admin-2026";
        if (adminKey !== expectedKey) {
          return json({ error: "Acceso no autorizado." }, env, 403);
        }
        const codes = [];
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        for (let i = 0; i < count; i++) {
          let code = "MINEDUC-";
          const bytes = new Uint8Array(10);
          crypto.getRandomValues(bytes);
          for (let j = 0; j < 10; j++) code += chars[bytes[j] % chars.length];
          const poolKey = `license-pool:${code}`;
          await env.LICENSES_KV.put(poolKey, JSON.stringify({ code, createdAt: new Date().toISOString(), used: false }));
          codes.push(code);
        }
        return json({ success: true, count: codes.length, codes }, env);
      }

      // List license codes (admin)
      if (url.pathname === "/licenses/list" && request.method === "GET") {
        const adminKey = url.searchParams.get("admin_key") || "";
        const expectedKey = env.ADMIN_KEY || "mineduc-admin-2026";
        if (adminKey !== expectedKey) {
          return json({ error: "Acceso no autorizado." }, env, 403);
        }
        const poolList = await env.LICENSES_KV.list({ prefix: "license-pool:", limit: 1000 });
        const codes = [];
        for (const key of poolList.keys) {
          const data = await env.LICENSES_KV.get(key.name, { type: "json" });
          codes.push({ code: key.name.replace("license-pool:", ""), used: data?.used || false, usedBy: data?.usedBy || "" });
        }
        return json({ success: true, total: codes.length, codes }, env);
      }

      // Debug: check a specific pool key
      if (url.pathname === "/licenses/check-pool" && request.method === "GET") {
        const code = sanitizeLicenseKey(url.searchParams.get("code"));
        if (!code) return json({ error: "code es requerido" }, env, 400);
        const poolData = await env.LICENSES_KV.get(`license-pool:${code}`, { type: "json" });
        const licenseData = await env.LICENSES_KV.get(`license:${code}`, { type: "json" });
        return json({ code, inPool: !!poolData, poolData, activated: !!licenseData, licenseData }, env);
      }

      if (url.pathname === "/webhooks/payphone" && request.method === "POST") {
        const secretValid = verifyWebhookSecret(request, env);
        if (!secretValid) return json({ error: "Unauthorized webhook" }, env, 401);

        const body = await request.json();
        const ok = await processPayPhoneWebhook(body, env);
        return json({ ok }, env);
      }

      return json({ error: "Not found" }, env, 404);
    } catch (error) {
      return json({ error: String(error.message || error) }, env, 500);
    }
  }
};

async function createPayPhoneCheckoutSession(input, env) {
  const teacherKey = sanitizeTeacherKey(input?.teacherKey);
  const teacherLabel = sanitizeTeacherLabel(input?.teacherLabel);
  const reference = buildTeacherReference(teacherKey);

  if (!teacherKey) throw new Error("teacherKey is required");

  const current = await getTeacherPlan(teacherKey, env);
  if (current?.paid) {
    return {
      ok: true,
      teacherKey,
      teacherLabel,
      reference: current.reference || reference,
      amount: 1.99,
      checkoutUrl: current.checkoutUrl || "",
      checkoutId: current.checkoutId || "",
      alreadyActive: true,
      note: "Este docente ya tiene una suscripcion activa."
    };
  }

  if (
    (current?.provider === "payphone" || !current?.provider) &&
    current?.status === "pending" &&
    isPendingPlanFresh(current, env) &&
    current?.checkoutUrl
  ) {
    return {
      ok: true,
      teacherKey,
      teacherLabel,
      reference: current.reference || reference,
      amount: 1.99,
      checkoutUrl: current.checkoutUrl,
      checkoutId: current.checkoutId || "",
      reusedPending: true,
      note: "Se reutiliza un checkout pendiente reciente para evitar cobros duplicados."
    };
  }

  const paymentSession = await createRemotePayPhonePayment({ teacherKey, teacherLabel, reference }, env);
  const checkoutUrl = paymentSession.checkoutUrl || String(env.PAYPHONE_CHECKOUT_URL || "").trim();

  if (!checkoutUrl) {
    throw new Error("PayPhone checkout URL is not configured. Set API credentials or PAYPHONE_CHECKOUT_URL.");
  }

  await saveTeacherPlan(
    teacherKey,
    {
      teacherKey,
      teacherLabel,
      provider: "payphone",
      status: "pending",
      paid: false,
      reference,
      checkoutId: paymentSession.checkoutId || "",
      checkoutUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    env
  );

  return {
    ok: true,
    teacherKey,
    teacherLabel,
    reference,
    amount: 1.99,
    checkoutUrl,
    checkoutId: paymentSession.checkoutId || "",
    note:
      "Si usas la API oficial de PayPhone, envia este reference o metadata.teacherKey en el checkout para que el webhook active automaticamente al docente correcto."
  };
}

function privacyPolicyPage() {
  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Politica de Privacidad - Importador de Notas Mineduc</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; background: #f7f9fc; color: #1f2937; }
    main { max-width: 860px; margin: 0 auto; padding: 28px 18px 40px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    h2 { margin-top: 28px; font-size: 20px; }
    p, li { line-height: 1.55; }
    .muted { color: #6b7280; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; }
  </style>
</head>
<body>
  <main>
    <h1>Politica de Privacidad</h1>
    <p class="muted">Importador de Notas Mineduc - Ultima actualizacion: 11 de marzo de 2026</p>

    <div class="card">
      <p>
        Esta extension permite importar notas academicas dentro de la plataforma oficial del Ministerio de Educacion del Ecuador.
        Nos comprometemos a proteger la privacidad del usuario y a usar los datos solo para la funcionalidad principal del producto.
      </p>
    </div>

    <h2>1. Datos que se procesan</h2>
    <ul>
      <li>Datos del archivo cargado por el usuario (por ejemplo: cedula, nombre y nota).</li>
      <li>Identificador del docente detectado en la plataforma academica.</li>
      <li>Estado de suscripcion y uso (contador de ejecuciones y estado de pago).</li>
    </ul>

    <h2>2. Finalidad del uso</h2>
    <ul>
      <li>Ejecutar la carga masiva de notas solicitada por el usuario.</li>
      <li>Validar limites de uso y estado de suscripcion por docente.</li>
      <li>Verificar pagos para activar suscripcion premium.</li>
    </ul>

    <h2>3. Almacenamiento y terceros</h2>
    <ul>
      <li>La extension usa almacenamiento local de Chrome (chrome.storage) para configuracion y estado operativo.</li>
      <li>Para verificar suscripciones se utiliza un backend en Cloudflare Workers/KV.</li>
      <li>Para cobros se usan proveedores de pago externos (PayPhone y/o PayPal), segun seleccion del usuario.</li>
      <li>No vendemos datos personales ni los compartimos con terceros para publicidad.</li>
    </ul>

    <h2>4. Seguridad</h2>
    <p>
      Aplicamos medidas razonables para proteger la informacion y limitar su uso a la operacion de la extension.
    </p>

    <h2>5. Derechos y contacto</h2>
    <p>
      Si necesitas solicitar cambios, aclaraciones o eliminacion de informacion relacionada con el servicio,
      puedes contactar al responsable en: <strong>fabiancacuango1@gmail.com</strong>.
    </p>
  </main>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8"
    }
  });
}

async function createPayPalCheckoutSession(input, env) {
  const teacherKey = sanitizeTeacherKey(input?.teacherKey);
  const teacherLabel = sanitizeTeacherLabel(input?.teacherLabel);
  const reference = buildTeacherReference(teacherKey);

  if (!teacherKey) throw new Error("teacherKey is required");

  const current = await getTeacherPlan(teacherKey, env);
  if (current?.paid) {
    return {
      ok: true,
      teacherKey,
      teacherLabel,
      reference: current.reference || reference,
      amount: 1.99,
      checkoutUrl: current.checkoutUrl || "",
      checkoutId: current.checkoutId || "",
      provider: "paypal",
      alreadyActive: true,
      note: "Este docente ya tiene una suscripcion activa."
    };
  }

  if (
    current?.provider === "paypal" &&
    current?.status === "pending" &&
    isPendingPlanFresh(current, env) &&
    current?.checkoutUrl
  ) {
    return {
      ok: true,
      teacherKey,
      teacherLabel,
      reference: current.reference || reference,
      amount: 1.99,
      checkoutUrl: current.checkoutUrl,
      checkoutId: current.checkoutId || "",
      provider: "paypal",
      reusedPending: true,
      note: "Se reutiliza un checkout pendiente reciente para evitar cobros duplicados."
    };
  }

  const paymentSession = await createRemotePayPalPayment({ teacherKey, teacherLabel, reference }, env);
  if (!paymentSession.checkoutUrl) {
    throw new Error("PayPal checkout URL is not available. Configure PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.");
  }

  await saveTeacherPlan(
    teacherKey,
    {
      teacherKey,
      teacherLabel,
      provider: "paypal",
      status: "pending",
      paid: false,
      reference,
      checkoutId: paymentSession.checkoutId || "",
      paypalApiBaseUrl: paymentSession.apiBaseUrl || "",
      checkoutUrl: paymentSession.checkoutUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    env
  );

  return {
    ok: true,
    teacherKey,
    teacherLabel,
    reference,
    amount: 1.99,
    checkoutUrl: paymentSession.checkoutUrl,
    checkoutId: paymentSession.checkoutId || "",
    provider: "paypal",
    note: "Completa el pago en PayPal. La extension verificara y activara automaticamente la suscripcion."
  };
}

async function createRemotePayPhonePayment(input, env) {
  const apiUrl = String(env.PAYPHONE_API_URL || "").trim();
  const token = String(env.PAYPHONE_API_TOKEN || "").trim();
  const storeId = String(env.PAYPHONE_STORE_ID || "").trim();
  const responseUrl = String(env.PAYPHONE_RESPONSE_URL || "").trim();
  const currency = String(env.PAYPHONE_CURRENCY || "USD").trim();
  const amountCents = Number(env.PAYPHONE_AMOUNT_CENTS || 199);

  if (!apiUrl || !token || !storeId) {
    return { checkoutUrl: String(env.PAYPHONE_CHECKOUT_URL || "").trim(), checkoutId: "" };
  }

  const payload = {
    amount: amountCents,
    amountWithTax: amountCents,
    tax: 0,
    currency,
    storeId,
    clientTransactionId: input.reference,
    reference: input.reference,
    responseUrl,
    metadata: {
      teacherKey: input.teacherKey,
      teacherLabel: input.teacherLabel
    }
  };

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`PayPhone API error ${response.status}: ${message}`);
  }

  const data = await response.json();
  return {
    checkoutId: String(
      data?.id || data?.checkoutId || data?.transactionId || data?.data?.id || data?.data?.transactionId || ""
    ).trim(),
    checkoutUrl: resolvePayPhoneCheckoutUrl(data, env)
  };
}

async function createRemotePayPalPayment(input, env) {
  const context = await getPayPalApiContext(env);
  const baseUrl = context.baseUrl;
  const amount = Number(env.PAYPAL_AMOUNT_USD || 1.99).toFixed(2);
  const token = context.token;

  const payload = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: input.reference,
        description: `Suscripcion Importador Mineduc - ${input.teacherLabel || input.teacherKey}`,
        amount: {
          currency_code: "USD",
          value: amount
        }
      }
    ],
    application_context: {
      brand_name: "Importador Mineduc",
      user_action: "PAY_NOW"
    }
  };

  const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "PayPal-Request-Id": `${input.reference}-${Date.now()}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`PayPal API error ${response.status}: ${message}`);
  }

  const data = await response.json();
  return {
    apiBaseUrl: baseUrl,
    checkoutId: String(data?.id || "").trim(),
    checkoutUrl: resolvePayPalApprovalUrl(data)
  };
}

async function getPayPalAccessToken(env, baseUrl) {
  const clientId = String(env.PAYPAL_CLIENT_ID || "").trim();
  const clientSecret = String(env.PAYPAL_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) {
    throw new Error("Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET.");
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`
    },
    body: "grant_type=client_credentials"
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`PayPal OAuth error ${response.status}: ${message}`);
  }

  const data = await response.json();
  const token = String(data?.access_token || "").trim();
  if (!token) throw new Error("PayPal OAuth did not return access token.");
  return token;
}

async function getPayPalApiContext(env) {
  const candidates = getPayPalBaseCandidates(env);
  let lastError = null;

  for (const baseUrl of candidates) {
    try {
      const token = await getPayPalAccessToken(env, baseUrl);
      return { baseUrl, token };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("No fue posible autenticar con PayPal.");
}

function getPayPalBaseCandidates(env) {
  const primary = String(env.PAYPAL_API_BASE_URL || "https://api-m.paypal.com").trim().replace(/\/$/, "");
  const sandbox = "https://api-m.sandbox.paypal.com";
  const out = [primary || "https://api-m.paypal.com"];
  const enableFallback = String(env.PAYPAL_ENABLE_SANDBOX_FALLBACK || "false").toLowerCase() === "true";

  if (enableFallback && !out.includes(sandbox)) {
    out.push(sandbox);
  }

  return out;
}

async function getPayPalHealth(env) {
  try {
    const context = await getPayPalApiContext(env);
    return {
      ok: true,
      provider: "paypal",
      authenticated: true,
      apiBaseUrl: context.baseUrl,
      fallbackSandboxEnabled: String(env.PAYPAL_ENABLE_SANDBOX_FALLBACK || "false").toLowerCase() === "true"
    };
  } catch (error) {
    return {
      ok: false,
      provider: "paypal",
      authenticated: false,
      error: String(error?.message || error),
      fallbackSandboxEnabled: String(env.PAYPAL_ENABLE_SANDBOX_FALLBACK || "false").toLowerCase() === "true"
    };
  }
}

async function getPaymentCapabilities(env) {
  const payphoneConfigured =
    Boolean(String(env.PAYPHONE_CHECKOUT_URL || "").trim()) ||
    (Boolean(String(env.PAYPHONE_API_URL || "").trim()) &&
      Boolean(String(env.PAYPHONE_API_TOKEN || "").trim()) &&
      Boolean(String(env.PAYPHONE_STORE_ID || "").trim()));

  const payphone = {
    ready: payphoneConfigured,
    error: payphoneConfigured ? "" : "Falta configurar PAYPHONE_CHECKOUT_URL o credenciales API de PayPhone."
  };

  const paypalHealth = await getPayPalHealth(env);
  const paypal = {
    ready: Boolean(paypalHealth?.ok),
    error: paypalHealth?.ok ? "" : String(paypalHealth?.error || "PayPal no disponible")
  };

  return {
    ok: payphone.ready || paypal.ready,
    payphone,
    paypal
  };
}

async function fetchPayPalOrderStatus(orderId, env, preferredBaseUrl) {
  const cleanOrderId = String(orderId || "").trim();
  if (!cleanOrderId) return { paid: false, status: "none", paymentId: "" };

  const baseUrl = String(preferredBaseUrl || "").trim().replace(/\/$/, "");
  const context = baseUrl
    ? { baseUrl, token: await getPayPalAccessToken(env, baseUrl) }
    : await getPayPalApiContext(env);

  const resolvedBaseUrl = context.baseUrl;
  const token = context.token;
  const orderUrl = `${resolvedBaseUrl}/v2/checkout/orders/${encodeURIComponent(cleanOrderId)}`;
  const response = await fetch(orderUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`PayPal order lookup error ${response.status}: ${message}`);
  }

  const data = await response.json();
  let status = String(data?.status || "").toUpperCase();

  // For PayPal Orders API, payer approval often leaves the order in APPROVED.
  // We capture it server-side so the subscription can activate automatically.
  if (status === "APPROVED") {
    const captureResponse = await fetch(`${orderUrl}/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "PayPal-Request-Id": `CAP-${cleanOrderId}-${Date.now()}`
      }
    });

    if (captureResponse.ok) {
      const captureData = await captureResponse.json();
      status = String(captureData?.status || "").toUpperCase();
      return {
        paid: status === "COMPLETED",
        status,
        paymentId: String(captureData?.id || cleanOrderId).trim()
      };
    }

    const captureMessage = await captureResponse.text();
    throw new Error(`PayPal capture error ${captureResponse.status}: ${captureMessage}`);
  }

  const paid = status === "COMPLETED";
  return {
    paid,
    status,
    paymentId: String(data?.id || cleanOrderId).trim()
  };
}

async function resolvePayPalPendingPlan(plan, teacherKey, env) {
  if (!plan || plan.provider !== "paypal" || plan.status !== "pending") return plan;
  if (!plan.checkoutId) return plan;

  if (!isPendingPlanFresh(plan, env)) return plan;

  const order = await fetchPayPalOrderStatus(plan.checkoutId, env, plan.paypalApiBaseUrl);
  if (!order.paid) return plan;

  const updated = {
    ...plan,
    provider: "paypal",
    status: "active",
    paid: true,
    paymentId: order.paymentId,
    licenseCode: createLicenseCode(teacherKey, order.paymentId),
    updatedAt: new Date().toISOString()
  };
  await saveTeacherPlan(teacherKey, updated, env);
  return updated;
}

function resolvePayPalApprovalUrl(data) {
  const links = Array.isArray(data?.links) ? data.links : [];
  const approve = links.find((item) => String(item?.rel || "").toLowerCase() === "approve");
  return String(approve?.href || "").trim();
}

async function processPayPhoneWebhook(body, env) {
  const eventType = String(body?.event || body?.event_type || body?.type || "").toUpperCase();
  const payload = body?.data || body?.transaction || body?.payload || body || {};
  const rawState = String(
    payload?.status || payload?.transactionStatus || payload?.state || payload?.paymentStatus || ""
  ).toUpperCase();

  const isCompleted =
    /PAID|APPROVED|SUCCESS|COMPLETED/.test(rawState) || /PAID|APPROVED|SUCCESS|COMPLETED/.test(eventType);
  if (!isCompleted) return true;

  const teacherKey = sanitizeTeacherKey(
    payload?.reference ||
      payload?.clientTransactionId ||
      payload?.metadata?.teacherKey ||
      payload?.custom_fields?.teacherKey ||
      payload?.customParameters?.teacherKey ||
      body?.teacherKey ||
      ""
  );

  if (!teacherKey) return false;

  const teacherLabel = sanitizeTeacherLabel(
    payload?.metadata?.teacherLabel || payload?.custom_fields?.teacherLabel || body?.teacherLabel || ""
  );
  const paymentId = String(
    payload?.id || payload?.transactionId || payload?.payphoneTransactionId || body?.id || ""
  ).trim();

  await saveTeacherPlan(
    teacherKey,
    {
      teacherKey,
      teacherLabel,
      provider: "payphone",
      paymentId,
      status: "active",
      paid: true,
      licenseCode: createLicenseCode(teacherKey, paymentId),
      updatedAt: new Date().toISOString()
    },
    env
  );

  return true;
}

async function getTeacherPlan(teacherKey, env) {
  if (!teacherKey) return null;
  if (env.LICENSES_KV) {
    const value = await env.LICENSES_KV.get(`teacher:${teacherKey}`, "json");
    if (!value) return null;

    if (value.status === "pending" && !isPendingPlanFresh(value, env)) {
      const expired = {
        ...value,
        status: "expired",
        paid: false,
        updatedAt: new Date().toISOString()
      };
      await env.LICENSES_KV.put(`teacher:${teacherKey}`, JSON.stringify(expired));
      return expired;
    }

    return value;
  }

  return null;
}

async function saveTeacherPlan(teacherKey, patch, env) {
  if (!teacherKey) return;
  if (env.LICENSES_KV) {
    const current = (await getTeacherPlan(teacherKey, env)) || {};
    await env.LICENSES_KV.put(
      `teacher:${teacherKey}`,
      JSON.stringify({
        ...current,
        ...patch,
        teacherKey
      })
    );
  }
}

function verifyWebhookSecret(request, env) {
  const expected = String(env.PAYPHONE_WEBHOOK_SECRET || "").trim();
  if (!expected) return true;

  const candidates = [
    request.headers.get("x-payphone-secret"),
    request.headers.get("x-webhook-secret"),
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  ].map((value) => String(value || "").trim());

  return candidates.includes(expected);
}

function isPendingPlanFresh(plan, env) {
  const ttlMinutes = Number(env.PENDING_PAYMENT_TTL_MINUTES || 30);
  const baseDate = plan?.createdAt || plan?.updatedAt;
  if (!baseDate) return false;
  const createdAt = new Date(baseDate).getTime();
  if (Number.isNaN(createdAt)) return false;
  return Date.now() - createdAt <= ttlMinutes * 60 * 1000;
}

function sanitizeTeacherKey(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeTeacherLabel(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function createLicenseCode(teacherKey, paymentId) {
  const teacherPart = teacherKey.replace(/\s+/g, "-").slice(0, 18) || "DOCENTE";
  const paymentPart = String(paymentId || Date.now()).replace(/[^A-Z0-9]/gi, "").slice(-10).toUpperCase();
  return `PAY-${teacherPart}-${paymentPart}`;
}

function resolvePayPhoneCheckoutUrl(data, env) {
  const direct = [
    data?.checkoutUrl,
    data?.paymentUrl,
    data?.payWithCard,
    data?.payWithPhone,
    data?.link,
    data?.url,
    data?.data?.checkoutUrl,
    data?.data?.paymentUrl,
    data?.data?.payWithCard,
    data?.data?.payWithPhone,
    data?.data?.link,
    data?.data?.url
  ].find((value) => String(value || "").trim());

  if (direct) return String(direct).trim();

  const token = String(data?.token || data?.data?.token || "").trim();
  const base = String(env.PAYPHONE_PAYMENT_BASE_URL || "https://pay.payphonetodoesposible.com").trim();
  if (token) {
    return `${base.replace(/\/$/, "")}/${token}`;
  }

  return String(env.PAYPHONE_CHECKOUT_URL || "").trim();
}

function buildTeacherReference(teacherKey) {
  const normalized = teacherKey.replace(/\s+/g, "-").slice(0, 24) || "DOCENTE";
  return `DOC-${normalized}`;
}

// ═══════════════════════════════════════════════════════════
//  LICENSE ACTIVATION & VALIDATION
// ═══════════════════════════════════════════════════════════

function sanitizeLicenseKey(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9\-]/g, "").slice(0, 64);
}

function sanitizeFingerprint(value) {
  return String(value || "").trim().replace(/[^a-fA-F0-9]/g, "").slice(0, 128);
}

async function activateLicense(input, env) {
  const { licenseKey, teacherId, fingerprint } = input;

  // Check if this license code was pre-generated (exists in pool)
  const poolData = await env.LICENSES_KV.get(`license-pool:${licenseKey}`, { type: "json" });

  // Look up existing license binding
  const licenseData = await env.LICENSES_KV.get(`license:${licenseKey}`, { type: "json" });

  if (licenseData && licenseData.activated) {
    // License already used
    if (licenseData.teacherId === teacherId) {
      // Same teacher re-activating — allow
      return { success: true, message: "Licencia ya activa para este docente.", alreadyActive: true };
    }
    return { success: false, error: "LICENCIA YA UTILIZADA. Esta licencia fue activada por otro docente." };
  }

  // If pool exists, code must be in it.
  if (!poolData) {
    return { success: false, error: "Código de licencia no válido." };
  }

  // Activate the license: one-time binding
  const activation = {
    licenseKey,
    teacherId,
    browserFingerprint: fingerprint || "",
    activated: true,
    activatedAt: new Date().toISOString()
  };

  await env.LICENSES_KV.put(`license:${licenseKey}`, JSON.stringify(activation));

  // Mark code as used in pool
  if (poolData) {
    poolData.used = true;
    poolData.usedBy = teacherId;
    poolData.usedAt = new Date().toISOString();
    await env.LICENSES_KV.put(`license-pool:${licenseKey}`, JSON.stringify(poolData));
  }

  // Also update teacher plan to premium
  const currentPlan = await getTeacherPlan(teacherId, env);
  const updatedPlan = {
    ...(currentPlan || {}),
    teacherKey: teacherId,
    paid: true,
    status: "active",
    provider: "license",
    licenseCode: licenseKey,
    browserFingerprint: fingerprint || "",
    updatedAt: new Date().toISOString()
  };
  await saveTeacherPlan(teacherId, updatedPlan, env);

  return { success: true, message: "Licencia activada correctamente." };
}

async function validateLicense(input, env) {
  const { licenseKey, teacherId, fingerprint } = input;

  const licenseData = await env.LICENSES_KV.get(`license:${licenseKey}`, { type: "json" });

  if (!licenseData || !licenseData.activated) {
    return { valid: false, error: "Licencia no encontrada o no activada." };
  }

  if (teacherId && licenseData.teacherId !== teacherId) {
    return { valid: false, error: "Esta licencia pertenece a otro docente." };
  }

  if (fingerprint && licenseData.browserFingerprint && licenseData.browserFingerprint !== fingerprint) {
    return { valid: false, error: "Navegador no autorizado para esta licencia." };
  }

  return { valid: true, teacherId: licenseData.teacherId, activatedAt: licenseData.activatedAt };
}

function json(payload, env, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(env)
    }
  });
}

function corsHeaders(env) {
  const origin = env.ALLOWED_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-payphone-secret, x-webhook-secret",
    "Access-Control-Max-Age": "86400"
  };
}
