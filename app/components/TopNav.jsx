import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link, usePathname } from 'expo-router';

export const NAV_ITEMS = [
  { name: 'Home', icon: 'home', href: '/(tabs)' },
  { name: 'Attendance', icon: 'time', href: '/(tabs)/attendance' },
  { name: 'Schedule', icon: 'calendar', href: '/(tabs)/schedule' },
  { name: 'FSR', icon: 'document-attach', href: '/(tabs)/fsr' },
  { name: 'Tasks', icon: 'checkmark-done', href: '/(tabs)/tasks' },
  { name: 'History', icon: 'document-text', href: '/(tabs)/history' },
];

export default function TopNav() {
  return (
    <View style={s.shell}>
      <Image
        source={require('../../Assets/icon.png')}
        style={{ width: 30, height: 30, borderRadius: 10, resizeMode: 'contain' }}
      />
      <Text style={s.brand}>PACIFIC</Text>
    </View>
  );
}

const s = StyleSheet.create({
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#0b132c',
  },
  logoCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fbbf24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    color: '#f8fafc',
    fontWeight: '900',
    letterSpacing: 0.6,
    fontSize: 13,
  },
});
