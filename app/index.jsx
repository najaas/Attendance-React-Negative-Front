import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from './providers/AuthProvider';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const { user, loading } = useAuth();

  // Show a loading spinner while checking the authentication state
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
        <ActivityIndicator size="large" color="#fbbf24" />
      </View>
    );
  }

  // If not logged in, redirect to Login
  if (!user) {
    return <Redirect href="/login" />;
  }

  // If logged in, redirect to the main tabs (Dashboard)
  return <Redirect href="/(tabs)" />;
}
