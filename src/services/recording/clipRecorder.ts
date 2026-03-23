import { Camera } from 'react-native-vision-camera';
import RNFS from 'react-native-fs';

const CLIPS_DIR = `${RNFS.DocumentDirectoryPath}/clips`;

let isRecording = false;

export async function ensureClipsDir(): Promise<void> {
  const exists = await RNFS.exists(CLIPS_DIR);
  if (!exists) {
    await RNFS.mkdir(CLIPS_DIR);
  }
}

export function getClipPath(eventTimestamp: number): string {
  return `${CLIPS_DIR}/clip_${eventTimestamp}.mp4`;
}

export function getIsRecording(): boolean {
  return isRecording;
}

export async function startRecording(
  camera: React.RefObject<Camera | null>,
  eventTimestamp: number,
  durationSec: number,
): Promise<string | null> {
  if (isRecording || !camera.current) return null;

  await ensureClipsDir();
  const clipPath = getClipPath(eventTimestamp);

  try {
    isRecording = true;

    camera.current.startRecording({
      fileType: 'mp4',
      onRecordingFinished: (video) => {
        isRecording = false;
        RNFS.moveFile(video.path, clipPath).catch((err) =>
          console.warn('Failed to move clip:', err),
        );
      },
      onRecordingError: (error) => {
        isRecording = false;
        console.warn('Recording error:', error);
      },
    });

    // Stop recording after duration
    setTimeout(() => {
      if (isRecording && camera.current) {
        camera.current.stopRecording();
      }
    }, durationSec * 1000);

    return clipPath;
  } catch (err) {
    isRecording = false;
    console.warn('Failed to start recording:', err);
    return null;
  }
}

export async function deleteClip(clipPath: string): Promise<void> {
  try {
    await RNFS.unlink(clipPath);
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
