import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from './providers/AuthProvider';
import { apiFetch } from '../lib/api';

export default function History() {
  const { token, loading } = useAuth();
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!token) return;
    setBusy(true);
    apiFetch('/employee-attendance-history', { token })
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((e) => setErr(e.message || 'Load failed'))
      .finally(() => setBusy(false));
  }, [token]);

  if (!loading && !token) return <Redirect href="/login" />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc' }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={s.title}>Attendance History</Text>
      {busy ? <ActivityIndicator color="#0f172a" /> : null}
      {err ? <Text style={s.err}>{err}</Text> : null}

      {rows.length === 0 ? (
        <Text style={s.muted}>No records yet.</Text>
      ) : (
        rows.map((r, i) => (
          <View key={i} style={s.card}>
            <Text style={s.date}>{r.date}</Text>
            <Text style={s.meta}>Office Out: {r.officeEntryTime || '-'}</Text>
            <Text style={s.meta}>Office In: {r.officeExitTime || '-'}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 12 },
  muted: { color: '#64748b', fontWeight: '600' },
  err: { color: '#ef4444', fontWeight: '700', marginBottom: 6 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  date: { fontSize: 15, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  meta: { color: '#475569', fontWeight: '700' }
});
