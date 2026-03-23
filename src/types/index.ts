export type Role = 'camera' | 'viewer';

export type DetectionMode = 'security' | 'baby' | 'pet' | 'custom';

export type DeviceStatus = 'online' | 'offline';

export type EventType = 'person' | 'motion' | 'sound';

export type AlertLevel = 'alert' | 'notify' | 'record' | 'ignore';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface Device {
  id: string;
  userId: string;
  name: string;
  role: Role;
  mode: DetectionMode;
  status: DeviceStatus;
  lastSeen: Date;
  settings: DeviceSettings;
}

export interface DeviceSettings {
  motionSensitivity: number;   // 0-1
  soundSensitivity: number;    // 0-1
  personSensitivity: number;   // 0-1
  recordingDurationSec: number; // seconds after trigger (default 10)
  videoQuality: 'low' | 'medium' | 'high';
}

export interface DetectionEvent {
  id: string;
  deviceId: string;
  userId: string;
  type: EventType;
  soundClass: string | null;
  confidence: number;
  timestamp: Date;
  clipPath: string | null;
  clipDurationSec: number;
}

export const DEFAULT_DEVICE_SETTINGS: DeviceSettings = {
  motionSensitivity: 0.5,
  soundSensitivity: 0.5,
  personSensitivity: 0.5,
  recordingDurationSec: 10,
  videoQuality: 'medium',
};
