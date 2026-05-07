import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, Linking, Image } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../providers/AuthProvider';
import { apiFetch } from '../../lib/api';

const C = {
  bg: '#f0f4f8', navy: '#0f172a', white: '#ffffff', muted: '#64748b',
  border: '#e2e8f0', indigo: '#6366f1', green: '#16a34a', greenBg: '#dcfce7',
  greenLight: '#f0fdf4', red: '#dc2626', redBg: '#fee2e2', amber: '#fbbf24', inputBg: '#f8fafc',
};

export default function Tasks() {
  const { token, loading } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [notes, setNotes] = useState({});
  const [submittingId, setSubmittingId] = useState(null);
  const [filter, setFilter] = useState('all');

  const sendWhatsApp = async (task) => {
    try {
      const updated = await apiFetch(`/tasks/${task.id}/update`, { method: 'PUT', token, body: { panelPhotosSent: true } });
      setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
    } catch(e) {}
    
    const phone = '971565204410';
    const text = `Panel Photos for Task:\nJob No: ${task.jobNumber || '-'}\nProject: ${task.projectName || '-'}\nCustomer: ${task.customerName || '-'}\n(Photos being sent directly via WhatsApp)`;
    Linking.openURL(`whatsapp://send?phone=${phone}&text=${encodeURIComponent(text)}`);
  };

  useEffect(() => { if (token) load(); }, [token]);

  const load = async () => {
    setBusy(true); setErr('');
    try { const data = await apiFetch('/tasks?date=all', { token }); setTasks(Array.isArray(data) ? data : []); }
    catch (e) { setErr(e.message || 'Load failed'); }
    finally { setBusy(false); }
  };

  if (!loading && !token) return <Redirect href="/login" />;

  const complete = async (taskId) => {
    setSubmittingId(taskId); setErr(''); setMsg('');
    try {
      const data = await apiFetch(`/tasks/${taskId}/complete`, { method: 'PUT', token, body: { completionNote: notes[taskId] || '' } });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? data : t)));
      setNotes((prev) => ({ ...prev, [taskId]: '' }));
      setMsg('Task marked as completed'); setTimeout(() => setMsg(''), 3000);
    } catch (e) { setErr(e.message || 'Failed'); }
    finally { setSubmittingId(null); }
  };

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const in30Days = (t) => {
    const d = new Date(t.taskDate || t.completedAt || t.createdAt || Date.now());
    return d >= thirtyDaysAgo;
  };

  const processedTasks = tasks.filter(t => t.status !== 'completed' || in30Days(t));

  const counts = processedTasks.reduce((a, t) => { a.total++; t.status === 'completed' ? a.done++ : a.pending++; return a; }, { total: 0, pending: 0, done: 0 });
  const filtered = filter === 'all' ? processedTasks : filter === 'pending' ? processedTasks.filter(t => t.status !== 'completed') : processedTasks.filter(t => t.status === 'completed');

  return (
    <View style={s.root}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id ? item.id.toString() : Math.random().toString()}
        contentContainerStyle={s.container}
        initialNumToRender={10}
        windowSize={5}
        ListHeaderComponent={
          <>
            <Text style={s.pageTitle}>My Tasks</Text>

            <View style={s.summaryRow}>
              {[{ num: counts.total, label: 'Total', color: C.indigo }, { num: counts.pending, label: 'Pending', color: C.red }, { num: counts.done, label: 'Done', color: C.green }].map((item) => (
                <View key={item.label} style={[s.summaryCard, { borderLeftColor: item.color }]}>
                  <Text style={[s.summaryNum, { color: item.color }]}>{item.num}</Text>
                  <Text style={s.summaryLabel}>{item.label}</Text>
                </View>
              ))}
            </View>

            <View style={s.filterRow}>
              {[['all', `All (${counts.total})`], ['pending', `Pending (${counts.pending})`], ['completed', `Done (${counts.done})`]].map(([id, label]) => (
                <TouchableOpacity key={id} style={[s.filterBtn, filter === id && s.filterBtnActive]} onPress={() => setFilter(id)}>
                  <Text style={[s.filterBtnText, filter === id && s.filterBtnTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {busy && <ActivityIndicator color={C.indigo} style={{ marginVertical: 12 }} />}
            {msg ? <View style={s.alertGreen}><Text style={s.alertGreenText}>✓  {msg}</Text></View> : null}
            {err ? <View style={s.alertRed}><Text style={s.alertRedText}>{err}</Text></View> : null}
          </>
        }
        ListEmptyComponent={
          !busy ? (
            <View style={s.emptyBox}><Text style={s.emptyText}>No tasks in this category</Text></View>
          ) : null
        }
        renderItem={({ item: task }) => {
          const done = task.status === 'completed';
          const gpsUrl = toGpsUrl(task.location || task.taskLocation);
          return (
            <View style={[s.taskCard, { borderLeftColor: done ? C.green : C.red }]}>
              <View style={s.taskHead}>
                <Text style={s.taskTitle} numberOfLines={2}>{task.title}</Text>
                <View style={[s.badge, { backgroundColor: done ? C.greenBg : C.redBg }]}>
                  <Text style={[s.badgeText, { color: done ? '#166534' : '#b91c1c' }]}>{done ? 'Done' : 'Pending'}</Text>
                </View>
              </View>
              {task.description ? <Text style={s.taskDesc}>{task.description}</Text> : null}
              <View style={s.metaGrid}>
                {[['Job No.', task.jobNumber || task.jobNo || '-'], ['Project', task.projectName || task.project || '-'], ['Customer', task.customerName || task.customer || '-'], ['Date', task.taskDate || '-'], ['Assigned by', task.assignedByUsername || '-']].map(([label, value]) => (
                  <View key={label} style={s.metaItem}>
                    <Text style={s.metaLabel}>{label}</Text>
                    <Text style={s.metaValue} numberOfLines={1}>{value}</Text>
                  </View>
                ))}
              </View>



              {/* Panel Photos Section */}
              <View style={{ backgroundColor: task.panelPhotosSent ? '#f0fdf4' : C.inputBg, borderStyle: task.panelPhotosSent ? 'solid' : 'dashed', borderWidth: 1, borderColor: task.panelPhotosSent ? '#bcf0da' : '#cbd5e1', borderRadius: 12, padding: 14, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ fontSize: 9, fontWeight: '900', color: task.panelPhotosSent ? '#166534' : C.muted, marginBottom: 2 }}>PANEL PHOTOS</Text>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: task.panelPhotosSent ? '#166534' : C.navy }}>{task.panelPhotosSent ? '✅ PHOTOS SENT' : 'NOT SENT YET'}</Text>
                  </View>
                  <TouchableOpacity onPress={() => sendWhatsApp(task)} style={{ backgroundColor: '#25d366', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 }}>
                    <Text style={{ fontSize: 11, fontWeight: '900', color: '#fff' }}>WHATSAPP</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {task.adminNote ? (
                <View style={{ backgroundColor: '#eff6ff', borderRadius: 8, padding: 12, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: '#2563eb' }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#1e40af', marginBottom: 4 }}>ADMIN INSTRUCTIONS</Text>
                  <Text style={{ fontSize: 12, color: '#1e40af', fontWeight: '700' }}>{task.adminNote}</Text>
                </View>
              ) : null}
              {done ? (
                <View style={s.completionNote}>
                  <Text style={s.completionNoteLabel}>COMPLETION NOTE</Text>
                  <Text style={s.completionNoteText}>{task.completionNote || 'Completed without a note'}</Text>
                </View>
              ) : (
                <View style={s.actionArea}>
                  <TextInput style={s.noteInput} multiline numberOfLines={2} placeholder="Add a completion note (optional)..." placeholderTextColor={C.muted} value={notes[task.id] || ''} onChangeText={(v) => setNotes((p) => ({ ...p, [task.id]: v }))} />
                  <TouchableOpacity style={[s.completeBtn, submittingId === task.id && { opacity: 0.6 }]} onPress={() => complete(task.id)} disabled={submittingId === task.id}>
                    <Text style={s.completeBtnText}>{submittingId === task.id ? 'Submitting...' : '✓  Mark as Completed'}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

function toGpsUrl(v) { const raw = String(v || '').trim(); if (!raw) return ''; return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`; }

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  container: { padding: 16, paddingBottom: 40 },
  pageTitle: { fontSize: 26, fontWeight: '900', color: C.navy, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  summaryCard: { flex: 1, backgroundColor: C.white, borderRadius: 12, padding: 14, borderLeftWidth: 3, borderWidth: 1, borderColor: C.border },
  summaryNum: { fontSize: 22, fontWeight: '900' },
  summaryLabel: { fontSize: 11, fontWeight: '600', color: C.muted, marginTop: 2 },
  filterRow: { flexDirection: 'row', backgroundColor: C.white, borderRadius: 12, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  filterBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  filterBtnActive: { backgroundColor: C.navy },
  filterBtnText: { fontSize: 12, fontWeight: '700', color: C.muted },
  filterBtnTextActive: { color: C.amber },
  alertGreen: { backgroundColor: C.greenBg, borderRadius: 10, padding: 12, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: C.green },
  alertGreenText: { color: '#166534', fontWeight: '700', fontSize: 13 },
  alertRed: { backgroundColor: C.redBg, borderRadius: 10, padding: 12, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: C.red },
  alertRedText: { color: C.red, fontWeight: '700', fontSize: 13 },
  emptyBox: { backgroundColor: C.white, borderRadius: 12, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  emptyText: { color: C.muted, fontWeight: '700' },
  taskCard: { backgroundColor: C.white, borderRadius: 16, padding: 16, marginBottom: 14, borderLeftWidth: 4, borderWidth: 1, borderColor: C.border },
  taskHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  taskTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: C.navy },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  taskDesc: { fontSize: 13, color: C.muted, fontWeight: '600', marginBottom: 12, lineHeight: 20 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  metaItem: { width: '47%', backgroundColor: C.inputBg, borderRadius: 8, padding: 8 },
  metaLabel: { fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 0.4, marginBottom: 2 },
  metaValue: { fontSize: 12, fontWeight: '800', color: C.navy },
  mapBtn: { backgroundColor: '#eff6ff', borderRadius: 8, padding: 10, alignItems: 'center', marginBottom: 12 },
  mapBtnText: { color: '#2563eb', fontWeight: '700', fontSize: 12 },
  completionNote: { backgroundColor: C.greenLight, borderRadius: 8, padding: 12 },
  completionNoteLabel: { fontSize: 10, fontWeight: '800', color: '#166534', letterSpacing: 0.4, marginBottom: 4 },
  completionNoteText: { fontSize: 13, color: '#166534', fontWeight: '600' },
  actionArea: { gap: 10 },
  noteInput: { backgroundColor: C.inputBg, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 12, fontSize: 13, color: C.navy, fontWeight: '600', minHeight: 60, textAlignVertical: 'top' },
  completeBtn: { backgroundColor: C.green, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  completeBtnText: { color: C.white, fontWeight: '800', fontSize: 14 },
});