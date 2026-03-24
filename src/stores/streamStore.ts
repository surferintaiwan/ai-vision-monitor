import { create } from 'zustand';
import { MediaStream } from 'react-native-webrtc';

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'failed';

interface StreamState {
  sessionId: string | null;
  connectionStatus: ConnectionStatus;
  remoteStream: MediaStream | null;
  setSessionId: (id: string | null) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  reset: () => void;
}

export const useStreamStore = create<StreamState>((set) => ({
  sessionId: null,
  connectionStatus: 'idle',
  remoteStream: null,
  setSessionId: (sessionId) => set({ sessionId }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setRemoteStream: (remoteStream) => set({ remoteStream }),
  reset: () =>
    set({
      sessionId: null,
      connectionStatus: 'idle',
      remoteStream: null,
    }),
}));
