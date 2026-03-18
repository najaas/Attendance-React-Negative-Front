import React from 'react';
import { Stack, Slot } from 'expo-router';
import { AuthProvider } from './providers/AuthProvider';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }} />
      <Slot />
    </AuthProvider>
  );
}
