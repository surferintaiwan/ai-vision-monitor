export interface WebRTCConfig {
  stunServers: string[];
  turnServers: TurnServer[];
}

export interface TurnServer {
  urls: string;
  username: string;
  credential: string;
}

// Default configuration — users can override via settings
export const DEFAULT_WEBRTC_CONFIG: WebRTCConfig = {
  stunServers: [
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302',
  ],
  turnServers: [
    // Cloudflare Calls TURN — replace with your credentials
    // See: https://developers.cloudflare.com/calls/turn/
    {
      urls: 'turn:turn.cloudflare.com:3478',
      username: '',
      credential: '',
    },
  ],
};
