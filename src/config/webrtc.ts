import {
  TURN_URL,
  TURN_USERNAME,
  TURN_CREDENTIAL,
} from '@env';

export interface WebRTCConfig {
  stunServers: string[];
  turnServers: TurnServer[];
}

export interface TurnServer {
  urls: string;
  username: string;
  credential: string;
}

function getConfiguredTurnServers(): TurnServer[] {
  const urls = TURN_URL?.trim();
  const username = TURN_USERNAME?.trim();
  const credential = TURN_CREDENTIAL?.trim();

  if (!urls || !username || !credential) {
    return [];
  }

  return [{ urls, username, credential }];
}

// Default configuration — users can override via settings
export const DEFAULT_WEBRTC_CONFIG: WebRTCConfig = {
  stunServers: [
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302',
  ],
  turnServers: getConfiguredTurnServers(),
};
