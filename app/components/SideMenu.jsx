import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { Link, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { NAV_ITEMS } from './TopNav';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(width * 0.78, 320);

export default function SideMenu({ open, onClose, onLogout }) {
  const slideX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const pathname = usePathname();

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideX, {
        toValue: open ? 0 : -DRAWER_WIDTH,
        duration: 210,
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: open ? 1 : 0,
        duration: 210,
        useNativeDriver: true,
      }),
    ]).start();
  }, [open, slideX, fade]);

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: open ? 'auto' : 'none' }]}>
      <Animated.View style={[s.backdrop, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[s.drawer, { transform: [{ translateX: slideX }] }]}>
        <View style={s.header}>
          <Image
            source={require('../../Assets/icon.png')}
            style={{ width: 44, height: 44, borderRadius: 14, resizeMode: 'contain', marginRight: 10 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={s.brand}>PACIFIC</Text>
            <Text style={s.brandSub}>Mobile Portal</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={20} color="#cbd5e1" />
          </TouchableOpacity>
        </View>

        <View style={s.menu}>
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            const rowStyle = StyleSheet.flatten([s.row, active && s.rowActive]);
            const labelStyle = StyleSheet.flatten([s.rowLabel, active && s.rowLabelActive]);
            return (
              <Link key={item.href} href={item.href} asChild onPress={onClose}>
                <TouchableOpacity style={rowStyle}>
                  <Ionicons
                    name={item.icon}
                    size={18}
                    color={active ? '#fbbf24' : '#94a3b8'}
                    style={{ width: 22 }}
                  />
                  <Text style={labelStyle}>{item.name}</Text>
                  {active ? <View style={s.dot} /> : null}
                </TouchableOpacity>
              </Link>
            );
          })}
        </View>

        <View style={s.footer}>
          <TouchableOpacity
            style={StyleSheet.flatten([s.row, s.logoutRow])}
            onPress={() => { onClose?.(); onLogout?.(); }}
          >
            <Ionicons name="log-out-outline" size={18} color="#fca5a5" style={{ width: 22 }} />
            <Text style={s.logoutLabel}>Sign out</Text>
          </TouchableOpacity>
          <Text style={s.footerText}>Pacific Attendance Suite</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#0b132c',
    paddingTop: 46,
    paddingHorizontal: 18,
    paddingBottom: 24,
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 28,
  },
  brandIcon: {
    backgroundColor: '#fbbf24',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    color: '#f8fafc',
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 0.6,
  },
  brandSub: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 12,
  },
  menu: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  rowActive: {
    backgroundColor: '#111a39',
    borderWidth: 1,
    borderColor: '#1f2b50',
  },
  rowLabel: {
    color: '#cbd5e1',
    fontWeight: '800',
    fontSize: 14,
    flex: 1,
    marginLeft: 10,
  },
  rowLabelActive: {
    color: '#fbbf24',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fbbf24',
  },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 18,
    right: 18,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 14,
    gap: 10,
  },
  footerText: {
    color: '#64748b',
    fontWeight: '700',
    fontSize: 12,
  },
  logoutRow: {
    backgroundColor: '#1a223d',
    borderWidth: 1,
    borderColor: '#2a365c',
  },
  logoutLabel: {
    color: '#fca5a5',
    fontWeight: '800',
    fontSize: 14,
    marginLeft: 10,
  },
});
