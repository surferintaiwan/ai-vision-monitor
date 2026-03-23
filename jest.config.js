module.exports = {
  preset: 'react-native',
  setupFilesAfterSetup: ['@testing-library/jest-native/extend-expect'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|@react-native-firebase|expo|@expo|react-native-vision-camera|react-native-screens|react-native-safe-area-context|zustand)/)',
  ],
};
