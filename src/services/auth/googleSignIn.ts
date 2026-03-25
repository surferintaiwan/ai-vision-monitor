import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  type SignInResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { GOOGLE_WEB_CLIENT_ID } from '@env';

const PLACEHOLDER_WEB_CLIENT_ID =
  'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com';

let configured = false;

function getGoogleWebClientId(): string {
  return GOOGLE_WEB_CLIENT_ID?.trim() ?? '';
}

export function ensureGoogleSignInConfigured(): void {
  const webClientId = getGoogleWebClientId();

  if (!webClientId || webClientId === PLACEHOLDER_WEB_CLIENT_ID) {
    throw new Error(
      'Google Sign-In is not configured. Set GOOGLE_WEB_CLIENT_ID in .env to the Web client ID from Firebase Authentication.',
    );
  }

  if (!configured) {
    GoogleSignin.configure({ webClientId });
    configured = true;
  }
}

export function getGoogleIdToken(
  signInResult: SignInResponse,
): string | null {
  if (!isSuccessResponse(signInResult)) {
    return null;
  }

  return signInResult.data.idToken ?? null;
}

function isDeveloperError(code: unknown, message: string): boolean {
  const normalizedCode = String(code ?? '').toUpperCase();
  const normalizedMessage = message.toUpperCase();

  return (
    normalizedCode === '10' ||
    normalizedCode === 'DEVELOPER_ERROR' ||
    normalizedMessage.includes('DEVELOPER_ERROR') ||
    normalizedMessage.includes('CODE: 10') ||
    normalizedMessage.includes('DEVELOPER CONSOLE IS NOT SET UP CORRECTLY')
  );
}

export function formatGoogleSignInError(error: unknown): string {
  if (isErrorWithCode(error)) {
    if (error.code === statusCodes.IN_PROGRESS) {
      return 'Google sign-in is already in progress.';
    }

    if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return 'Google Play Services is unavailable or outdated on this device.';
    }

    const message = error.message ?? 'Google sign-in failed.';

    if (isDeveloperError(error.code, message)) {
      return (
        'Google Sign-In configuration mismatch. In Firebase, enable Google sign-in, add the SHA-1 for this Android build, then download google-services.json again. Also verify GOOGLE_WEB_CLIENT_ID is the Web client ID and the Android package name is com.aivisionmonitor.'
      );
    }

    return message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Google sign-in failed.';
}
