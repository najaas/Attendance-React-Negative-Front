import { Tabs, Redirect } from 'expo-router';
import { useAuth } from '../providers/AuthProvider';
import React from 'react';

export default function TabsLayout() {
  const { token, loading } = useAuth();
  if (!loading && !token) return <Redirect href="/login" />;
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#0f172a', tabBarInactiveTintColor: '#94a3b8' }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="attendance" options={{ title: 'Attendance' }} />
      <Tabs.Screen name="schedule" options={{ title: 'Schedule' }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tasks' }} />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
    </Tabs>
  );
}
