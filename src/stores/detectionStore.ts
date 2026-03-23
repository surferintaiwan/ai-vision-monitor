import { create } from 'zustand';
import { DetectionMode, DetectionResult } from '@/types';

interface DetectionState {
  isDetecting: boolean;
  mode: DetectionMode;
  lastDetection: DetectionResult | null;
  detectionCount: number;
  setDetecting: (running: boolean) => void;
  setMode: (mode: DetectionMode) => void;
  setLastDetection: (result: DetectionResult) => void;
  incrementCount: () => void;
  reset: () => void;
}

export const useDetectionStore = create<DetectionState>((set) => ({
  isDetecting: false,
  mode: 'security',
  lastDetection: null,
  detectionCount: 0,
  setDetecting: (isDetecting) => set({ isDetecting }),
  setMode: (mode) => set({ mode }),
  setLastDetection: (result) => set({ lastDetection: result }),
  incrementCount: () =>
    set((state) => ({ detectionCount: state.detectionCount + 1 })),
  reset: () =>
    set({
      isDetecting: false,
      mode: 'security',
      lastDetection: null,
      detectionCount: 0,
    }),
}));
