import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import InCallManager from 'react-native-incall-manager';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useStreamStore } from '@/stores/streamStore';
import { useDeviceStore } from '@/stores/deviceStore';
import {
  createPeerConnection,
  handleOffer,
  addIceCandidate,
  closePeerConnection,
} from '@/services/webrtc/peerConnection';
import {
  findActiveSession,
  setAnswer,
  addCandidate,
  onOffer,
  onCandidates,
  closeSession,
} from '@/services/webrtc/signalingService';

type LiveViewParams = {
  LiveView: { cameraDeviceId: string };
};

export function LiveViewScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<LiveViewParams, 'LiveView'>>();
  const { cameraDeviceId } = route.params;

  const deviceId = useDeviceStore((s) => s.deviceId);
  const connectionStatus = useStreamStore((s) => s.connectionStatus);
  const remoteStream = useStreamStore((s) => s.remoteStream);
  const setConnectionStatus = useStreamStore((s) => s.setConnectionStatus);
  const setRemoteStream = useStreamStore((s) => s.setRemoteStream);
  const setSessionId = useStreamStore((s) => s.setSessionId);
  const resetStream = useStreamStore((s) => s.reset);

  // Route audio to loudspeaker instead of earpiece
  useEffect(() => {
    InCallManager.start({ media: 'video' });
    InCallManager.setForceSpeakerphoneOn(true);
    return () => {
      InCallManager.setForceSpeakerphoneOn(false);
      InCallManager.stop();
    };
  }, []);

  useEffect(() => {
    let unsubOffer: (() => void) | null = null;
    let unsubCandidates: (() => void) | null = null;
    let currentSessionId: string | null = null;

    async function connectToCamera() {
      try {
        setConnectionStatus('connecting');

        // Find the camera's active session
        const sessionId = await findActiveSession(cameraDeviceId);
        if (!sessionId) {
          console.warn('No active session found for camera');
          setConnectionStatus('failed');
          return;
        }

        currentSessionId = sessionId;
        setSessionId(sessionId);

        // Create peer connection (viewer side — receives stream)
        createPeerConnection({
          onIceCandidate: (candidate) => {
            if (currentSessionId) {
              addCandidate(currentSessionId, candidate, 'viewer').catch(() => {});
            }
          },
          onTrack: (stream) => {
            setRemoteStream(stream);
          },
          onConnectionStateChange: (state) => {
            if (state === 'connected') setConnectionStatus('connected');
            else if (state === 'disconnected') setConnectionStatus('disconnected');
            else if (state === 'failed') setConnectionStatus('failed');
          },
        });

        // Listen for the camera's offer
        unsubOffer = onOffer(sessionId, async (offerSdp) => {
          try {
            const answer = await handleOffer(offerSdp);
            await setAnswer(sessionId, deviceId ?? 'viewer', answer.sdp!);
          } catch (err) {
            console.warn('Failed to handle offer:', err);
          }
        });

        // Listen for camera ICE candidates
        unsubCandidates = onCandidates(sessionId, 'camera', async (candidate) => {
          try {
            await addIceCandidate(candidate);
          } catch (err) {
            console.warn('Failed to add ICE candidate:', err);
          }
        });
      } catch (err) {
        console.warn('Failed to connect to camera:', err);
        setConnectionStatus('failed');
      }
    }

    connectToCamera();

    return () => {
      unsubOffer?.();
      unsubCandidates?.();
      if (currentSessionId) closeSession(currentSessionId).catch(() => {});
      closePeerConnection();
      resetStream();
    };
  }, [cameraDeviceId, deviceId, setConnectionStatus, setRemoteStream, setSessionId, resetStream]);

  function handleDisconnect() {
    closePeerConnection();
    resetStream();
    navigation.goBack();
  }

  const streamUrl = (remoteStream as any)?.toURL?.();

  return (
    <View style={styles.container}>
      {streamUrl ? (
        <RTCView
          streamURL={streamUrl}
          style={styles.stream}
          objectFit="cover"
        />
      ) : (
        <View style={styles.connecting}>
          <Text style={styles.connectingText}>
            {connectionStatus === 'connecting'
              ? 'Connecting to camera...'
              : connectionStatus === 'failed'
                ? 'Connection failed'
                : 'Waiting for stream...'}
          </Text>
        </View>
      )}

      {/* Status overlay */}
      <View style={styles.overlay}>
        <View style={styles.statusBar}>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                connectionStatus === 'connected' ? styles.dotConnected : styles.dotConnecting,
              ]}
            />
            <Text style={styles.statusText}>
              {connectionStatus === 'connected' ? 'Live' : connectionStatus}
            </Text>
          </View>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.disconnectButton} onPress={handleDisconnect}>
          <Text style={styles.disconnectText}>Disconnect</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  stream: {
    flex: 1,
  },
  connecting: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectingText: {
    color: '#aaa',
    fontSize: 16,
  },
  overlay: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
  },
  statusBar: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    padding: 10,
    alignSelf: 'flex-start',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  dotConnected: {
    backgroundColor: '#f44336',
  },
  dotConnecting: {
    backgroundColor: '#ff9800',
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  disconnectButton: {
    backgroundColor: 'rgba(244, 67, 54, 0.8)',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  disconnectText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
