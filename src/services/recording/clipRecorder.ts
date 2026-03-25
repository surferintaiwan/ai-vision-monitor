import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { captureScreenPixelCopy } from '@/services/native/screenCapture';

const CLIPS_DIR = `${RNFS.DocumentDirectoryPath}/clips`;
const CLIP_FRAME_INTERVAL_MS = 500;
const MAX_RECORDING_DURATION_SEC = 30;

let isRecording = false;

export interface ClipRecordResult {
  clipPath: string | null;
  clipDurationSec: number;
  frameCount: number;
}

export async function ensureClipsDir(): Promise<void> {
  const exists = await RNFS.exists(CLIPS_DIR);
  if (!exists) {
    await RNFS.mkdir(CLIPS_DIR);
  }
}

export function getIsRecording(): boolean {
  return isRecording;
}

function normalizePath(path: string): string {
  return path.startsWith('file://') ? path.replace('file://', '') : path;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getClipDir(eventTimestamp: number): string {
  return `${CLIPS_DIR}/clip_${eventTimestamp}`;
}

export async function recordEventClip(
  eventTimestamp: number,
  durationSec: number,
): Promise<ClipRecordResult> {
  if (Platform.OS !== 'android') {
    return { clipPath: null, clipDurationSec: 0, frameCount: 0 };
  }

  if (isRecording) {
    return { clipPath: null, clipDurationSec: 0, frameCount: 0 };
  }

  const safeDurationSec = Math.max(
    1,
    Math.min(durationSec, MAX_RECORDING_DURATION_SEC),
  );

  await ensureClipsDir();
  const clipDir = getClipDir(eventTimestamp);
  const metadataPath = `${clipDir}/meta.json`;

  try {
    isRecording = true;
    await RNFS.mkdir(clipDir);

    const startedAt = Date.now();
    const framePaths: string[] = [];
    let frameCount = 0;

    while (Date.now() - startedAt < safeDurationSec * 1000) {
      try {
        const rawCapturePath = await captureScreenPixelCopy();
        const sourcePath = normalizePath(rawCapturePath);
        const framePath = `${clipDir}/frame_${String(frameCount + 1).padStart(4, '0')}.jpg`;
        await RNFS.moveFile(sourcePath, framePath);
        framePaths.push(framePath);
        frameCount += 1;
      } catch (err) {
        console.warn('Failed to capture clip frame:', err);
      }

      await sleep(CLIP_FRAME_INTERVAL_MS);
    }

    await RNFS.writeFile(
      metadataPath,
      JSON.stringify({
        eventTimestamp,
        createdAt: new Date().toISOString(),
        durationSec: safeDurationSec,
        frameIntervalMs: CLIP_FRAME_INTERVAL_MS,
        frameCount,
        frames: framePaths,
      }),
      'utf8',
    );

    return {
      clipPath: metadataPath,
      clipDurationSec: safeDurationSec,
      frameCount,
    };
  } catch (err) {
    console.warn('Failed to record event clip:', err);
    return {
      clipPath: null,
      clipDurationSec: 0,
      frameCount: 0,
    };
  } finally {
    isRecording = false;
  }
}

export async function deleteClip(clipPath: string): Promise<void> {
  try {
    const normalized = normalizePath(clipPath);
    const clipDir = normalized.endsWith('/meta.json')
      ? normalized.replace('/meta.json', '')
      : normalized;
    await RNFS.unlink(clipDir);
  } catch {
    // File may already be deleted
  }
}

export async function getClipsDirectorySize(): Promise<number> {
  try {
    const files = await RNFS.readDir(CLIPS_DIR);
    return files.reduce((total, file) => total + Number(file.size), 0);
  } catch {
    return 0;
  }
}
