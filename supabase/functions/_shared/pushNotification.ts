/**
 * Utilitário compartilhado para envio de notificações push via FCM v1 API.
 * Requer a variável de ambiente FIREBASE_SERVICE_ACCOUNT_JSON com o JSON
 * da service account do Firebase.
 */

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

// ── Cache de access token (evita chamada ao Google a cada notificação) ────
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

// ── Gera access token OAuth2 a partir da service account ──────────────────
async function getAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const cached = tokenCache.get(clientEmail);
  if (cached && now < cached.expiresAt - 60) {
    return cached.token;
  }


  function base64url(input: ArrayBuffer | string): string {
    const str =
      typeof input === 'string'
        ? input
        : String.fromCharCode(...new Uint8Array(input as ArrayBuffer));
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const headerB64 = base64url(JSON.stringify(header));
  const claimB64  = base64url(JSON.stringify(claim));
  const unsigned  = `${headerB64}.${claimB64}`;

  const pem = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----\n?/, '')
    .replace(/\n?-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');

  const keyBytes = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sigBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsigned)
  );

  const jwt = `${unsigned}.${base64url(sigBuffer)}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`Falha ao obter access token: ${JSON.stringify(tokenData)}`);
  }

  tokenCache.set(clientEmail, {
    token: tokenData.access_token,
    expiresAt: now + (tokenData.expires_in ?? 3600),
  });

  return tokenData.access_token;
}

// ── Envia uma notificação para um FCM token específico ────────────────────
export async function sendFCMNotification(
  fcmToken: string,
  payload: PushPayload
): Promise<void> {
  const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');
  if (!serviceAccountJson) {
    console.warn('[push] FIREBASE_SERVICE_ACCOUNT_JSON não configurado — pulando notificação.');
    return;
  }

  const sa = JSON.parse(serviceAccountJson);
  const accessToken = await getAccessToken(sa.client_email, sa.private_key);

  const message: Record<string, unknown> = {
    token: fcmToken,
    notification: { title: payload.title, body: payload.body },
    android: {
      priority: 'high',
      notification: { sound: 'default', channel_id: 'deliveries' },
    },
    apns: {
      payload: { aps: { sound: 'default', badge: 1 } },
    },
  };

  if (payload.data) {
    message.data = payload.data;
  }

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error('[push] Erro FCM:', err);
  }
}

// ── Envia para um usuário pelo ID (busca o push_token no banco) ───────────
export async function sendPushToUser(
  supabase: any,
  userId: string,
  payload: PushPayload
): Promise<void> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', userId)
      .maybeSingle();

    if (!data?.push_token) return;
    await sendFCMNotification(data.push_token, payload);
  } catch (e) {
    console.warn('[push] Falha ao notificar usuário:', userId, e);
  }
}

// ── Envia para todos os entregadores aprovados (online ou offline) ────────
// Entregadores offline recebem a notificação para que possam vir trabalhar.
export async function sendPushToAllDrivers(
  supabase: any,
  payload: PushPayload
): Promise<void> {
  try {
    const { data: drivers } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('role', 'DRIVER')
      .eq('status', 'APPROVED')
      .not('push_token', 'is', null);

    if (!drivers?.length) return;

    await Promise.allSettled(
      drivers.map((d: { push_token: string }) =>
        sendFCMNotification(d.push_token, payload)
      )
    );
  } catch (e) {
    console.warn('[push] Falha ao notificar entregadores:', e);
  }
}
