import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useDeviceStore } from '@/stores/deviceStore';
import { getUserDevices } from '@/services/firebase/devices';
import { signOut } from '@/services/firebase/auth';
import { Device } from '@/types';

export function DeviceListScreen(): React.JSX.Element {
  const user = useAuthStore((s) => s.user);
  const devices = useDeviceStore((s) => s.devices);
  const setDevices = useDeviceStore((s) => s.setDevices);
  const clearUser = useAuthStore((s) => s.clearUser);
  const clearDevice = useDeviceStore((s) => s.clearDevice);

  useEffect(() => {
    if (user) {
      getUserDevices(user.uid).then(setDevices);
    }
  }, [user, setDevices]);

  const cameras = devices.filter((d) => d.role === 'camera');

  async function handleSignOut() {
    clearDevice();
    await signOut();
    clearUser();
  }

  function renderCamera({ item }: { item: Device }) {
    return (
      <TouchableOpacity style={styles.card}>
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
          Live streaming will be available in Plan 3
        </Text>
      </TouchableOpacity>
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
