import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDeviceStore } from '@/stores/deviceStore';
import { useAuthStore } from '@/stores/authStore';
import { registerDevice } from '@/services/firebase/devices';
import { Role } from '@/types';

function generateDeviceId(): string {
  return `device_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function RoleSelectScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const user = useAuthStore((s) => s.user);
  const setRole = useDeviceStore((s) => s.setRole);
  const setDeviceId = useDeviceStore((s) => s.setDeviceId);

  async function handleSelectRole(role: Role) {
    if (!user) return;

    try {
      const deviceId = generateDeviceId();
      const name = role === 'camera' ? 'New Camera' : 'Viewer';

      await registerDevice(deviceId, user.uid, name, role);
      setRole(role);
      setDeviceId(deviceId);

      if (role === 'camera') {
        navigation.replace('CameraPreview');
      } else {
        navigation.replace('DeviceList');
      }
    } catch (err: any) {
      console.error('handleSelectRole error:', err);
      Alert.alert('Error', err.message ?? 'Failed to register device');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose Mode</Text>
      <Text style={styles.subtitle}>
        What role should this device play?
      </Text>

      <TouchableOpacity
        style={[styles.card, styles.cameraCard]}
        onPress={() => handleSelectRole('camera')}
      >
        <Text style={styles.cardEmoji}>📷</Text>
        <Text style={styles.cardTitle}>Camera</Text>
        <Text style={styles.cardDesc}>
          Use this device as a security camera. It will capture video, detect
          events, and stream to your other devices.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.card, styles.viewerCard]}
        onPress={() => handleSelectRole('viewer')}
      >
        <Text style={styles.cardEmoji}>👁</Text>
        <Text style={styles.cardTitle}>Viewer</Text>
        <Text style={styles.cardDesc}>
          View live streams from your cameras, receive alerts, and review
          recorded events.
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#a0a0b0',
    marginBottom: 32,
  },
  card: {
    width: '100%',
    padding: 24,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  cameraCard: {
    backgroundColor: 'rgba(74, 144, 217, 0.1)',
    borderColor: 'rgba(74, 144, 217, 0.3)',
  },
  viewerCard: {
    backgroundColor: 'rgba(80, 200, 120, 0.1)',
    borderColor: 'rgba(80, 200, 120, 0.3)',
  },
  cardEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 14,
    color: '#a0a0b0',
    lineHeight: 20,
  },
});
