import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from './providers/AuthProvider';
import { apiFetch } from '../lib/api';

const card = (title, subtitle, value, accent) => (
  <View style={[s.card, { borderColor: accent, shadowColor: accent }]}>
    <Text style={s.cardTitle}>{title}</Text>
    <Text style={s.cardValue}>{value}</Text>
    {subtitle ? <Text style={s.cardSub}>{subtitle}</Text> : null}
  </View>
);

export default function Home() {
  const { token, user, loading, logout } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState({ attendance: null, schedule: [], tasks: [] });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    setBusy(true);
    Promise.all([
      apiFetch(`/employee-attendance/${todayStr()}`, { token }).catch(() => null),
      apiFetch('/schedule?date=recent', { token }).catch(() => []),
      apiFetch('/tasks?date=all', { token }).catch(() => [])
    ])
      .then(([attendance, schedule, tasks]) => setStatus({ attendance, schedule, tasks }))
      .finally(() => setBusy(false));
  }, [token]);

  if (!loading && !token) return <Redirect href="/login" />;

  const mySchedule = (status.schedule || []).filter(
    (r) =>
      (r.assignedToUsername && r.assignedToUsername === user?.username) ||
      (r.assignedToName && r.assignedToName === user?.name)
  );

  const next = pickNext(mySchedule);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f1f5f9' }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={s.headerRow}>
        <View>
          <Text style={s.hi}>Hi, {user?.name || user?.username}</Text>
          <Text style={s.muted}>Employee Portal</Text>
        </View>
        <TouchableOpacity onPress={logout}>
          <Text style={[s.muted, { color: '#ef4444', fontWeight: '800' }]}>Logout</Text>
        </TouchableOpacity>
      </View>

      {busy ? <ActivityIndicator color="#0f172a" style={{ marginVertical: 12 }} /> : null}

      <View style={s.cards}>
        {card('Attendance', status.attendance ? 'Submitted' : 'Pending', status.attendance ? 'Today' : 'Awaiting', '#0ea5e9')}
        {card('Tasks', 'Pending', (status.tasks || []).filter((t) => t.status !== 'completed').length, '#f97316')}
        {card('Next', next ? next.projectName || 'Task' : 'None', next ? `${next.taskDate} • ${next.officeTime || '--:--'}` : 'No upcoming', '#22c55e')}
      </View>

      <Text style={s.sectionTitle}>Upcoming Schedule</Text>
      {mySchedule.length === 0 ? (
        <Text style={s.muted}>No assignments found.</Text>
      ) : (
        mySchedule.map((r, i) => (
          <View key={i} style={s.scheduleCard}>
            <View style={{ flex: 1 }}>
              <Text style={s.jobTitle}>{r.projectName || r.project || 'Task'}</Text>
              <Text style={s.muted}>{r.taskDate}</Text>
              <Text style={s.muted}>Office: {r.officeTime || '--:--'} · Site: {r.siteTime || '--:--'}</Text>
              <Text style={s.muted}>Site: {r.site || 'All Sites'}</Text>
            </View>
            {r.location ? (
              <TouchableOpacity onPress={() => Linking.openURL(normalizeUrl(r.location))}>
                <Text style={{ color: '#2563eb', fontWeight: '700' }}>Map</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const toMinutes = (t) => {
  if (!t || !/^\d{2}:\d{2}/.test(t)) return 24 * 60 + 1;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

function pickNext(rows) {
  const todayNum = Number(todayStr().replace(/-/g, ''));
  const upcoming = rows
    .map((r) => ({ ...r, dateNum: Number(String(r.taskDate || '').replace(/-/g, '')), timeMin: toMinutes(r.officeTime || r.siteTime) }))
    .filter((r) => r.dateNum >= todayNum)
    .sort((a, b) => (a.dateNum !== b.dateNum ? a.dateNum - b.dateNum : a.timeMin - b.timeMin));
  return upcoming[0] || null;
}

function normalizeUrl(v) {
  if (!v) return '';
  const raw = String(v).trim();
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  hi: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  muted: { color: '#64748b', fontWeight: '600' },
  cards: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  card: {
    flexBasis: '31%',
    flexGrow: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }
  },
  cardTitle: { fontSize: 10, fontWeight: '800', color: '#64748b', letterSpacing: 0.6 },
  cardValue: { fontSize: 20, fontWeight: '900', color: '#0f172a', marginTop: 4 },
  cardSub: { fontSize: 12, fontWeight: '700', color: '#94a3b8', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginTop: 18, marginBottom: 8 },
  scheduleCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  jobTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' }
});
