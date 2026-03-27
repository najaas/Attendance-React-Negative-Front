import React, { useState } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../providers/AuthProvider';
import TopNav from '../components/TopNav';
import SideMenu from '../components/SideMenu';

const iconMap = {
  index: 'home',
  attendance: 'time',
  schedule: 'calendar',
  tasks: 'checkmark-done',
  history: 'document-text'
};

export default function TabsLayout() {
  const { token, loading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  if (!loading && !token) return <Redirect href="/login" />;

  return (
    <>
      <Tabs
        screenOptions={({ route }) => ({
          headerShown: true,
          headerStyle: { backgroundColor: '#0b132c' },
          headerTitle: () => <TopNav active={route.name} />,
          headerTitleAlign: 'left',
          headerTitleContainerStyle: { width: '100%', flex: 1 },
          headerShadowVisible: false,
          tabBarStyle: { display: 'none' },
          headerLeftContainerStyle: { paddingLeft: 8 },
          headerRightContainerStyle: { paddingRight: 8 },
          headerLeft: () => (
            <Ionicons
              name="menu-outline"
              size={24}
              color="#fbbf24"
              onPress={() => setMenuOpen(true)}
            />
          ),
          headerRight: () => null,
        })}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="attendance" options={{ title: 'Attendance' }} />
        <Tabs.Screen name="schedule" options={{ title: 'Schedule' }} />
        <Tabs.Screen name="tasks" options={{ title: 'Tasks' }} />
        <Tabs.Screen name="history" options={{ title: 'History' }} />
      </Tabs>

      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} onLogout={logout} />
    </>
  );
}
