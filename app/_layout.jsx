// ============================================================
// FILE: app/_layout.jsx
// ============================================================

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { AuthProvider } from './providers/AuthProvider';
import NetInfo from '@react-native-community/netinfo';

export default function RootLayout() {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? true);
    });
    return unsubscribe;
  }, []);

  if (!isConnected) {
    return (
      <View style={s.offlineContainer}>
        <Text style={s.offlineIcon}>📡</Text>
        <Text style={s.offlineTitle}>No Network</Text>
        <Text style={s.offlineSub}>Please check your internet connection and try again.</Text>
      </View>
    );
  }

  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  );
}

const s = StyleSheet.create({
  offlineContainer: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 24 },
  offlineIcon: { fontSize: 72, marginBottom: 24 },
  offlineTitle: { fontSize: 28, fontWeight: '900', color: '#ffffff', marginBottom: 12, textAlign: 'center' },
  offlineSub: { fontSize: 15, color: '#94a3b8', fontWeight: '600', textAlign: 'center', lineHeight: 22 },
});