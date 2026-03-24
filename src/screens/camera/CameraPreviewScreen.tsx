import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, AppState } from 'react-native';
import { RTCView, MediaStream } from 'react-native-webrtc';
import { captureScreen } from 'react-native-view-shot';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDeviceStore } from '@/stores/deviceStore';
import { useAuthStore } from '@/stores/authStore';
import { useDetectionStore } from '@/stores/detectionStore';
import { updateDeviceStatus } from '@/services/firebase/devices';
import { createEvent } from '@/services/firebase/events';
import { signOut } from '@/services/firebase/auth';
import { resetMotionDetector } from '@/services/detection/motionDetector';
import { detectPersonInImage } from '@/services/detection/personDetector';
import { EventManager, ManagedEvent } from '@/services/detection/eventManager';
import { useStreamStore } from '@/stores/streamStore';
import {
  createPeerConnection,
  createOffer,
  getLocalStream,
  handleAnswer,
  addIceCandidate,
  closePeerConnection,
} from '@/services/webrtc/peerConnection';
import {
  createSession,
  setOffer,
  addCandidate,
  onAnswer,
  onCandidates,
  closeSession,
} from '@/services/webrtc/signalingService';

const eventManager = new EventManager();

export function CameraPreviewScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(true);
  const deviceId = useDeviceStore((s) => s.deviceId);
  const clearUser = useAuthStore((s) => s.clearUser);
  const clearDevice = useDeviceStore((s) => s.clearDevice);
  const userId = useAuthStore((s) => s.user?.uid);

  const isDetecting = useDetectionStore((s) => s.isDetecting);
  const mode = useDetectionStore((s) => s.mode);
  const lastDetection = useDetectionStore((s) => s.lastDetection);
  const detectionCount = useDetectionStore((s) => s.detectionCount);
  const setDetecting = useDetectionStore((s) => s.setDetecting);
  const setLastDetection = useDetectionStore((s) => s.setLastDetection);
  const incrementCount = useDetectionStore((s) => s.incrementCount);

  const connectionStatus = useStreamStore((s) => s.connectionStatus);
  const setConnectionStatus = useStreamStore((s) => s.setConnectionStatus);
  const setSessionId = useStreamStore((s) => s.setSessionId);
  const resetStream = useStreamStore((s) => s.reset);

  const detectionLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runDetectionCycle = useCallback(async () => {
    if (!isActive || !isDetecting) return;

    try {
      // Capture the entire screen as JPEG (captureScreen works with SurfaceView)
      const uri = await captureScreen({ format: 'jpg', quality: 0.6 });
      if (!uri) return;

      const result = await detectPersonInImage(
        uri,
        useDetectionStore.getState().mode === 'security' ? 0.5 : 0.4,
      );

      if (result) {
        setLastDetection(result);
        incrementCount();
        eventManager.handleDetection(result, useDetectionStore.getState().mode);
      }
    } catch (err) {
      console.warn('[Detection] Capture/detection failed:', err);
    }
  }, [isActive, isDetecting, setLastDetection, incrementCount]);

  // Start/stop detection loop
  useEffect(() => {
    if (isDetecting && isActive) {
      detectionLoopRef.current = setInterval(runDetectionCycle, 2000);
      resetMotionDetector();
    }
    return () => {
      if (detectionLoopRef.current) {
        clearInterval(detectionLoopRef.current);
        detectionLoopRef.current = null;
      }
    };
  }, [isDetecting, isActive, runDetectionCycle]);

  // Handle events from event manager
  useEffect(() => {
    const handler = async (event: ManagedEvent) => {
      if (!deviceId || !userId) return;

      // Clip recording is not available with WebRTC camera (no VisionCamera)
      await createEvent({
        deviceId,
        userId,
        type: event.type,
        soundClass: event.soundClass,
        confidence: event.confidence,
        clipPath: null,
        clipDurationSec: 0,
      }).catch((err) => console.warn('Failed to log event:', err));
    };

    eventManager.onEvent(handler);
    return () => eventManager.removeHandler(handler);
  }, [deviceId, userId]);

  // Update device status on mount/unmount
  useEffect(() => {
    if (deviceId) updateDeviceStatus(deviceId, 'online');
    return () => {
      if (deviceId) updateDeviceStatus(deviceId, 'offline');
    };
  }, [deviceId]);

  // Pause camera when app goes to background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setIsActive(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  // Set up WebRTC: grab camera + streaming session
  useEffect(() => {
    if (!deviceId) return;

    let unsubAnswer: (() => void) | null = null;
    let unsubCandidates: (() => void) | null = null;
    let currentSessionId: string | null = null;

    async function setupStreaming() {
      try {
        setConnectionStatus('connecting');

        // Create signaling session
        currentSessionId = await createSession(deviceId!);
        setSessionId(currentSessionId);

        // Create peer connection
        createPeerConnection({
          onIceCandidate: (candidate) => {
            if (currentSessionId) {
              addCandidate(currentSessionId, candidate, 'camera').catch(() => {});
            }
          },
          onConnectionStateChange: (state) => {
            if (state === 'connected') setConnectionStatus('connected');
            else if (state === 'disconnected') setConnectionStatus('disconnected');
            else if (state === 'failed') setConnectionStatus('failed');
          },
        });

        // Create offer (grabs camera via getUserMedia + adds tracks)
        const offer = await createOffer();
        await setOffer(currentSessionId, offer.sdp!);

        // Save local stream for RTCView preview
        const stream = await getLocalStream();
        setLocalStream(stream);

        setConnectionStatus('idle');

        // Listen for viewer answer
        unsubAnswer = onAnswer(currentSessionId, async (answerSdp) => {
          try {
            await handleAnswer(answerSdp);
            setConnectionStatus('connected');
          } catch (err) {
            console.warn('Failed to handle answer:', err);
          }
        });

        // Listen for viewer ICE candidates
        unsubCandidates = onCandidates(currentSessionId, 'viewer', async (candidate) => {
          try {
            await addIceCandidate(candidate);
          } catch (err) {
            console.warn('Failed to add ICE candidate:', err);
          }
        });
      } catch (err) {
        console.warn('Streaming setup failed:', err);
        setConnectionStatus('failed');
      }
    }

    setupStreaming();

    return () => {
      unsubAnswer?.();
      unsubCandidates?.();
      if (currentSessionId) closeSession(currentSessionId).catch(() => {});
      closePeerConnection();
      resetStream();
      setLocalStream(null);
    };
  }, [deviceId, setConnectionStatus, setSessionId, resetStream]);

  async function handleSignOut() {
    setDetecting(false);
    if (deviceId) await updateDeviceStatus(deviceId, 'offline');
    clearDevice();
    await signOut();
    clearUser();
  }

  function toggleDetection() {
    setDetecting(!isDetecting);
  }

  const streamUrl = (localStream as any)?.toURL?.();

  return (
    <View style={styles.container}>
      {/* Camera preview via WebRTC local stream */}
      {streamUrl ? (
        <RTCView
          streamURL={streamUrl}
          style={StyleSheet.absoluteFill}
          objectFit="cover"
          mirror={false}
          zOrder={0}
        />
      ) : (
        <View style={styles.loadingCamera}>
          <Text style={styles.loadingText}>Starting camera...</Text>
        </View>
      )}

      {/* Status overlay */}
      <View style={styles.overlay}>
        <View style={styles.statusBar}>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                isDetecting ? styles.dotDetecting : styles.dotActive,
              ]}
            />
            <Text style={styles.statusText}>
              {isDetecting ? `Detecting (${mode})` : 'Camera Active'}
            </Text>
          </View>
          {isDetecting && (
            <Text style={styles.statusHint}>
              Events: {detectionCount}
              {lastDetection
                ? ` | Last: ${lastDetection.type} (${Math.round(lastDetection.confidence * 100)}%)`
                : ''}
            </Text>
          )}
          {!isDetecting && (
            <Text style={styles.statusHint}>
              Tap Start to begin detection
            </Text>
          )}
          <Text style={styles.statusHint}>
            Stream: {connectionStatus === 'connected' ? 'Viewer connected' : 'Waiting for viewer'}
          </Text>
        </View>
      </View>

      {/* Bottom controls */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            isDetecting ? styles.stopButton : styles.startButton,
          ]}
          onPress={toggleDetection}
        >
          <Text style={styles.actionButtonText}>
            {isDetecting ? 'Stop Detection' : 'Start Detection'}
          </Text>
        </TouchableOpacity>

        <View style={styles.bottomRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('CameraSettings')}
          >
            <Text style={styles.secondaryText}>Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={handleSignOut}>
            <Text style={styles.secondaryText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCamera: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
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
    padding: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  dotActive: {
    backgroundColor: '#4caf50',
  },
  dotDetecting: {
    backgroundColor: '#ff9800',
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusHint: {
    color: '#aaa',
    fontSize: 12,
    marginLeft: 18,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  actionButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#4caf50',
  },
  stopButton: {
    backgroundColor: '#f44336',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  bottomRow: {
    flexDirection: 'row',
    gap: 16,
  },
  secondaryButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  secondaryText: {
    color: '#fff',
    fontSize: 14,
  },
});
