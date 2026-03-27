import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from './providers/AuthProvider';

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handle = async () => {
    setErr('');
    if (!form.username || !form.password) { setErr('Username and password are required'); return; }
    setLoading(true);
    try {
      await login(form.username, form.password);
      router.replace('/(tabs)');
    } catch (e) { setErr(e.message || 'Login failed'); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.root} keyboardShouldPersistTaps="handled">
        <View style={s.topBar} />
        <View style={s.content}>
          <View style={s.brandWrap}>
            <View style={s.logoCircle}>
              <Text style={s.logoText}>AT</Text>
            </View>
            <Text style={s.brand}>AttendTrack</Text>
            <Text style={s.brandSub}>Employee Portal</Text>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Welcome back</Text>
            <Text style={s.cardSub}>Sign in to continue</Text>

            <Text style={s.label}>USERNAME</Text>
            <TextInput style={s.input} placeholder="Enter your username" placeholderTextColor="#94a3b8"
              value={form.username} onChangeText={(v) => setForm((p) => ({ ...p, username: v }))}
              autoCapitalize="none" autoCorrect={false} />

            <Text style={s.label}>PASSWORD</Text>
            <View style={s.passRow}>
              <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder="Enter your password"
                placeholderTextColor="#94a3b8" value={form.password}
                onChangeText={(v) => setForm((p) => ({ ...p, password: v }))} secureTextEntry={!showPass} />
              <TouchableOpacity style={s.showBtn} onPress={() => setShowPass(p => !p)}>
                <Text style={s.showBtnText}>{showPass ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>

            {err ? <View style={s.errorBox}><Text style={s.errorText}>{err}</Text></View> : null}

            <TouchableOpacity style={[s.loginBtn, loading && { opacity: 0.7 }]} onPress={handle} disabled={loading}>
              {loading ? <ActivityIndicator color="#0f172a" /> : <Text style={s.loginBtnText}>Sign In</Text>}
            </TouchableOpacity>
          </View>

          <Text style={s.hint}>Use the same credentials as the web portal</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flexGrow: 1, backgroundColor: '#0f172a' },
  topBar: { height: 4, backgroundColor: '#fbbf24' },
  content: { flex: 1, padding: 24, justifyContent: 'center', paddingVertical: 60 },
  brandWrap: { alignItems: 'center', marginBottom: 36 },
  logoCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#fbbf24', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  logoText: { fontSize: 24, fontWeight: '900', color: '#0f172a' },
  brand: { fontSize: 28, fontWeight: '900', color: '#ffffff' },
  brandSub: { fontSize: 13, color: '#64748b', fontWeight: '700', marginTop: 4 },
  card: { backgroundColor: '#ffffff', borderRadius: 20, padding: 24 },
  cardTitle: { fontSize: 22, fontWeight: '900', color: '#0f172a', marginBottom: 4 },
  cardSub: { fontSize: 13, color: '#64748b', fontWeight: '600', marginBottom: 22 },
  label: { fontSize: 10, fontWeight: '800', color: '#64748b', letterSpacing: 0.8, marginBottom: 6 },
  input: { backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1.5, borderColor: '#e2e8f0', paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  passRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 16 },
  showBtn: { paddingHorizontal: 12, paddingVertical: 13, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e8f0' },
  showBtnText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  errorBox: { backgroundColor: '#fee2e2', borderRadius: 10, padding: 11, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: '#dc2626' },
  errorText: { color: '#b91c1c', fontWeight: '700', fontSize: 13 },
  loginBtn: { backgroundColor: '#fbbf24', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  loginBtnText: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  hint: { color: '#475569', fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 20 },
});