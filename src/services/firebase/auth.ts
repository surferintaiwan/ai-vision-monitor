import auth, {
  FirebaseAuthTypes,
} from '@react-native-firebase/auth';

export type AuthUser = FirebaseAuthTypes.User | null;
export type AuthUnsubscribe = () => void;

export function onAuthStateChange(
  callback: (user: AuthUser) => void,
): AuthUnsubscribe {
  return auth().onAuthStateChanged(callback);
}

export async function signInWithGoogle(idToken: string): Promise<AuthUser> {
  const credential = auth.GoogleAuthProvider.credential(idToken);
  const result = await auth().signInWithCredential(credential);
  return result.user;
}

export async function signInWithApple(
  identityToken: string,
  nonce: string,
): Promise<AuthUser> {
  const credential = auth.AppleAuthProvider.credential(identityToken, nonce);
  const result = await auth().signInWithCredential(credential);
  return result.user;
}

export async function signOut(): Promise<void> {
  await auth().signOut();
}
