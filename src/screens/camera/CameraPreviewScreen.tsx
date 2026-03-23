import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, AppState } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
} from 'react-native-vision-camera';
import { useDeviceStore } from '@/stores/deviceStore';
import { useAuthStore } from '@/stores/authStore';
import { updateDeviceStatus } from '@/services/firebase/devices';
import { signOut } from '@/services/firebase/auth';

export function CameraPreviewScreen(): React.JSX.Element {
  const device = useCameraDevice('back');
  const { hasPermission: hasCamPerm, requestPermission: requestCamPerm } =
    useCameraPermission();
  const { hasPermission: hasMicPerm, requestPermission: requestMicPerm } =
    useMicrophonePermission();

  const [isActive, setIsActive] = useState(true);
  const deviceId = useDeviceStore((s) => s.deviceId);
  const clearUser = useAuthStore((s) => s.clearUser);
  const clearDevice = useDeviceStore((s) => s.clearDevice);

  // Request permissions on mount
  useEffect(() => {
    if (!hasCamPerm) requestCamPerm();
    if (!hasMicPerm) requestMicPerm();
  }, [hasCamPerm, hasMicPerm, requestCamPerm, requestMicPerm]);

  // Update device status on mount/unmount
  useEffect(() => {
    if (deviceId) {
      updateDeviceStatus(deviceId, 'online');
    }
    return () => {
      if (deviceId) {
        updateDeviceStatus(deviceId, 'offline');
      }
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
    if (deviceId) {
      await updateDeviceStatus(deviceId, 'offline');
    }
    clearDevice();
    await signOut();
    clearUser();
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
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        audio={true}
      />

      {/* Status overlay */}
      <View style={styles.overlay}>
        <View style={styles.statusBar}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, styles.dotActive]} />
            <Text style={styles.statusText}>Camera Active</Text>
          </View>
          <Text style={styles.statusHint}>
            Detection will be enabled in Plan 2
          </Text>
        </View>
      </View>

      {/* Bottom controls */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
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
  signOutButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  signOutText: {
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
