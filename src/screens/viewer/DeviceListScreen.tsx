import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '@/stores/authStore';
import { useDeviceStore } from '@/stores/deviceStore';
import { getUserDevices } from '@/services/firebase/devices';
import { signOut } from '@/services/firebase/auth';
import { requestNotificationPermission, registerFCMToken } from '@/services/firebase/messaging';
import { Device } from '@/types';
import { RootStackParamList } from '@/navigation/RootNavigator';

export function DeviceListScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAuthStore((s) => s.user);
  const devices = useDeviceStore((s) => s.devices);
  const setDevices = useDeviceStore((s) => s.setDevices);
  const deviceId = useDeviceStore((s) => s.deviceId);
  const clearUser = useAuthStore((s) => s.clearUser);
  const clearDevice = useDeviceStore((s) => s.clearDevice);

  useEffect(() => {
    if (user) {
      getUserDevices(user.uid).then(setDevices);
    }
  }, [user, setDevices]);

  // Register FCM token for push notifications
  useEffect(() => {
    if (!user || !deviceId) return;
    requestNotificationPermission().then((granted) => {
      if (granted) {
        registerFCMToken(user.uid, deviceId).catch((err) =>
          console.warn('Failed to register FCM token:', err),
        );
      }
    });
  }, [user, deviceId]);

  const cameras = devices.filter((d) => d.role === 'camera');

  async function handleSignOut() {
    clearDevice();
    await signOut();
    clearUser();
  }

  function renderCamera({ item }: { item: Device }) {
    return (
      <View style={styles.card}>
        <TouchableOpacity
          onPress={() => navigation.navigate('LiveView', { cameraDeviceId: item.id })}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardName}>{item.name}</Text>
            <View
              style={[
                styles.statusDot,
                item.status === 'online' ? styles.online : styles.offline,
              ]}
            />
          </View>
          <Text style={styles.cardMode}>
            Mode: {item.mode} | Status: {item.status}
          </Text>
          <Text style={styles.cardHint}>
            {item.status === 'online' ? 'Tap to view live stream' : 'Camera is offline'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.eventsButton}
          onPress={() => navigation.navigate('EventList', { cameraDeviceId: item.id })}
        >
          <Text style={styles.eventsButtonText}>View Events</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Cameras</Text>

      {cameras.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            No cameras paired yet. Set up an old phone as a camera to get
            started.
          </Text>
        </View>
      ) : (
        <FlatList
          data={cameras}
          keyExtractor={(item) => item.id}
          renderItem={renderCamera}
          contentContainerStyle={styles.list}
        />
      )}

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
  },
  list: {
    paddingBottom: 16,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  online: {
    backgroundColor: '#4caf50',
  },
  offline: {
    backgroundColor: '#666',
  },
  cardMode: {
    fontSize: 13,
    color: '#a0a0b0',
    marginBottom: 4,
  },
  cardHint: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  eventsButton: {
    marginTop: 10,
    backgroundColor: 'rgba(74,144,217,0.2)',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  eventsButtonText: {
    color: '#4A90D9',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#a0a0b0',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  signOutButton: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 40,
  },
  signOutText: {
    color: '#a0a0b0',
    fontSize: 14,
  },
});
