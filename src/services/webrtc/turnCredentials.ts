import auth from '@react-native-firebase/auth';
import { TURN_CREDENTIALS_ENDPOINT } from '@env';
import { DEFAULT_WEBRTC_CONFIG } from '@/config/webrtc';
import { IceServerConfig } from '@/services/webrtc/peerConnection';

interface TurnCredentialsResponse {
  iceServers?: IceServerConfig[];
  expiresAt?: number;
  ttlSec?: number;
}

let cachedTurnServers: IceServerConfig[] = [];
let cachedTurnExpiresAtMs = 0;

function getStaticIceServers(): IceServerConfig[] {
  return [
    ...DEFAULT_WEBRTC_CONFIG.stunServers.map((url) => ({ urls: url })),
    ...DEFAULT_WEBRTC_CONFIG.turnServers
      .filter((server) => server.username && server.credential)
      .map((server) => ({
        urls: server.urls,
        username: server.username,
        credential: server.credential,
      })),
  ];
}

function normalizeTurnServers(input: unknown): IceServerConfig[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter((server): server is Record<string, unknown> => !!server && typeof server === 'object')
    .map((server) => ({
      urls: server.urls as string | string[],
      username: typeof server.username === 'string' ? server.username : undefined,
      credential: typeof server.credential === 'string' ? server.credential : undefined,
    }))
    .filter((server) => {
      const hasUrls =
        typeof server.urls === 'string'
        || (Array.isArray(server.urls) && server.urls.every((u) => typeof u === 'string'));
      return hasUrls && !!server.username && !!server.credential;
    });
}

async function fetchDynamicTurnServers(): Promise<IceServerConfig[] | null> {
  const endpoint = TURN_CREDENTIALS_ENDPOINT?.trim();
  const user = auth().currentUser;
  if (!endpoint || !user) return null;

  const now = Date.now();
  if (cachedTurnServers.length > 0 && now < cachedTurnExpiresAtMs - 30_000) {
    return cachedTurnServers;
  }

  const idToken = await user.getIdToken();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  if (!response.ok) {
    throw new Error(`TURN credential request failed (${response.status})`);
  }

  const data = (await response.json()) as TurnCredentialsResponse;
  const turnServers = normalizeTurnServers(data.iceServers);
  if (turnServers.length === 0) {
    throw new Error('TURN credential response does not include usable ICE servers');
  }

  const expiresAtSec = typeof data.expiresAt === 'number'
    ? data.expiresAt
    : Math.floor(now / 1000) + (typeof data.ttlSec === 'number' ? data.ttlSec : 600);
  cachedTurnServers = turnServers;
  cachedTurnExpiresAtMs = expiresAtSec > 0 ? expiresAtSec * 1000 : now + 5 * 60 * 1000;

  return turnServers;
}

export async function getSessionIceServers(): Promise<IceServerConfig[]> {
  const staticServers = getStaticIceServers();
  const stunServers = staticServers.filter((server) => !server.username || !server.credential);

  try {
    const dynamicTurnServers = await fetchDynamicTurnServers();
    if (dynamicTurnServers && dynamicTurnServers.length > 0) {
      return [...stunServers, ...dynamicTurnServers];
    }
  } catch (err) {
    console.warn('Failed to fetch TURN credentials, falling back to static ICE servers:', err);
  }

  return staticServers;
}
