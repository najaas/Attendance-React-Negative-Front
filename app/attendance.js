import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from './providers/AuthProvider';
import { apiFetch } from '../lib/api';

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const emptySite = { location: '', jobNumber: '', entry: '', exit: '', projectName: '', customerName: '', vehicle: '' };

export default function Attendance() {
  const { token, loading, user } = useAuth();
  const [form, setForm] = useState({ officeEntryTime: '', officeExitTime: '', sites: [emptySite] });
  const [existing, setExisting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!token) return;
    setBusy(true);
    apiFetch(`/employee-attendance/${todayStr()}`, { token })
      .then((data) => {
        setExisting(data);
        setForm(data || { officeEntryTime: '', officeExitTime: '', sites: [emptySite] });
      })
      .catch(() => setExisting(null))
      .finally(() => setBusy(false));
  }, [token]);

  if (!loading && !token) return <Redirect href="/login" />;

  const updateSite = (idx, key, value) => {
    setForm((prev) => {
      const sites = [...prev.sites];
      sites[idx] = { ...sites[idx], [key]: value };
      return { ...prev, sites };
    });
  };

  const submit = async () => {
    setErr('');
    if (!form.officeEntryTime && !form.officeExitTime) return setErr('Enter at least Office Out or Office In');
    setBusy(true);
    try {
      const method = existing ? 'PUT' : 'POST';
      const payload = buildPayload(todayStr(), form);
      const data = await apiFetch('/employee-attendance', { method, body: payload, token });
      setExisting(data);
      setMsg(existing ? 'Updated' : 'Saved');
    } catch (e) {
      setErr(e.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc' }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={s.title}>Attendance - {todayStr()}</Text>
      {busy ? <ActivityIndicator color="#0f172a" /> : null}
      {msg ? <Text style={s.msg}>{msg}</Text> : null}
      {err ? <Text style={s.err}>{err}</Text> : null}

      <Text style={s.label}>Office Out *</Text>
      <TextInput style={s.input} value={form.officeEntryTime} onChangeText={(v) => setForm((p) => ({ ...p, officeEntryTime: v }))} placeholder="HH:MM" />

      <Text style={s.label}>Office In</Text>
      <TextInput style={s.input} value={form.officeExitTime} onChangeText={(v) => setForm((p) => ({ ...p, officeExitTime: v }))} placeholder="HH:MM" />

      <Text style={[s.label, { marginTop: 14 }]}>Site Visits</Text>
      {form.sites.map((site, i) => (
        <View key={i} style={s.siteCard}>
          <Text style={s.siteTitle}>Site {i + 1}</Text>
          <TextInput style={s.input} placeholder="Location" value={site.location} onChangeText={(v) => updateSite(i, 'location', v)} />
          <TextInput style={s.input} placeholder="Job Number" value={site.jobNumber} onChangeText={(v) => updateSite(i, 'jobNumber', v)} />
          <TextInput style={s.input} placeholder="Entry HH:MM" value={site.entry} onChangeText={(v) => updateSite(i, 'entry', v)} />
          <TextInput style={s.input} placeholder="Exit HH:MM" value={site.exit} onChangeText={(v) => updateSite(i, 'exit', v)} />
        </View>
      ))}
      <TouchableOpacity style={s.addBtn} onPress={() => setForm((p) => ({ ...p, sites: [...p.sites, emptySite] }))}>
        <Text style={s.addBtnText}>+ Add Site</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.submitBtn} onPress={submit} disabled={busy}>
        <Text style={s.submitText}>{busy ? 'Saving...' : existing ? 'Update Attendance' : 'Submit Attendance'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function buildPayload(date, form) {
  const payload = { date, officeEntryTime: form.officeEntryTime || '', officeExitTime: form.officeExitTime || '' };
  form.sites.forEach((site, i) => {
    const idx = i + 1;
    payload[`site${idx}Location`] = site.location || '';
    payload[`site${idx}JobNumber`] = site.jobNumber || '';
    payload[`site${idx}Entry`] = site.entry || '';
    payload[`site${idx}Exit`] = site.exit || '';
  });
  return payload;
}

const s = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '800', color: '#475569', marginTop: 8 },
  input: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginTop: 6, borderWidth: 1, borderColor: '#e2e8f0', fontWeight: '700' },
  siteCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginTop: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  siteTitle: { fontWeight: '800', color: '#0f172a', marginBottom: 6 },
  addBtn: { marginTop: 10, borderWidth: 1, borderColor: '#0f172a', borderRadius: 10, padding: 10, alignItems: 'center' },
  addBtnText: { fontWeight: '800', color: '#0f172a' },
  submitBtn: { marginTop: 16, backgroundColor: '#0f172a', borderRadius: 12, padding: 14, alignItems: 'center' },
  submitText: { color: '#fbbf24', fontWeight: '800' },
  msg: { color: '#16a34a', fontWeight: '700', marginBottom: 6 },
  err: { color: '#ef4444', fontWeight: '700', marginBottom: 6 }
});
