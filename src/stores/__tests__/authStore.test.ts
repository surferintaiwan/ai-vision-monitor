jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    signOut: jest.fn(() => Promise.resolve()),
    onAuthStateChanged: jest.fn(),
    signInWithCredential: jest.fn(() =>
      Promise.resolve({ user: { uid: 'u1', email: 'a@b.com', displayName: 'A' } }),
    ),
  })),
  GoogleAuthProvider: { credential: jest.fn(() => 'cred') },
  AppleAuthProvider: { credential: jest.fn(() => 'cred') },
}));

import { useAuthStore } from '../authStore';

describe('AuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      loading: true,
      error: null,
    });
  });

  test('initial state has no user and is loading', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.loading).toBe(true);
  });

  test('setUser updates user and stops loading', () => {
    useAuthStore.getState().setUser({ uid: 'u1', email: 'a@b.com', displayName: 'A' });
    const state = useAuthStore.getState();
    expect(state.user?.uid).toBe('u1');
    expect(state.loading).toBe(false);
  });

  test('clearUser resets user', () => {
    useAuthStore.getState().setUser({ uid: 'u1', email: 'a@b.com', displayName: 'A' });
    useAuthStore.getState().clearUser();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
