import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '@/stores/authStore';
import { onAuthStateChange } from '@/services/firebase/auth';
import { LoginScreen } from '@/screens/LoginScreen';
import { RoleSelectScreen } from '@/screens/RoleSelectScreen';
import { CameraPreviewScreen } from '@/screens/camera/CameraPreviewScreen';
import { CameraSettingsScreen } from '@/screens/camera/CameraSettingsScreen';
import { DeviceListScreen } from '@/screens/viewer/DeviceListScreen';
import { LiveViewScreen } from '@/screens/viewer/LiveViewScreen';
import { EventListScreen } from '@/screens/viewer/EventListScreen';
import { LoadingScreen } from '@/components/LoadingScreen';

export type RootStackParamList = {
  Login: undefined;
  RoleSelect: undefined;
  CameraPreview: undefined;
  CameraSettings: undefined;
  DeviceList: undefined;
  LiveView: { cameraDeviceId: string };
  EventList: { cameraDeviceId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator(): React.JSX.Element {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const setUser = useAuthStore((s) => s.setUser);
  const clearUser = useAuthStore((s) => s.clearUser);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    const unsubscribe = onAuthStateChange((firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
        });
      } else {
        clearUser();
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [setUser, clearUser, setLoading]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
            <Stack.Screen
              name="CameraPreview"
              component={CameraPreviewScreen}
            />
            <Stack.Screen
              name="CameraSettings"
              component={CameraSettingsScreen}
            />
            <Stack.Screen name="DeviceList" component={DeviceListScreen} />
            <Stack.Screen name="LiveView" component={LiveViewScreen} />
            <Stack.Screen name="EventList" component={EventListScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
