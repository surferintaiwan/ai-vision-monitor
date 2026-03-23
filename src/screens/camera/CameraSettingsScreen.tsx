import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDetectionStore } from '@/stores/detectionStore';
import { useDeviceStore } from '@/stores/deviceStore';
import { updateDeviceMode } from '@/services/firebase/devices';
import { AlertLevel, DetectionMode } from '@/types';
import { DETECTION_MODES } from '@/config/detectionModes';

const MODE_INFO: Record<DetectionMode, { label: string; description: string }> = {
  security: {
    label: 'Home Security',
    description: 'Alerts for people, motion, and glass breaking',
  },
  baby: {
    label: 'Baby Monitor',
    description: 'Priority alerts for baby crying and glass breaking',
  },
  pet: {
    label: 'Pet Watch',
    description: 'Alerts for pet sounds and motion detection',
  },
  custom: {
    label: 'Custom',
    description: 'All detection types with notification level alerts',
  },
};

const ALERT_LEVEL_LABELS: Record<AlertLevel, string> = {
  alert: 'Alert',
  notify: 'Notify',
  record: 'Record',
  ignore: '—',
};

const ALERT_LEVEL_COLORS: Record<AlertLevel, string> = {
  alert: '#f44336',
  notify: '#ff9800',
  record: '#4caf50',
  ignore: '#666',
};

export function CameraSettingsScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const mode = useDetectionStore((s) => s.mode);
  const setMode = useDetectionStore((s) => s.setMode);
  const deviceId = useDeviceStore((s) => s.deviceId);

  async function handleSelectMode(newMode: DetectionMode) {
    setMode(newMode);
    if (deviceId) {
      await updateDeviceMode(deviceId, newMode).catch((err) =>
        console.warn('Failed to update mode:', err),
      );
    }
  }

  const currentConfig = DETECTION_MODES[mode];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Detection Settings</Text>

      <Text style={styles.sectionTitle}>Detection Mode</Text>
      {(Object.keys(MODE_INFO) as DetectionMode[]).map((m) => (
        <TouchableOpacity
          key={m}
          style={[styles.modeCard, mode === m && styles.modeCardActive]}
          onPress={() => handleSelectMode(m)}
        >
          <Text style={[styles.modeLabel, mode === m && styles.modeLabelActive]}>
            {MODE_INFO[m].label}
          </Text>
          <Text style={styles.modeDesc}>{MODE_INFO[m].description}</Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.sectionTitle}>Alert Configuration</Text>
      <View style={styles.configTable}>
        {(Object.entries(currentConfig) as [string, AlertLevel][]).map(([key, level]) => (
          <View key={key} style={styles.configRow}>
            <Text style={styles.configKey}>
              {key.replace('_', ' ')}
            </Text>
            <Text
              style={[
                styles.configValue,
                { color: ALERT_LEVEL_COLORS[level] },
              ]}
            >
              {ALERT_LEVEL_LABELS[level]}
            </Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>Back to Camera</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    padding: 16,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#a0a0b0',
    marginBottom: 12,
    marginTop: 16,
  },
  modeCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modeCardActive: {
    borderColor: '#4A90D9',
    backgroundColor: 'rgba(74, 144, 217, 0.15)',
  },
  modeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  modeLabelActive: {
    color: '#4A90D9',
  },
  modeDesc: {
    fontSize: 13,
    color: '#a0a0b0',
  },
  configTable: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    padding: 16,
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  configKey: {
    fontSize: 14,
    color: '#fff',
    textTransform: 'capitalize',
  },
  configValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});
