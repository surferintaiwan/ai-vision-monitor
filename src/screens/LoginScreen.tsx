import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { appleAuth } from '@invertase/react-native-apple-authentication';
import { signInWithGoogle, signInWithApple } from '@/services/firebase/auth';
import {
  ensureGoogleSignInConfigured,
  formatGoogleSignInError,
  getGoogleIdToken,
} from '@/services/auth/googleSignIn';
import { useAuthStore } from '@/stores/authStore';

export function LoginScreen(): React.JSX.Element {
  const [loading, setLoading] = useState(false);
  const setError = useAuthStore((s) => s.setError);

  async function handleGoogleSignIn() {
    try {
      setLoading(true);
      ensureGoogleSignInConfigured();
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResult = await GoogleSignin.signIn();
      const idToken = getGoogleIdToken(signInResult);
      if (!idToken) return;
      await signInWithGoogle(idToken);
    } catch (err: any) {
      const message = formatGoogleSignInError(err);
      setError(message);
      setTimeout(() => {
        Alert.alert('Sign-In Error', message);
      }, Platform.OS === 'android' ? 150 : 0);
    } finally {
      setLoading(false);
    }
  }

  async function handleAppleSignIn() {
    try {
      setLoading(true);
      const appleResult = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      });
      if (!appleResult.identityToken) {
        throw new Error('No identity token from Apple Sign-In');
      }
      await signInWithApple(appleResult.identityToken, appleResult.nonce);
    } catch (err: any) {
      setError(err.message ?? 'Apple sign-in failed');
      Alert.alert('Sign-In Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI Vision Monitor</Text>
      <Text style={styles.subtitle}>
        Turn your old phone into a smart security camera
      </Text>

      <TouchableOpacity
        style={[styles.button, styles.googleButton]}
        onPress={handleGoogleSignIn}
        disabled={loading}
      >
        <Text style={styles.buttonText}>Sign in with Google</Text>
      </TouchableOpacity>

      {Platform.OS === 'ios' && (
        <TouchableOpacity
          style={[styles.button, styles.appleButton]}
          onPress={handleAppleSignIn}
          disabled={loading}
        >
          <Text style={[styles.buttonText, styles.appleText]}>
            Sign in with Apple
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#a0a0b0',
    marginBottom: 48,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  googleButton: {
    backgroundColor: '#4285F4',
  },
  appleButton: {
    backgroundColor: '#ffffff',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  appleText: {
    color: '#000000',
  },
});
