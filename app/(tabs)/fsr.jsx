import React, { useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, ScrollView, Modal, PanResponder, Alert, RefreshControl } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../providers/AuthProvider';
import { apiFetch } from '../../lib/api';
import { Ionicons } from '@expo/vector-icons';

const C = {
  bg: '#f0f4f8', navy: '#0f172a', white: '#ffffff', muted: '#64748b',
  border: '#e2e8f0', indigo: '#6366f1', green: '#16a34a', greenBg: '#dcfce7',
  red: '#dc2626', redBg: '#fee2e2', amber: '#fbbf24', inputBg: '#f8fafc',
  blue: '#2563eb', blueBg: '#eff6ff', blueBorder: '#bfdbfe',
};
const emptyItem = { jobNo: '', slNo: '', panelRef: '', material: '', qty: '', completionDate: '', doneBy: '' };

function getToday() { return new Date().toLocaleDateString('en-GB').replace(/\//g, '-'); }

function getInitialForm(user) {
  return {
    project: '', jobRef: '', client: '', date: getToday(), purpose: '', timeInOut: '', contact: '', transport: '',
    switchboardRef: '', location: '', serviceDetails: '', observation: '', items: [{ ...emptyItem, slNo: '1' }],
    conclusion: '', techOrg: 'PACIFIC OCEAN', techName: user?.shortName || user?.name || '',
    techDesignation: user?.designation || '', techDate: getToday(), clientOrg: '', clientName: '',
    clientDesignation: '', clientDate: '', othersOrg: '', othersName: '', othersDesignation: '', othersDate: '',
    techSignature: '', clientSignature: '', othersSignature: '', formType: 'table', workDonePlain: ''
  };
}

function safeBtoa(str) {
  try { return btoa(str); } catch (e) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    for (let i = 0; i < str.length; i += 3) {
      const c1 = str.charCodeAt(i) || 0;
      const c2 = str.charCodeAt(i + 1) || 0;
      const c3 = str.charCodeAt(i + 2) || 0;
      const triple = (c1 << 16) | (c2 << 8) | c3;
      output += chars.charAt((triple >> 18) & 0x3F);
      output += chars.charAt((triple >> 12) & 0x3F);
      output += (i + 1 < str.length) ? chars.charAt((triple >> 6) & 0x3F) : '=';
      output += (i + 2 < str.length) ? chars.charAt(triple & 0x3F) : '=';
    }
    return output;
  }
}

function generateSvg(points) {
  if (points.length < 2) return '';
  const minX = Math.min(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y));
  const pad = 10;
  let d = `M ${points[0].x - minX + pad} ${points[0].y - minY + pad}`;
  for (let i = 1; i < points.length; i++) d += ` L ${points[i].x - minX + pad} ${points[i].y - minY + pad}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150"><path d="${d}" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;
}

import Svg, { Path as SvgPath } from 'react-native-svg';

import { Dimensions } from 'react-native';
const { width: screenWidth } = Dimensions.get('window');

function SignaturePad({ value, onChange, label }) {
  const [points, setPoints] = useState([]); // All points, null means finger lift
  const [modalOpen, setModalOpen] = useState(false);
  const padW = screenWidth - 20; 
  const padH = 550; // MASSIVE SIZE as requested

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      setPoints(prev => [...prev, { x: locationX, y: locationY }]);
    },
    onPanResponderMove: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      setPoints(prev => [...prev, { x: locationX, y: locationY }]);
    },
    onPanResponderRelease: () => {
      setPoints(prev => [...prev, null]); // Mark end of stroke
    }
  })).current;

  const clear = () => setPoints([]);
  
  const getD = (pts) => {
    if (!pts || pts.length === 0) return '';
    let d = '';
    let start = true;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p === null) { start = true; continue; }
      if (start) {
        d += `M ${p.x} ${p.y} `;
        start = false;
      } else {
        d += `L ${p.x} ${p.y} `;
      }
    }
    return d.trim();
  };

  const done = () => {
    const d = getD(points);
    if (!d) { setModalOpen(false); return; }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${padW}" height="${padH}"><path d="${d}" stroke="#000" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;
    onChange(`data:image/svg+xml;base64,${safeBtoa(svg)}`);
    setModalOpen(false);
  };

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={sty.label}>{label}</Text>
      <TouchableOpacity onPress={() => { setModalOpen(true); }} style={[sty.input, { height: 48, justifyContent: 'center' }]}>
        {value ? <Text style={{ fontSize: 13, color: C.green, fontWeight: '800' }}>Signature Saved ✅</Text>
          : <Text style={{ fontSize: 13, color: C.muted, fontWeight: '700' }}>Tap to Sign (Large Box)</Text>}
      </TouchableOpacity>
      <Modal visible={modalOpen} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: C.border, alignItems: 'center', marginTop: 40, backgroundColor: '#fff' }}>
            <View>
              <Text style={{ fontSize: 16, fontWeight: '900', color: C.navy }}>{label}</Text>
              <Text style={{ fontSize: 10, color: C.green, fontWeight: '700' }}>MAX SIZE - V4</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={clear} style={{ backgroundColor: C.redBg, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}>
                <Text style={{ color: C.red, fontWeight: '800' }}>CLEAR</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={done} style={{ backgroundColor: C.green, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>DONE</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ flex: 1, padding: 10, justifyContent: 'center' }}>
            <View style={{ width: padW, height: padH, borderWidth: 3, borderColor: C.navy, borderRadius: 16, backgroundColor: '#fff', overflow: 'hidden' }} {...panResponder.panHandlers}>
              <Svg width={padW} height={padH}>
                <SvgPath d={getD(points)} stroke="#000" strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={{ textAlign: 'center', marginTop: 15, color: C.muted, fontWeight: '600' }}>Sign inside the large box above.</Text>
            <TouchableOpacity onPress={() => setModalOpen(false)} style={{ marginTop: 20, alignSelf: 'center' }}>
              <Text style={{ color: C.red, fontWeight: '800' }}>CANCEL / CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function FormInput({ label, value, onChangeText, placeholder, multiline, numberOfLines }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={sty.label}>{label}</Text>
      <TextInput style={[sty.input, multiline && { minHeight: (numberOfLines || 3) * 22, textAlignVertical: 'top' }]} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={C.muted} multiline={multiline} numberOfLines={numberOfLines} />
    </View>
  );
}

export default function FSR() {
  const { token, user, loading } = useAuth();
  const [fsrs, setFsrs] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(() => getInitialForm(user));
  const [formBusy, setFormBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { if (token) { loadFsrs(); loadSchedules(); } }, [token]);
  useEffect(() => { if (user) setForm(prev => ({ ...prev, techName: user.shortName || user.name || prev.techName, techDesignation: user.designation || prev.techDesignation })); }, [user]);

  const loadFsrs = async () => {
    setBusy(true); setErr('');
    try { 
      const data = await apiFetch('/fsr', { token }); 
      const list = Array.isArray(data) ? data : [];
      if (user?.role === 'admin') {
        setFsrs(list);
      } else {
        const uName = String(user?.name || '').trim().toLowerCase();
        const uShort = String(user?.shortName || '').trim().toLowerCase();
        const uUsername = String(user?.username || '').trim().toLowerCase();
        const filtered = list.filter(f => {
          // Exactly match web app logic: Show if pending OR (no status and no tech signature)
          const isPending = f.status === 'pending' || (!f.status && !f.techSignature);
          if (!isPending) return false;

          const tName = String(f.techName || '').trim().toLowerCase();
          const isSubmitter = tName && (tName === uName || tName === uShort);
          
          let isAssigned = false;
          if (f.assignedEmployees && Array.isArray(f.assignedEmployees)) {
            isAssigned = f.assignedEmployees.some(emp => {
              const val = String(emp || '').trim().toLowerCase();
              return (uUsername && val === uUsername) || 
                     (uName && val === uName) || 
                     (uShort && val === uShort);
            });
          }
          return isSubmitter || isAssigned;
        });
        setFsrs(filtered);
      }
    }
    catch (e) { setErr(e.message || 'Failed to load FSRs'); }
    finally { setBusy(false); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([loadFsrs(), loadSchedules()]);
    setRefreshing(false);
  };

  const loadSchedules = async () => {
    try {
      const todayIso = new Date().toISOString().split('T')[0];
      // Fetch recent to get yesterday, today, tomorrow, so we catch tasks updated today
      const data = await apiFetch('/schedule?date=recent', { token });
      const list = Array.isArray(data) ? data : [];
      // Filter schedules: must be assigned to current user, and must be for today (either taskDate or statusDate)
      const mySchedules = list.filter(s => {
        const isAssigned = normalize(s.assignedToUsername) === normalize(user?.username) || 
                           normalize(s.assignedToName) === normalize(user?.name) ||
                           normalize(s.assignedToShortName) === normalize(user?.shortName);
        const isToday = s.taskDate === todayIso || s.statusDate === todayIso;
        const isCompleted = s.status === 'completed';
        return isAssigned && isToday && !isCompleted;
      });
      setSchedules(mySchedules);
    } catch (e) { 
      console.error('Failed to load schedules', e); 
      setSchedules([]);
    }
  };

  const normalize = (v) => String(v || '').trim().toLowerCase();

  const applySchedule = (schedule, forced = {}) => {
    if (!schedule) return;
    const project = String(forced.project ?? schedule.projectName ?? '').trim();
    const jobRef = String(forced.jobRef ?? schedule.jobNumber ?? '').trim();
    const client = String(schedule.customerName || '').trim();
    const contact = String(schedule.customerPerson || schedule.customerContact || '').trim();
    const transport = String(schedule.vehicle || '').trim();
    const location = String(schedule.site || '').trim();
    const serviceDetails = String(schedule.description || schedule.title || schedule.remarks || '').trim();
    setForm(prev => ({ 
      ...prev, 
      project: project || prev.project, 
      jobRef: jobRef || prev.jobRef, 
      client: client || prev.client, 
      contact: contact || prev.contact, 
      transport: transport || prev.transport, 
      location: location || prev.location, 
      serviceDetails: serviceDetails || prev.serviceDetails 
    }));
  };

  const handleProjectSelect = (project) => {
    setForm(prev => ({ ...prev, project }));
    if (!project) return;
    const matches = schedules.filter(s => normalize(s?.projectName) === normalize(project));
    if (matches.length >= 1) applySchedule(matches[0], { project, jobRef: matches[0]?.jobNumber || '' });
  };

  const handleJobRefSelect = (jobRef) => {
    setForm(prev => ({ ...prev, jobRef }));
    if (!jobRef) return;
    const picked = schedules.find(s => {
      const sameJob = normalize(s?.jobNumber) === normalize(jobRef);
      if (!sameJob) return false;
      if (!form.project) return true;
      return normalize(s?.projectName) === normalize(form.project);
    });
    if (picked) applySchedule(picked, { project: form.project || picked.projectName || '', jobRef });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...form.items];
    newItems[index][field] = value;
    setForm(prev => ({ ...prev, items: newItems }));
  };

  const addItem = () => setForm(prev => ({ ...prev, items: [...prev.items, { ...emptyItem, slNo: String(prev.items.length + 1) }] }));
  const removeItem = (index) => {
    if (form.items.length <= 1) return;
    const newItems = form.items.filter((_, i) => i !== index);
    newItems.forEach((item, i) => item.slNo = String(i + 1));
    setForm(prev => ({ ...prev, items: newItems }));
  };

  const handleSubmit = async () => {
    if (!form.techSignature) {
      Alert.alert('Signature Required', 'You must sign the TECHNICIAN SIGNATURE box to mark this report as completed.');
      return;
    }

    setFormBusy(true); setErr(''); setMsg('');
    try {
      const url = editingId ? `/fsr/${editingId}` : '/fsr';
      const method = editingId ? 'PUT' : 'POST';
      await apiFetch(url, { method, token, body: form });
      setMsg(editingId ? 'FSR updated successfully' : 'FSR saved successfully');
      setTimeout(() => setMsg(''), 3000);
      setShowForm(false);
      setEditingId(null);
      setForm(getInitialForm(user));
      loadFsrs();
      loadSchedules();
    } catch (e) {
      setErr(e.message || 'Failed to save FSR');
    } finally {
      setFormBusy(false);
    }
  };

  const handleEdit = (fsr) => { 
    setForm({ 
      ...fsr,
      techName: user?.role === 'admin' ? fsr.techName : (user?.shortName || user?.name || fsr.techName),
      techDesignation: user?.role === 'admin' ? fsr.techDesignation : (user?.designation || fsr.techDesignation)
    }); 
    setEditingId(fsr._id); 
    setShowForm(true); 
  };

  const handleDelete = (id) => {
    Alert.alert('Delete FSR', 'Are you sure you want to delete this FSR?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await apiFetch(`/fsr/${id}`, { method: 'DELETE', token }); setFsrs(prev => prev.filter(f => f._id !== id)); setMsg('FSR deleted'); setTimeout(() => setMsg(''), 3000); }
        catch (e) { setErr(e.message || 'Failed to delete'); }
      }}
    ]);
  };

  const openNew = () => { setForm(getInitialForm(user)); setEditingId(null); setShowForm(true); };
  const isAdmin = user?.role === 'admin';

  const projectOptions = [...new Set(schedules.map(s => String(s?.projectName || '').trim()).filter(Boolean))];
  const jobOptions = [...new Set((form.project ? schedules.filter(s => normalize(s?.projectName) === normalize(form.project)) : schedules).map(s => String(s?.jobNumber || '').trim()).filter(Boolean))];

  if (!loading && !token) return <Redirect href="/login" />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.blue]} />}
        data={fsrs}
        keyExtractor={item => item._id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListHeaderComponent={
          <>
            <Text style={sty.pageTitle}>Field Service Reports</Text>

            {/* --- Tasks for Today Section --- */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 14, fontWeight: '900', color: C.navy, marginBottom: 12 }}>YOUR TASKS FOR TODAY</Text>
              {schedules.filter(s => s.status !== 'completed').length === 0 ? (
                <View style={{ padding: 24, borderRadius: 12, borderStyle: 'dashed', borderWidth: 1.5, borderColor: C.border, alignItems: 'center' }}>
                  {/* <Text style={{ color: C.muted, fontSize: 12, fontWeight: '600' }}>No tasks assigned for today.</Text> */}
                </View>
              ) : (
                schedules.filter(s => s.status !== 'completed').map((s, i) => (
                  <TouchableOpacity 
                    key={i} 
                    onPress={() => { openNew(); applySchedule(s); }}
                    style={{ 
                      backgroundColor: '#fff', 
                      padding: 16, 
                      borderRadius: 12, 
                      marginBottom: 10, 
                      borderWidth: 1, 
                      borderColor: s.status === 'completed' ? '#22c55e' : C.border,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: C.navy }}>{s.projectName || 'Project'}</Text>
                      <Text style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Job: {s.jobNumber || 'N/A'}</Text>
                    </View>
                    <View style={{ 
                      paddingHorizontal: 8, 
                      paddingVertical: 4, 
                      borderRadius: 6, 
                      backgroundColor: s.status === 'completed' ? '#dcfce7' : '#fee2e2' 
                    }}>
                      <Text style={{ 
                        fontSize: 10, 
                        fontWeight: '900', 
                        color: s.status === 'completed' ? '#15803d' : '#b91c1c' 
                      }}>
                        {s.status === 'completed' ? '✅ DONE' : '🔴 PENDING'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
            <TouchableOpacity onPress={openNew} style={sty.addBtn}>
              <Text style={sty.addBtnText}>+ New FSR</Text>
            </TouchableOpacity>
            {busy && <ActivityIndicator color={C.indigo} style={{ marginVertical: 12 }} />}
            {msg ? <View style={sty.alertGreen}><Text style={sty.alertGreenText}>{msg}</Text></View> : null}
            {err ? <View style={sty.alertRed}><Text style={sty.alertRedText}>{err}</Text></View> : null}
          </>
        }
        ListEmptyComponent={!busy ? <View style={sty.emptyBox}><Text style={sty.emptyText}>No FSRs found</Text></View> : null}
        renderItem={({ item }) => (
          <View style={sty.fsrCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <Text style={sty.fsrTitle} numberOfLines={2}>{item.project || 'Untitled'}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => handleEdit(item)} style={{ padding: 6, backgroundColor: C.blueBg, borderRadius: 8 }}>
                  <Ionicons name="create-outline" size={16} color={C.blue} />
                </TouchableOpacity>
                {isAdmin && (
                  <TouchableOpacity onPress={() => handleDelete(item._id)} style={{ padding: 6, backgroundColor: C.redBg, borderRadius: 8 }}>
                    <Ionicons name="trash-outline" size={16} color={C.red} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <View style={sty.metaGrid}>
              {[
                ['Date', item.date || '-'],
                ['Client', item.client || '-'],
                ['Job Ref', item.jobRef || '-'],
                ['Purpose', item.purpose || '-'],
              ].map(([label, value]) => (
                <View key={label} style={sty.metaItem}>
                  <Text style={sty.metaLabel}>{label}</Text>
                  <Text style={sty.metaValue} numberOfLines={1}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      />

      <Modal visible={showForm} animationType="slide">
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: C.navy, paddingTop: 50 }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: '#fff' }}>{editingId ? 'Edit FSR' : 'New FSR'}</Text>
            <TouchableOpacity onPress={() => setShowForm(false)} style={{ padding: 8 }}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {schedules.filter(s => s.status !== 'completed').length > 0 && (
              <View style={{ backgroundColor: C.blueBg, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: C.blueBorder }}>
                <Text style={{ fontSize: 11, fontWeight: '900', color: C.blue, marginBottom: 8 }}>AUTO-FILL FROM SCHEDULE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                  {schedules.filter(s => s.status !== 'completed').slice(0, 8).map((s, i) => (
                    <TouchableOpacity key={i} onPress={() => applySchedule(s)} style={{ backgroundColor: C.white, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: C.blueBorder }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: C.blue }} numberOfLines={1}>{s.projectName || 'Project'}</Text>
                      <Text style={{ fontSize: 10, fontWeight: '600', color: C.muted }}>{s.jobNumber || ''}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <Text style={{ fontSize: 16, fontWeight: '900', color: C.navy, marginBottom: 12 }}>Basic Information</Text>
            <FormInput label="Project Name" value={form.project} onChangeText={v => setForm(p => ({ ...p, project: v }))} placeholder="Enter Project Name" />
            <FormInput label="Client Organization" value={form.client} onChangeText={v => setForm(p => ({ ...p, client: v }))} placeholder="Enter Client" />
            <FormInput label="Job Reference No." value={form.jobRef} onChangeText={v => setForm(p => ({ ...p, jobRef: v }))} placeholder="Enter Job Ref" />
            <FormInput label="Purpose of Visit" value={form.purpose} onChangeText={v => setForm(p => ({ ...p, purpose: v }))} placeholder="Enter Purpose" />
            <FormInput label="Report Date" value={form.date} onChangeText={v => setForm(p => ({ ...p, date: v }))} placeholder="DD-MM-YYYY" />
            <FormInput label="Site Contact Person" value={form.contact} onChangeText={v => setForm(p => ({ ...p, contact: v }))} placeholder="Enter Contact" />
            <FormInput label="Time In / Time Out" value={form.timeInOut} onChangeText={v => setForm(p => ({ ...p, timeInOut: v }))} placeholder="e.g. 08:00 - 17:00" />
            <FormInput label="Switchboard Reference" value={form.switchboardRef} onChangeText={v => setForm(p => ({ ...p, switchboardRef: v }))} placeholder="Enter Ref" />
            <FormInput label="Transportation" value={form.transport} onChangeText={v => setForm(p => ({ ...p, transport: v }))} placeholder="Method" />
            <FormInput label="Location" value={form.location} onChangeText={v => setForm(p => ({ ...p, location: v }))} placeholder="Site Location" />

            <Text style={{ fontSize: 16, fontWeight: '900', color: C.navy, marginTop: 16, marginBottom: 12 }}>Details</Text>
            <FormInput label="Service Details / Reason for Call" value={form.serviceDetails} onChangeText={v => setForm(p => ({ ...p, serviceDetails: v }))} placeholder="Describe work done..." multiline numberOfLines={4} />
            <FormInput label="Observations" value={form.observation} onChangeText={v => setForm(p => ({ ...p, observation: v }))} placeholder="Any site observations..." multiline numberOfLines={4} />

            <Text style={{ fontSize: 16, fontWeight: '900', color: C.navy, marginTop: 16, marginBottom: 12 }}>Report Format</Text>
            <View style={{ flexDirection: 'row', backgroundColor: C.white, borderRadius: 12, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: C.border }}>
              <TouchableOpacity onPress={() => setForm(p => ({ ...p, formType: 'table' }))} style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: form.formType === 'table' || !form.formType ? C.navy : 'transparent' }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: form.formType === 'table' || !form.formType ? C.amber : C.muted }}>Standard FSR</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setForm(p => ({ ...p, formType: 'plain' }))} style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: form.formType === 'plain' ? C.navy : 'transparent' }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: form.formType === 'plain' ? C.amber : C.muted }}>Form 2 (Plain)</Text>
              </TouchableOpacity>
            </View>

            {(form.formType === 'table' || !form.formType) ? (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: C.navy }}>Work Done List</Text>
                  <TouchableOpacity onPress={addItem} style={{ backgroundColor: C.blueBg, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 }}>
                    <Text style={{ color: C.blue, fontWeight: '800', fontSize: 12 }}>+ Add Row</Text>
                  </TouchableOpacity>
                </View>
                {form.items.map((item, i) => (
                  <View key={i} style={{ backgroundColor: C.white, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                      <Text style={{ fontSize: 12, fontWeight: '900', color: C.muted }}>Row {i + 1}</Text>
                      {form.items.length > 1 && (
                        <TouchableOpacity onPress={() => removeItem(i)}>
                          <Ionicons name="close-circle" size={20} color={C.red} />
                        </TouchableOpacity>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TextInput style={[sty.itemInput, { flex: 1 }]} placeholder="Job#" value={item.jobNo} onChangeText={v => handleItemChange(i, 'jobNo', v)} />
                      <TextInput style={[sty.itemInput, { flex: 1 }]} placeholder="SL#" value={item.slNo} onChangeText={v => handleItemChange(i, 'slNo', v)} />
                    </View>
                    <TextInput style={sty.itemInput} placeholder="Panel Reference" value={item.panelRef} onChangeText={v => handleItemChange(i, 'panelRef', v)} />
                    <TextInput style={sty.itemInput} placeholder="Material / Description" value={item.material} onChangeText={v => handleItemChange(i, 'material', v)} />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TextInput style={[sty.itemInput, { flex: 1 }]} placeholder="QTY" value={item.qty} onChangeText={v => handleItemChange(i, 'qty', v)} />
                      <TextInput style={[sty.itemInput, { flex: 1 }]} placeholder="Completion Date" value={item.completionDate} onChangeText={v => handleItemChange(i, 'completionDate', v)} />
                      <TextInput style={[sty.itemInput, { flex: 1 }]} placeholder="Done By" value={item.doneBy} onChangeText={v => handleItemChange(i, 'doneBy', v)} />
                    </View>
                  </View>
                ))}
              </>
            ) : (
              <FormInput label="Work Done (Form 2)" value={form.workDonePlain} onChangeText={v => setForm(p => ({ ...p, workDonePlain: v }))} placeholder="Describe the work carried out in detail..." multiline numberOfLines={6} />
            )}

            <Text style={{ fontSize: 16, fontWeight: '900', color: C.navy, marginTop: 16, marginBottom: 12 }}>Conclusion</Text>
            <FormInput label="Conclusion" value={form.conclusion} onChangeText={v => setForm(p => ({ ...p, conclusion: v }))} placeholder="Enter conclusion..." multiline numberOfLines={3} />

            <Text style={{ fontSize: 16, fontWeight: '900', color: C.navy, marginTop: 16, marginBottom: 12 }}>Signatures</Text>

            <View style={{ backgroundColor: C.inputBg, borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <Text style={{ fontSize: 13, fontWeight: '900', color: C.navy, marginBottom: 10 }}>Service Engineer</Text>
              <FormInput label="Organization" value={form.techOrg} onChangeText={v => setForm(p => ({ ...p, techOrg: v }))} placeholder="Organization" />
              <FormInput label="Name" value={form.techName} onChangeText={v => setForm(p => ({ ...p, techName: v }))} placeholder="Name" />
              <FormInput label="Designation" value={form.techDesignation} onChangeText={v => setForm(p => ({ ...p, techDesignation: v }))} placeholder="Designation" />
              <SignaturePad label="TECHNICIAN SIGNATURE" value={form.techSignature} onChange={v => setForm(p => ({ ...p, techSignature: v }))} />
              <FormInput label="Date" value={form.techDate} onChangeText={v => setForm(p => ({ ...p, techDate: v }))} placeholder="Date" />
            </View>

            <View style={{ backgroundColor: C.white, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.border }}>
              <Text style={{ fontSize: 13, fontWeight: '900', color: C.navy, marginBottom: 10 }}>Client / Customer</Text>
              <FormInput label="Organization" value={form.clientOrg} onChangeText={v => setForm(p => ({ ...p, clientOrg: v }))} placeholder="Organization" />
              <FormInput label="Name" value={form.clientName} onChangeText={v => setForm(p => ({ ...p, clientName: v }))} placeholder="Name" />
              <FormInput label="Designation" value={form.clientDesignation} onChangeText={v => setForm(p => ({ ...p, clientDesignation: v }))} placeholder="Designation" />
              <SignaturePad label="CLIENT SIGNATURE" value={form.clientSignature} onChange={v => setForm(p => ({ ...p, clientSignature: v }))} />
              <FormInput label="Date" value={form.clientDate} onChangeText={v => setForm(p => ({ ...p, clientDate: v }))} placeholder="Date" />
            </View>

            <View style={{ backgroundColor: '#fefce8', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#fef08a' }}>
              <Text style={{ fontSize: 13, fontWeight: '900', color: C.navy, marginBottom: 10 }}>Others</Text>
              <FormInput label="Organization" value={form.othersOrg} onChangeText={v => setForm(p => ({ ...p, othersOrg: v }))} placeholder="Organization" />
              <FormInput label="Name" value={form.othersName} onChangeText={v => setForm(p => ({ ...p, othersName: v }))} placeholder="Name" />
              <FormInput label="Designation" value={form.othersDesignation} onChangeText={v => setForm(p => ({ ...p, othersDesignation: v }))} placeholder="Designation" />
              <SignaturePad label="OTHER SIGNATURE" value={form.othersSignature} onChange={v => setForm(p => ({ ...p, othersSignature: v }))} />
              <FormInput label="Date" value={form.othersDate} onChangeText={v => setForm(p => ({ ...p, othersDate: v }))} placeholder="Date" />
            </View>

            <TouchableOpacity onPress={handleSubmit} disabled={formBusy} style={[sty.submitBtn, formBusy && { opacity: 0.6 }]}>
              <Text style={sty.submitBtnText}>{formBusy ? 'Saving...' : (editingId ? 'Update FSR' : 'Save FSR')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const sty = StyleSheet.create({
  pageTitle: { fontSize: 26, fontWeight: '900', color: C.navy, marginBottom: 16 },
  addBtn: { backgroundColor: C.indigo, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 16 },
  addBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  alertGreen: { backgroundColor: C.greenBg, borderRadius: 10, padding: 12, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: C.green },
  alertGreenText: { color: '#166534', fontWeight: '700', fontSize: 13 },
  alertRed: { backgroundColor: C.redBg, borderRadius: 10, padding: 12, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: C.red },
  alertRedText: { color: C.red, fontWeight: '700', fontSize: 13 },
  emptyBox: { backgroundColor: C.white, borderRadius: 12, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  emptyText: { color: C.muted, fontWeight: '700' },
  fsrCard: { backgroundColor: C.white, borderRadius: 16, padding: 16, marginBottom: 14, borderLeftWidth: 4, borderLeftColor: C.indigo, borderWidth: 1, borderColor: C.border },
  fsrTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: C.navy },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaItem: { width: '47%', backgroundColor: C.inputBg, borderRadius: 8, padding: 8 },
  metaLabel: { fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 0.4, marginBottom: 2 },
  metaValue: { fontSize: 12, fontWeight: '800', color: C.navy },
  label: { fontSize: 10, fontWeight: '800', color: C.muted, letterSpacing: 0.8, marginBottom: 6, textTransform: 'uppercase' },
  input: { backgroundColor: C.white, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontWeight: '700', color: C.navy },
  itemInput: { backgroundColor: C.inputBg, borderRadius: 8, borderWidth: 1, borderColor: C.border, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, fontWeight: '700', color: C.navy, marginBottom: 8 },
  submitBtn: { backgroundColor: C.green, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16, marginBottom: 40 },
  submitBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
});
