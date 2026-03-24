import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  MediaStream,
  mediaDevices,
} from 'react-native-webrtc';
import { DEFAULT_WEBRTC_CONFIG } from '@/config/webrtc';

const ICE_SERVERS = [
  ...DEFAULT_WEBRTC_CONFIG.stunServers.map((url) => ({ urls: url })),
  ...DEFAULT_WEBRTC_CONFIG.turnServers
    .filter((s) => s.username && s.credential)
    .map((s) => ({ urls: s.urls, username: s.username, credential: s.credential })),
];

export interface PeerCallbacks {
  onIceCandidate: (candidate: any) => void;
  onTrack?: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: string) => void;
}

let peerConnection: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;

export function createPeerConnection(callbacks: PeerCallbacks): RTCPeerConnection {
  closePeerConnection();

  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  // Use type assertion to access event handlers
  const pcAny = pc as any;

  pcAny.onicecandidate = (event: any) => {
    if (event.candidate) {
      callbacks.onIceCandidate(event.candidate);
    }
  };

  pcAny.ontrack = (event: any) => {
    if (event.streams?.[0] && callbacks.onTrack) {
      callbacks.onTrack(event.streams[0]);
    }
  };

  pcAny.onconnectionstatechange = () => {
    callbacks.onConnectionStateChange?.(pc.connectionState);
  };

  peerConnection = pc;
  return pc;
}

export async function getLocalStream(): Promise<MediaStream> {
  if (localStream) return localStream;

  const stream = await mediaDevices.getUserMedia({
    audio: true,
    video: {
      facingMode: 'environment',
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
    },
  });

  localStream = stream as MediaStream;
  return localStream;
}

export async function createOffer(): Promise<RTCSessionDescription> {
  if (!peerConnection) throw new Error('No peer connection');

  // Create offer with audio/video lines but don't grab camera yet.
  // Tracks will be added when a viewer connects (addLocalStream).
  const offer = await peerConnection.createOffer({
    offerToReceiveAudio: true,
    offerToReceiveVideo: true,
  });
  await peerConnection.setLocalDescription(offer);
  return offer as RTCSessionDescription;
}

export async function addLocalStream(): Promise<void> {
  if (!peerConnection) throw new Error('No peer connection');

  const stream = await getLocalStream();
  stream.getTracks().forEach((track: any) => {
    peerConnection!.addTrack(track, stream);
  });
}

export async function handleOffer(
  sdp: string,
): Promise<RTCSessionDescription> {
  if (!peerConnection) throw new Error('No peer connection');

  await peerConnection.setRemoteDescription(
    new RTCSessionDescription({ type: 'offer', sdp }),
  );
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  return answer as RTCSessionDescription;
}

export async function handleAnswer(sdp: string): Promise<void> {
  if (!peerConnection) throw new Error('No peer connection');
  await peerConnection.setRemoteDescription(
    new RTCSessionDescription({ type: 'answer', sdp }),
  );
}

export async function addIceCandidate(candidate: any): Promise<void> {
  if (!peerConnection) return;
  await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
}

export function closePeerConnection(): void {
  if (localStream) {
    localStream.getTracks().forEach((track: any) => track.stop());
    localStream = null;
  }
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
}
