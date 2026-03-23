import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export function LoadingScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4A90D9" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
});
