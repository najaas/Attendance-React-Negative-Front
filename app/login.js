import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from './providers/AuthProvider';

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const handle = async () => {
    setErr('');
    if (!form.username || !form.password) return setErr('All fields required');
    setLoading(true);
    try {
      await login(form.username, form.password);
      router.replace('/');
    } catch (e) {
      setErr(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>AttendTrack Employee</Text>
      <TextInput
        placeholder="Username"
        style={s.input}
        value={form.username}
        onChangeText={(v) => setForm((p) => ({ ...p, username: v }))}
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Password"
        style={s.input}
        value={form.password}
        onChangeText={(v) => setForm((p) => ({ ...p, password: v }))}
        secureTextEntry
      />
      {err ? <Text style={s.error}>{err}</Text> : null}
      <TouchableOpacity style={s.btn} onPress={handle} disabled={loading}>
        {loading ? <ActivityIndicator color="#0f172a" /> : <Text style={s.btnText}>Login</Text>}
      </TouchableOpacity>
      <Text style={s.hint}>Uses the same account as the web portal.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0f172a' },
  title: { fontSize: 22, fontWeight: '800', color: '#fbbf24', marginBottom: 18 },
  input: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 10, fontSize: 15, fontWeight: '600' },
  btn: { backgroundColor: '#fbbf24', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  btnText: { fontWeight: '800', color: '#0f172a' },
  error: { color: '#ef4444', marginBottom: 8, fontWeight: '700' },
  hint: { color: '#cbd5e1', marginTop: 14, fontSize: 12, fontWeight: '600' }
});
