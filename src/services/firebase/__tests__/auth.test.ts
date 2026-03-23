import { renderHook, act } from '@testing-library/react-native';
import auth from '@react-native-firebase/auth';

// Mock Firebase Auth
jest.mock('@react-native-firebase/auth', () => {
  const mockSignOut = jest.fn(() => Promise.resolve());
  const mockOnAuthStateChanged = jest.fn();
  const mockGoogleSignIn = jest.fn();

  return {
    __esModule: true,
    default: jest.fn(() => ({
      signOut: mockSignOut,
      onAuthStateChanged: mockOnAuthStateChanged,
      signInWithCredential: jest.fn(() =>
        Promise.resolve({
          user: { uid: 'test-uid', email: 'test@test.com', displayName: 'Test' },
        }),
      ),
    })),
    GoogleAuthProvider: {
      credential: jest.fn(() => 'mock-credential'),
    },
    AppleAuthProvider: {
      credential: jest.fn(() => 'mock-credential'),
    },
  };
});

import { signOut, onAuthStateChange } from '../auth';

describe('Auth Service', () => {
  beforeEach(() => jest.clearAllMocks());

  test('signOut calls firebase auth signOut', async () => {
    await signOut();
    expect(auth().signOut).toHaveBeenCalled();
  });

  test('onAuthStateChange subscribes to auth changes', () => {
    const callback = jest.fn();
    onAuthStateChange(callback);
    expect(auth().onAuthStateChanged).toHaveBeenCalledWith(expect.any(Function));
  });
});
