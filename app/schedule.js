import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from './providers/AuthProvider';
import { apiFetch } from '../lib/api';

export default function Schedule() {
  const { token, loading, user } = useAuth();
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!token) return;
    setBusy(true);
    apiFetch('/schedule?date=recent', { token })
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((e) => setErr(e.message || 'Load failed'))
      .finally(() => setBusy(false));
  }, [token]);

  if (!loading && !token) return <Redirect href="/login" />;

  const mine = rows.filter(
    (r) =>
      (r.assignedToUsername && r.assignedToUsername === user?.username) ||
      (r.assignedToName && r.assignedToName === user?.name)
  );

  const grouped = groupByDate(mine);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc' }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={s.title}>My Schedule</Text>
      {busy ? <ActivityIndicator color="#0f172a" /> : null}
      {err ? <Text style={s.err}>{err}</Text> : null}

      {Object.keys(grouped).length === 0 ? (
        <Text style={s.muted}>No upcoming schedule.</Text>
      ) : (
        Object.entries(grouped).map(([date, list]) => (
          <View key={date} style={s.dateCard}>
            <Text style={s.date}>{date}</Text>
            {list.map((r, i) => (
              <View key={i} style={s.item}>
                <Text style={s.job}>{r.projectName || r.project || 'Task'}</Text>
                <Text style={s.meta}>Office: {r.officeTime || '--:--'} · Site: {r.siteTime || '--:--'}</Text>
                <Text style={s.meta}>Site: {r.site || 'All Sites'}</Text>
                {r.location ? (
                  <TouchableOpacity onPress={() => Linking.openURL(normalizeUrl(r.location))}>
                    <Text style={s.link}>Open Map</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

function groupByDate(rows) {
  return rows.reduce((acc, r) => {
    const d = r.taskDate || 'Unknown';
    acc[d] = acc[d] || [];
    acc[d].push(r);
    return acc;
  }, {});
}

function normalizeUrl(v) {
  if (!v) return '';
  const raw = String(v).trim();
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

const s = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 12 },
  muted: { color: '#64748b', fontWeight: '600' },
  err: { color: '#ef4444', fontWeight: '700', marginBottom: 6 },
  dateCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  date: { fontSize: 14, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  item: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  job: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  meta: { color: '#475569', fontWeight: '700', marginTop: 2 },
  link: { color: '#2563eb', fontWeight: '800', marginTop: 4 }
});
