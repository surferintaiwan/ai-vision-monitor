import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, AppState } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
  PhotoFile,
} from 'react-native-vision-camera';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDeviceStore } from '@/stores/deviceStore';
import { useAuthStore } from '@/stores/authStore';
import { useDetectionStore } from '@/stores/detectionStore';
import { updateDeviceStatus } from '@/services/firebase/devices';
import { createEvent } from '@/services/firebase/events';
import { signOut } from '@/services/firebase/auth';
import { shouldProcessFrame, resetMotionDetector } from '@/services/detection/motionDetector';
import { detectPersonInImage } from '@/services/detection/personDetector';
import { EventManager, ManagedEvent } from '@/services/detection/eventManager';
import { startRecording } from '@/services/recording/clipRecorder';

const eventManager = new EventManager();

export function CameraPreviewScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const device = useCameraDevice('back');
  const cameraRef = useRef<Camera>(null);
  const { hasPermission: hasCamPerm, requestPermission: requestCamPerm } =
    useCameraPermission();
  const { hasPermission: hasMicPerm, requestPermission: requestMicPerm } =
    useMicrophonePermission();

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

  const detectionLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runDetectionCycle = useCallback(async () => {
    if (!cameraRef.current || !isActive || !isDetecting) return;

    try {
      const photo: PhotoFile = await cameraRef.current.takePhoto();

      const result = await detectPersonInImage(
        photo.path,
        useDetectionStore.getState().mode === 'security' ? 0.5 : 0.4,
      );

      if (result) {
        setLastDetection(result);
        incrementCount();
        eventManager.handleDetection(result, useDetectionStore.getState().mode);
      }
    } catch {
      // Photo or detection failed — skip this cycle
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

      const clipPath =
        event.alertLevel !== 'ignore'
          ? await startRecording(cameraRef, event.timestamp, 10)
          : null;

      await createEvent({
        deviceId,
        userId,
        type: event.type,
        soundClass: event.soundClass,
        confidence: event.confidence,
        clipPath,
        clipDurationSec: clipPath ? 10 : 0,
      }).catch((err) => console.warn('Failed to log event:', err));
    };

    eventManager.onEvent(handler);
    return () => eventManager.removeHandler(handler);
  }, [deviceId, userId]);

  // Request permissions on mount
  useEffect(() => {
    if (!hasCamPerm) requestCamPerm();
    if (!hasMicPerm) requestMicPerm();
  }, [hasCamPerm, hasMicPerm, requestCamPerm, requestMicPerm]);

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

  if (!hasCamPerm || !hasMicPerm) {
    return (
      <View style={styles.container}>
        <Text style={styles.permText}>
          Camera and microphone permissions are required.
        </Text>
        <TouchableOpacity
          style={styles.permButton}
          onPress={() => {
            if (!hasCamPerm) requestCamPerm();
            if (!hasMicPerm) requestMicPerm();
          }}
        >
          <Text style={styles.permButtonText}>Grant Permissions</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.permText}>No camera device found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        audio={true}
        photo={true}
        video={true}
      />

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
  permText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 32,
  },
  permButton: {
    backgroundColor: '#4A90D9',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
