/**
 * Cloudflare Worker that returns short-lived TURN credentials by calling
 * Cloudflare Realtime TURN "generate-ice-servers".
 *
 * Required env:
 * - FIREBASE_PROJECT_ID (plain text var)
 * - CF_TURN_KEY_ID (plain text var)
 * - CF_TURN_API_TOKEN (worker secret)
 * - CF_TURN_TTL_SECONDS (optional, defaults to 600)
 * - ALLOWED_UIDS (optional, comma-separated Firebase UIDs)
 */

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const DEFAULT_JWKS_CACHE_SEC = 3600;
let cachedJwks = new Map();
let cachedJwksExpiresAtMs = 0;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Content-Type': 'application/json',
  };
}

function getBearerToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  return token || null;
}

function parseCsv(value) {
  return String(value ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

function clampTtl(rawValue) {
  const raw = Number(rawValue ?? 600);
  if (!Number.isFinite(raw)) return 600;
  return Math.min(3600, Math.max(60, Math.floor(raw)));
}

function parseCacheMaxAgeSeconds(cacheControl) {
  const match = String(cacheControl ?? '').match(/max-age=(\d+)/i);
  if (!match) return DEFAULT_JWKS_CACHE_SEC;
  const n = Number(match[1]);
  return Number.isFinite(n) ? Math.max(60, n) : DEFAULT_JWKS_CACHE_SEC;
}

function decodeBase64UrlToString(input) {
  const base64 = input
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(input.length / 4) * 4, '=');
  return atob(base64);
}

function decodeJsonSegment(segment) {
  return JSON.parse(decodeBase64UrlToString(segment));
}

function decodeBase64UrlToBytes(input) {
  const binary = decodeBase64UrlToString(input);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

async function getGoogleJwks() {
  if (cachedJwks.size > 0 && Date.now() < cachedJwksExpiresAtMs) {
    return cachedJwks;
  }

  const resp = await fetch(GOOGLE_JWKS_URL);
  if (!resp.ok) {
    throw new Error(`failed-to-fetch-jwks-${resp.status}`);
  }

  const json = await resp.json();
  const keys = Array.isArray(json?.keys) ? json.keys : [];
  const keyMap = new Map();
  for (const key of keys) {
    if (key?.kid) {
      keyMap.set(key.kid, key);
    }
  }
  if (keyMap.size === 0) {
    throw new Error('jwks-empty');
  }

  const cacheSeconds = parseCacheMaxAgeSeconds(resp.headers.get('cache-control'));
  cachedJwks = keyMap;
  cachedJwksExpiresAtMs = Date.now() + cacheSeconds * 1000;
  return cachedJwks;
}

async function getJwkByKid(kid) {
  let jwks = await getGoogleJwks();
  if (!jwks.has(kid)) {
    // Refresh once if key rotated.
    cachedJwksExpiresAtMs = 0;
    jwks = await getGoogleJwks();
  }
  return jwks.get(kid);
}

async function verifyFirebaseIdToken(token, env) {
  const projectId = String(env.FIREBASE_PROJECT_ID ?? '').trim();
  if (!projectId) {
    throw new Error('missing-firebase-project-id');
  }

  const segments = token.split('.');
  if (segments.length !== 3) {
    throw new Error('invalid-jwt-format');
  }

  const [encodedHeader, encodedPayload, encodedSig] = segments;
  const header = decodeJsonSegment(encodedHeader);
  const payload = decodeJsonSegment(encodedPayload);

  if (header?.alg !== 'RS256' || !header?.kid) {
    throw new Error('invalid-jwt-header');
  }

  const jwk = await getJwkByKid(header.kid);
  if (!jwk) {
    throw new Error('unknown-signing-key');
  }

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  const data = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
  const signature = decodeBase64UrlToBytes(encodedSig);
  const isValidSig = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    signature,
    data,
  );
  if (!isValidSig) {
    throw new Error('invalid-signature');
  }

  const now = Math.floor(Date.now() / 1000);
  const expectedIss = `https://securetoken.google.com/${projectId}`;
  if (payload?.iss !== expectedIss) {
    throw new Error('invalid-issuer');
  }
  if (payload?.aud !== projectId) {
    throw new Error('invalid-audience');
  }
  if (typeof payload?.exp !== 'number' || payload.exp <= now) {
    throw new Error('token-expired');
  }
  if (typeof payload?.iat !== 'number' || payload.iat > now + 300) {
    throw new Error('invalid-issued-at');
  }
  if (typeof payload?.sub !== 'string' || payload.sub.length === 0) {
    throw new Error('invalid-subject');
  }

  const uid = typeof payload?.user_id === 'string' ? payload.user_id : payload.sub;
  const allowedUids = parseCsv(env.ALLOWED_UIDS);
  if (allowedUids.length > 0 && !allowedUids.includes(uid)) {
    throw new Error('uid-not-allowed');
  }

  return uid;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response('', {
        status: 204,
        headers: corsHeaders(),
      });
    }

    if (request.method !== 'POST') {
      return Response.json(
        { error: 'method-not-allowed' },
        { status: 405, headers: corsHeaders() },
      );
    }

    const token = getBearerToken(request.headers.get('Authorization'));
    if (!token) {
      return Response.json(
        { error: 'missing-auth-token' },
        { status: 401, headers: corsHeaders() },
      );
    }

    try {
      await verifyFirebaseIdToken(token, env);
    } catch (err) {
      return Response.json(
        { error: 'invalid-auth-token', message: String(err) },
        { status: 401, headers: corsHeaders() },
      );
    }

    const keyId = (env.CF_TURN_KEY_ID ?? '').trim();
    const apiToken = (env.CF_TURN_API_TOKEN ?? '').trim();
    if (!keyId || !apiToken) {
      return Response.json(
        { error: 'turn-not-configured' },
        { status: 500, headers: corsHeaders() },
      );
    }

    const ttlSec = clampTtl(env.CF_TURN_TTL_SECONDS);
    const endpoint = `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`;

    try {
      const cfResp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl: ttlSec }),
      });

      if (!cfResp.ok) {
        const body = await cfResp.text();
        return Response.json(
          {
            error: 'turn-provider-error',
            status: cfResp.status,
            details: body.slice(0, 300),
          },
          { status: 502, headers: corsHeaders() },
        );
      }

      const data = await cfResp.json();
      const iceServers = Array.isArray(data?.iceServers) ? data.iceServers : [];
      if (iceServers.length === 0) {
        return Response.json(
          { error: 'turn-provider-empty-response' },
          { status: 502, headers: corsHeaders() },
        );
      }

      const expiresAt = Math.floor(Date.now() / 1000) + ttlSec;
      return Response.json(
        { iceServers, ttlSec, expiresAt },
        { status: 200, headers: corsHeaders() },
      );
    } catch (err) {
      return Response.json(
        { error: 'turn-provider-request-failed', message: String(err) },
        { status: 502, headers: corsHeaders() },
      );
    }
  },
};
