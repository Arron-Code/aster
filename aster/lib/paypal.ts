const paypalBaseUrl =
  process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com";

async function accessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("PayPal ist nicht konfiguriert.");
  }

  const response = await fetch(`${paypalBaseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) throw new Error("PayPal-Anmeldung fehlgeschlagen.");
  return (await response.json()).access_token as string;
}

export async function paypalRequest<T>(path: string, init: RequestInit) {
  const token = await accessToken();
  const response = await fetch(`${paypalBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "PayPal-Anfrage fehlgeschlagen.");
  return data as T;
}

/**
 * Verifiziert die Signatur eines eingehenden PayPal-Webhook-Events über die
 * offizielle PayPal-API. Verhindert, dass gefälschte Requests Bestellungen als bezahlt markieren.
 */
export async function verifyPaypalWebhookSignature(params: {
  webhookId: string;
  headers: {
    transmissionId: string;
    transmissionTime: string;
    certUrl: string;
    authAlgo: string;
    transmissionSig: string;
  };
  body: unknown;
}) {
  const token = await accessToken();
  const response = await fetch(`${paypalBaseUrl}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transmission_id: params.headers.transmissionId,
      transmission_time: params.headers.transmissionTime,
      cert_url: params.headers.certUrl,
      auth_algo: params.headers.authAlgo,
      transmission_sig: params.headers.transmissionSig,
      webhook_id: params.webhookId,
      webhook_event: params.body,
    }),
  });
  if (!response.ok) return false;
  const data = (await response.json()) as { verification_status?: string };
  return data.verification_status === "SUCCESS";
}
