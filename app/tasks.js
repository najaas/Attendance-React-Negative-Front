import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from './providers/AuthProvider';
import { apiFetch } from '../lib/api';

export default function Tasks() {
  const { token, loading } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!token) return;
    setBusy(true);
    apiFetch('/tasks?date=all', { token })
      .then((data) => setTasks(Array.isArray(data) ? data : []))
      .catch((e) => setErr(e.message || 'Load failed'))
      .finally(() => setBusy(false));
  }, [token]);

  if (!loading && !token) return <Redirect href="/login" />;

  const complete = async (taskId) => {
    setBusy(true);
    setErr('');
    try {
      const data = await apiFetch(`/tasks/${taskId}/complete`, { method: 'PUT', token, body: { completionNote: '' } });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? data : t)));
      setMsg('Task marked completed');
    } catch (e) {
      setErr(e.message || 'Complete failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc' }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={s.title}>My Tasks</Text>
      {busy ? <ActivityIndicator color="#0f172a" /> : null}
      {msg ? <Text style={s.msg}>{msg}</Text> : null}
      {err ? <Text style={s.err}>{err}</Text> : null}

      {tasks.length === 0 ? (
        <Text style={s.muted}>No tasks assigned.</Text>
      ) : (
        tasks.map((t) => {
          const completed = t.status === 'completed';
          return (
            <View key={t.id} style={[s.card, { borderLeftColor: completed ? '#16a34a' : '#dc2626' }]}>
              <Text style={s.cardTitle}>{t.title}</Text>
              <Text style={s.muted}>{t.description || '-'}</Text>
              <Text style={s.meta}>Job: {t.jobNumber || t.jobNo || '-'}</Text>
              <Text style={s.meta}>Date: {t.taskDate || '-'}</Text>
              {completed ? (
                <Text style={[s.meta, { color: '#16a34a' }]}>Completed</Text>
              ) : (
                <TouchableOpacity style={s.btn} onPress={() => complete(t.id)} disabled={busy}>
                  <Text style={s.btnText}>Mark Completed</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0', borderLeftWidth: 4 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  muted: { color: '#64748b', fontWeight: '600', marginBottom: 4 },
  meta: { color: '#475569', fontWeight: '700', marginBottom: 2 },
  btn: { marginTop: 8, backgroundColor: '#0f172a', padding: 10, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fbbf24', fontWeight: '800' },
  msg: { color: '#16a34a', fontWeight: '700', marginBottom: 6 },
  err: { color: '#ef4444', fontWeight: '700', marginBottom: 6 }
});
