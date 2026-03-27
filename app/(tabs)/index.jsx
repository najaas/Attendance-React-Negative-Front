import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Linking, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../providers/AuthProvider';
import { apiFetch } from '../../lib/api';
import { Redirect, Link } from 'expo-router';

const C = {
  bg: '#f0f4f8',
  navy: '#0f172a',
  navyMid: '#1e293b',
  white: '#ffffff',
  muted: '#64748b',
  border: '#e2e8f0',
  amber: '#fbbf24',
  blue: '#3b82f6',
  blueBg: '#eff6ff',
  green: '#22c55e',
  greenBg: '#f0fdf4',
  orange: '#f97316',
  orangeBg: '#fff7ed',
  red: '#ef4444',
  inputBg: '#f8fafc',
};

export default function Home() {
  const { token, user, loading, logout } = useAuth();
  const [status, setStatus] = React.useState({ attendance: null, schedule: [], tasks: [] });
  const [busy, setBusy] = React.useState(false);

  useEffect(() => {
    if (!token) return;

    const fetchAttendance = async () => {
      try {
        const att = await apiFetch(`/attendance/employee-attendance/${todayStr()}`, { token });
        setStatus(prev => ({ ...prev, attendance: att || null }));
      } catch (err) { console.log('Attendance error', err.message); }
    };

    const fetchSchedule = async () => {
      try {
        const sch = await apiFetch('/schedule?date=recent', { token });
        setStatus(prev => ({ ...prev, schedule: sch || [] }));
      } catch (err) { console.log('Schedule error', err.message); }
    };

    const fetchTasks = async () => {
      try {
        const tsk = await apiFetch('/tasks?date=all', { token });
        setStatus(prev => ({ ...prev, tasks: tsk || [] }));
      } catch (err) { console.log('Tasks error', err.message); }
    };

    setBusy(true);
    // Execute all in parallel, but update status separately
    Promise.allSettled([fetchAttendance(), fetchSchedule(), fetchTasks()])
      .finally(() => setBusy(false));
  }, [token, user?.username]);

  if (!loading && !token) return <Redirect href="/login" />;

  const mySchedule = useMemo(() =>
    (status.schedule || []).filter(
      (r) =>
        (r.assignedToUsername && r.assignedToUsername === user?.username) ||
        (r.assignedToName && r.assignedToName === user?.name)
    ), [status.schedule, user]);

  const next = pickNext(mySchedule);
  const pendingTasks = (status.tasks || []).filter((t) => t.status !== 'completed');
  const initials = getInitials(user?.name || user?.username || '');

  // Navigation counts
  const today = todayStr();
  const todayCount = mySchedule.filter(r => r.taskDate === today).length;
  const upcomingCount = mySchedule.filter(r => r.taskDate > today).length;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.container}>

      {/* Hero greeting */}
      <View style={s.hero}>
        <View style={s.heroInner}>
          <View style={s.avatarCircle}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <View style={s.heroText}>
            <Text style={s.heroGreeting}>Good {timeOfDay()}</Text>
            <Text style={s.heroName}>{user?.name || user?.username}</Text>
          </View>
          {/* <TouchableOpacity style={s.logoutBtn} onPress={logout}>
            <Text style={s.logoutText}>Sign out</Text>
          </TouchableOpacity> */}
        </View>

        {/* Attendance status bar */}
        <View style={s.attBar}>
          <View style={s.attBarItem}>
            <Text style={s.attBarLabel}>OFFICE OUT</Text>
            <Text style={s.attBarValue}>
              {status.attendance?.officeEntryTime || '—'}
            </Text>
          </View>
          <View style={s.attBarDivider} />
          <View style={s.attBarItem}>
            <Text style={s.attBarLabel}>OFFICE IN</Text>
            <Text style={s.attBarValue}>
              {status.attendance?.officeExitTime || '—'}
            </Text>
          </View>
          <View style={s.attBarDivider} />
          <View style={s.attBarItem}>
            <Text style={s.attBarLabel}>STATUS</Text>
            <View style={[s.statusPill, { backgroundColor: status.attendance ? '#dcfce7' : '#fef3c7' }]}>
              <Text style={[s.statusPillText, { color: status.attendance ? '#166534' : '#92400e' }]}>
                {status.attendance ? 'Recorded' : 'Pending'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {busy && <ActivityIndicator color={C.blue} style={{ marginVertical: 10 }} />}

      {/* Metrics Row */}
      <View style={s.metricsRow}>
        <MetricCard
          icon="✓"
          label="Tasks Pending"
          value={String(pendingTasks.length)}
          accent={C.orange}
          bg={C.orangeBg}
        />
        <MetricCard
          icon="▦"
          label="Today's Schedule"
          value={next ? (next.projectName || 'Task') : 'None'}
          sub={next ? next.taskDate : 'No upcoming'}
          accent={C.blue}
          bg={C.blueBg}
        />
      </View>

      {/* Quick Navigation Section */}
      <View style={s.navSection}>
        <Text style={s.sectionLabelSmall}>QUICK NAVIGATION</Text>
        <View style={s.navGrid}>
          <Link href="/(tabs)/schedule" asChild>
            <TouchableOpacity style={StyleSheet.flatten([s.navCard, { borderLeftColor: C.blue, backgroundColor: '#eff6ff' }])}>
              <View style={s.navIconCircle}>
                <Ionicons name="calendar-sharp" size={20} color={C.blue} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.navTitle}>Today's Schedule</Text>
                <Text style={s.navSubtitle}>{todayCount > 0 ? `${todayCount} Jobs assigned` : 'No jobs for today'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
            </TouchableOpacity>
          </Link>

          <Link href="/(tabs)/schedule" asChild>
            <TouchableOpacity style={StyleSheet.flatten([s.navCard, { borderLeftColor: C.green, backgroundColor: '#f0fdf4' }])}>
              <View style={[s.navIconCircle, { backgroundColor: '#dcfce7' }]}>
                <Ionicons name="rocket" size={20} color={C.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.navTitle}>Upcoming Work</Text>
                <Text style={s.navSubtitle}>{upcomingCount > 0 ? `${upcomingCount} Assignments` : 'No upcoming work'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
            </TouchableOpacity>
          </Link>
        </View>
      </View>

      {/* Upcoming schedule */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Schedule</Text>
        <View style={s.sectionBadge}>
          <Text style={s.sectionBadgeText}>{mySchedule.length}</Text>
        </View>
      </View>

      {mySchedule.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyText}>No assignments</Text>
        </View>
      ) : (
        mySchedule.slice(0, 5).map((r, i) => (
          <View key={i} style={s.schedCard}>
            {/* Date column */}
            <View style={s.schedDateCol}>
              <Text style={s.schedDay}>{shortDay(r.taskDate)}</Text>
              <Text style={s.schedDayNum}>{dayNum(r.taskDate)}</Text>
            </View>
            {/* Accent line */}
            <View style={s.schedAccentLine} />
            {/* Info */}
            <View style={s.schedInfo}>
              <Text style={s.schedTitle} numberOfLines={1}>{r.projectName || r.project || 'Task'}</Text>
              <Text style={s.schedMeta}>
                Job <Text style={s.schedMetaBold}>{r.jobNumber || '-'}</Text>
                {'  ·  '}
                Office <Text style={s.schedMetaBold}>{r.officeTime || '--:--'}</Text>
                {'  ·  '}
                Site <Text style={s.schedMetaBold}>{r.siteTime || '--:--'}</Text>
              </Text>
              {r.customerName ? (
                <Text style={s.schedMeta}>🏢 <Text style={s.schedMetaBold}>{r.customerName}</Text></Text>
              ) : null}
              {/* Paired contact */}
              {r.customerContact ? (() => {
                const names = String(r.customerPerson || '').split(',').map(n => n.trim()).filter(Boolean);
                const nums = String(r.customerContact).split(',').map(n => n.trim()).filter(Boolean);
                return (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>
                    {nums.slice(0, 2).map((num, ni) => {
                      const name = names[ni] || null;
                      return (
                        <TouchableOpacity key={ni} onPress={() => Linking.openURL(`tel:${num}`)}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: '#bfdbfe' }}>
                          {name ? <Text style={{ fontSize: 10, fontWeight: '900', color: '#1e40af' }}>{name}</Text> : null}
                          <Text style={{ fontSize: 10, fontWeight: '800', color: '#2563eb' }}>📞 {num}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })() : null}
            </View>
            {r.location ? (
              <TouchableOpacity
                style={s.mapBtn}
                onPress={() => Linking.openURL(normalizeUrl(r.location))}
              >
                <Text style={s.mapBtnText}>Map</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))
      )}
    </ScrollView>
  );
}

function MetricCard({ icon, label, value, sub, accent, bg }) {
  return (
    <View style={[s.metricCard, { backgroundColor: bg, borderLeftColor: accent }]}>
      <View style={[s.metricIconCircle, { backgroundColor: accent + '22' }]}>
        <Text style={[s.metricIcon, { color: accent }]}>{icon}</Text>
      </View>
      <View style={s.metricText}>
        <Text style={s.metricLabel}>{label}</Text>
        <Text style={s.metricValue} numberOfLines={1}>{value}</Text>
        {sub ? <Text style={s.metricSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

function getInitials(name) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'U';
}

function timeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function shortDay(ds) {
  if (!ds) return '—';
  const [y, m, d] = ds.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
}

function dayNum(ds) {
  if (!ds) return '—';
  return ds.split('-')[2];
}

function normalizeUrl(v) {
  const raw = String(v || '').trim();
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function pickNext(rows) {
  const todayNum = Number(todayStr().replace(/-/g, ''));
  return rows
    .map((r) => ({
      ...r,
      dateNum: Number(String(r.taskDate || '').replace(/-/g, '')),
      timeMin: toMin(r.officeTime || r.siteTime),
    }))
    .filter((r) => r.dateNum >= todayNum)
    .sort((a, b) => a.dateNum !== b.dateNum ? a.dateNum - b.dateNum : a.timeMin - b.timeMin)[0] || null;
}

function toMin(t) {
  if (!t || !/^\d{2}:\d{2}/.test(t)) return 9999;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  container: { paddingBottom: 40 },

  hero: {
    backgroundColor: C.navy,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 0,
    marginBottom: 16,
  },
  heroInner: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18,
  },
  avatarCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#fbbf2422',
    borderWidth: 1.5, borderColor: '#fbbf2444',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '800', color: C.amber },
  heroText: { flex: 1 },
  heroGreeting: { fontSize: 11, fontWeight: '600', color: '#64748b', letterSpacing: 0.4 },
  heroName: { fontSize: 18, fontWeight: '900', color: C.white, marginTop: 1 },
  logoutBtn: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8,
  },
  logoutText: { color: '#fca5a5', fontSize: 11, fontWeight: '700' },

  attBar: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    marginBottom: 20,
    overflow: 'hidden',
  },
  attBarItem: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
  },
  attBarDivider: { width: 1, backgroundColor: '#334155', marginVertical: 10 },
  attBarLabel: { fontSize: 9, fontWeight: '800', color: '#64748b', letterSpacing: 0.6, marginBottom: 5 },
  attBarValue: { fontSize: 16, fontWeight: '900', color: C.white },
  statusPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  statusPillText: { fontSize: 11, fontWeight: '800' },

  metricsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginBottom: 20 },
  metricCard: {
    flex: 1, borderRadius: 14, padding: 14,
    borderLeftWidth: 3, borderWidth: 1, borderColor: C.border,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  metricIconCircle: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  metricIcon: { fontSize: 18, fontWeight: '700' },
  metricText: { flex: 1 },
  metricLabel: { fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 0.4, marginBottom: 3 },
  metricValue: { fontSize: 15, fontWeight: '900', color: C.navy },
  metricSub: { fontSize: 11, color: C.muted, fontWeight: '600', marginTop: 1 },

  // Navigation Grid
  navSection: { paddingHorizontal: 16, marginBottom: 25 },
  sectionLabelSmall: { fontSize: 10, fontWeight: '900', color: C.muted, letterSpacing: 1.2, marginBottom: 12 },
  navGrid: { gap: 12 },
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    borderLeftWidth: 4,
    gap: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  navIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  navTitle: { fontSize: 15, fontWeight: '900', color: C.navy },
  navSubtitle: { fontSize: 12, color: C.muted, fontWeight: '700', marginTop: 2 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, marginBottom: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: C.navy },
  sectionBadge: {
    backgroundColor: C.navy, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  sectionBadgeText: { fontSize: 11, fontWeight: '800', color: C.amber },

  emptyCard: {
    marginHorizontal: 16, backgroundColor: C.white, borderRadius: 14,
    padding: 24, alignItems: 'center', borderWidth: 1, borderColor: C.border,
  },
  emptyText: { color: C.muted, fontWeight: '700', fontSize: 13 },

  schedCard: {
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: C.white, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
    overflow: 'hidden',
  },
  schedDateCol: {
    width: 52, alignItems: 'center', paddingVertical: 14,
    backgroundColor: C.inputBg, borderRightWidth: 1, borderRightColor: C.border,
  },
  schedDay: { fontSize: 9, fontWeight: '800', color: C.muted, letterSpacing: 0.5 },
  schedDayNum: { fontSize: 20, fontWeight: '900', color: C.navy, marginTop: 1 },
  schedAccentLine: { width: 3, alignSelf: 'stretch', backgroundColor: C.amber },
  schedInfo: { flex: 1, paddingVertical: 12, paddingHorizontal: 12 },
  schedTitle: { fontSize: 14, fontWeight: '800', color: C.navy, marginBottom: 4 },
  schedMeta: { fontSize: 11, color: C.muted, fontWeight: '600', marginTop: 2 },
  schedMetaBold: { fontWeight: '800', color: C.navy },
  mapBtn: {
    marginRight: 12, backgroundColor: C.blueBg,
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8,
  },
  mapBtnText: { color: C.blue, fontWeight: '800', fontSize: 11 },
});