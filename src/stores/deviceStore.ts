import { create } from 'zustand';
import { Role, Device } from '@/types';

interface DeviceState {
  role: Role | null;
  deviceId: string | null;
  devices: Device[];
  setRole: (role: Role) => void;
  setDeviceId: (id: string) => void;
  setDevices: (devices: Device[]) => void;
  clearDevice: () => void;
}

export const useDeviceStore = create<DeviceState>((set) => ({
  role: null,
  deviceId: null,
  devices: [],
  setRole: (role) => set({ role }),
  setDeviceId: (id) => set({ deviceId: id }),
  setDevices: (devices) => set({ devices }),
  clearDevice: () => set({ role: null, deviceId: null, devices: [] }),
}));
