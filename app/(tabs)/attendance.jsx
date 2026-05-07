import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Modal, Alert, StatusBar,
  useWindowDimensions, FlatList
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Redirect } from 'expo-router';
import { useAuth } from '../providers/AuthProvider';
import { apiFetch } from '../../lib/api';
import * as Location from 'expo-location';

const C = {
  bg: '#f8fafc', 
  navy: '#0f172a', 
  navyLight: '#1e293b',
  white: '#ffffff', 
  muted: '#64748b', 
  border: '#e2e8f0',
  indigo: '#6366f1', 
  indigoBg: '#eef2ff', 
  green: '#10b981', 
  greenBg: '#ecfdf5',
  amber: '#f59e0b',
  amberBg: '#fffbeb',
  red: '#ef4444',
  slate: '#94a3b8'
};

const APP_TIMEZONE = 'Asia/Dubai';
const zonedNow = () => {
  try {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: APP_TIMEZONE }));
    if (!Number.isNaN(d.getTime())) return d;
  } catch (e) {}
  return new Date();
};

const EMPTY_RECORD = { officeEntryTime: '', officeExitTime: '', sites: [] };
const EMPTY_SITE = { location: '', jobNumber: '', entry: '', exit: '', projectName: '', customerName: '', vehicle: '' };
const EMPTY_SHIFT = { officeEntryTime: '', officeExitTime: '', sites: [{ ...EMPTY_SITE }] };
const HH_12 = Array.from({length: 12}, (_, i) => String(i === 0 ? 12 : i).padStart(2, '0'));
const MM = Array.from({length: 60}, (_, i) => String(i).padStart(2, '0'));
const PERIODS = ['AM', 'PM'];

function nowRounded() {
  const d = zonedNow();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function todayStr() {
  const d = zonedNow();
  if (d.getHours() < 4) d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function prettyToday() {
  const d = zonedNow();
  if (d.getHours() < 4) d.setDate(d.getDate() - 1);
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}
function formatDisplay(val24) {
  if (!val24 || val24 === '—') return '—';
  try {
    const [h24, m] = val24.split(':').map(Number);
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    const mer = h24 >= 12 ? 'PM' : 'AM';
    return `${String(h12).padStart(2, '0')}:${String(m || 0).padStart(2, '0')} ${mer}`;
  } catch(e) { return val24; }
}

function truncateText(text, max = 56) {
  const value = String(text || '').trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}...`;
}

function jobOptionLabel(job) {
  const title = `${job?.projectName || 'Task'}${job?.jobNumber ? ` (#${job.jobNumber})` : ''}`;
  return truncateText(title, 58);
}


function parseRecord(record) {
  if (!record) return { ...EMPTY_RECORD, sites: [{ ...EMPTY_SITE }] };
  const sites = [];
  for (let i = 1; i <= 6; i++) {
    const loc = record[`site${i}Location`];
    if (loc || record[`site${i}Entry`] || record[`site${i}Exit`] || record[`site${i}JobNumber`]) {
      sites.push({
        location: loc || '',
        jobNumber: record[`site${i}JobNumber`] || '',
        entry: record[`site${i}Entry`] || '',
        exit: record[`site${i}Exit`] || '',
        projectName: record[`site${i}ProjectName`] || '',
        customerName: record[`site${i}CustomerName`] || '',
        vehicle: record[`site${i}Vehicle`] || '',
        entrySubmitTs: record[`site${i}EntrySubmitTs`],
        exitSubmitTs: record[`site${i}ExitSubmitTs`],
      });
    }
  }
  return {
    officeEntryTime: record.officeEntryTime || '',
    officeExitTime: record.officeExitTime || '',
    sites: sites.length > 0 ? sites : [{ ...EMPTY_SITE }],
    officeEntrySubmitTs: record.officeEntrySubmitTs,
    officeExitSubmitTs: record.officeExitSubmitTs,
  };
}

function parseExtraShift(record, prefix = 's2_') {
  if (!record) return { ...EMPTY_SHIFT };
  const sites = [];
  for (let i = 1; i <= 6; i++) {
    const loc = record[`${prefix}site${i}Location`];
    if (loc || record[`${prefix}site${i}Entry`] || record[`${prefix}site${i}Exit`] || record[`${prefix}site${i}JobNumber`]) {
      sites.push({
        location: loc || '',
        jobNumber: record[`${prefix}site${i}JobNumber`] || '',
        entry: record[`${prefix}site${i}Entry`] || '',
        exit: record[`${prefix}site${i}Exit`] || '',
        projectName: record[`${prefix}site${i}ProjectName`] || '',
        customerName: record[`${prefix}site${i}CustomerName`] || '',
        vehicle: record[`${prefix}site${i}Vehicle`] || '',
        entrySubmitTs: record[`${prefix}site${i}EntrySubmitTs`],
        exitSubmitTs: record[`${prefix}site${i}ExitSubmitTs`],
      });
    }
  }
  return {
    officeEntryTime: record[`${prefix}officeEntryTime`] || '',
    officeExitTime: record[`${prefix}officeExitTime`] || '',
    sites: sites.length > 0 ? sites : [{ ...EMPTY_SITE }],
    officeEntrySubmitTs: record[`${prefix}officeEntrySubmitTs`],
    officeExitSubmitTs: record[`${prefix}officeExitSubmitTs`],
  };
}

function buildExtraShiftPayload(date, form, existing, submitMetadata, currentLoc, currentTs, prefix = 's2_') {
  const p = { date, [`${prefix}officeEntryTime`]: form.officeEntryTime || '', [`${prefix}officeExitTime`]: form.officeExitTime || '' };
  const ext = existing ? parseExtraShift(existing, prefix) : null;
  const getMeta = (k) => {
    const m = submitMetadata[k];
    if (m && m.lat) return m;
    if (currentLoc && currentLoc.lat) return { ts: m?.ts || currentTs, lat: currentLoc.lat, lng: currentLoc.lng };
    return { ts: m?.ts || currentTs, lat: m?.lat, lng: m?.lng };
  };
  if (p[`${prefix}officeEntryTime`] && (!ext || !ext.officeEntrySubmitTs)) {
    const { ts, lat, lng } = getMeta(`${prefix}officeEntry`);
    if (ts) { p[`${prefix}officeEntrySubmitTs`] = ts; if (lat) { p[`${prefix}officeEntrySubmitLat`] = lat; p[`${prefix}officeEntrySubmitLng`] = lng; } }
  }
  if (p[`${prefix}officeExitTime`] && (!ext || !ext.officeExitSubmitTs)) {
    const { ts, lat, lng } = getMeta(`${prefix}officeExit`);
    if (ts) { p[`${prefix}officeExitSubmitTs`] = ts; if (lat) { p[`${prefix}officeExitSubmitLat`] = lat; p[`${prefix}officeExitSubmitLng`] = lng; } }
  }
  form.sites.forEach((s, i) => {
    const idx = i + 1;
    p[`${prefix}site${idx}Location`] = s.location || '';
    p[`${prefix}site${idx}JobNumber`] = s.jobNumber || '';
    p[`${prefix}site${idx}Entry`] = s.entry || '';
    p[`${prefix}site${idx}Exit`] = s.exit || '';
    p[`${prefix}site${idx}ProjectName`] = s.projectName || '';
    p[`${prefix}site${idx}CustomerName`] = s.customerName || '';
    const extS = ext && ext.sites && ext.sites[i] ? ext.sites[i] : null;
    if (s.entry && (!extS || !extS.entrySubmitTs)) {
      const { ts, lat, lng } = getMeta(`${prefix}site${idx}Entry`);
      if (ts) { p[`${prefix}site${idx}EntrySubmitTs`] = ts; if (lat) { p[`${prefix}site${idx}EntrySubmitLat`] = lat; p[`${prefix}site${idx}EntrySubmitLng`] = lng; } }
    }
    if (s.exit && (!extS || !extS.exitSubmitTs)) {
      const { ts, lat, lng } = getMeta(`${prefix}site${idx}Exit`);
      if (ts) { p[`${prefix}site${idx}ExitSubmitTs`] = ts; if (lat) { p[`${prefix}site${idx}ExitSubmitLat`] = lat; p[`${prefix}site${idx}ExitSubmitLng`] = lng; } }
    }
  });
  return p;
}

function buildPayload(date, form, existing, submitMetadata, currentLoc, currentTs) {
  const p = { date, officeEntryTime: form.officeEntryTime || '', officeExitTime: form.officeExitTime || '' };
  const ext = existing ? parseRecord(existing) : null;
  const getMeta = (k) => {
    const m = submitMetadata[k];
    if (m && m.lat !== undefined && m.lng !== undefined) return m;
    if (currentLoc && currentLoc.lat !== undefined) return { ts: m?.ts || currentTs, lat: currentLoc.lat, lng: currentLoc.lng };
    return { ts: m?.ts || currentTs, lat: m?.lat, lng: m?.lng };
  };

  if (p.officeEntryTime && (!ext || !ext.officeEntrySubmitTs)) {
    const { ts, lat, lng } = getMeta('officeEntry');
    if (ts) { p.officeEntrySubmitTs = ts; if (lat) { p.officeEntrySubmitLat = lat; p.officeEntrySubmitLng = lng; } }
  }
  if (p.officeExitTime && (!ext || !ext.officeExitSubmitTs)) {
    const { ts, lat, lng } = getMeta('officeExit');
    if (ts) { p.officeExitSubmitTs = ts; if (lat) { p.officeExitSubmitLat = lat; p.officeExitSubmitLng = lng; } }
  }

  form.sites.forEach((s, i) => {
    const idx = i + 1;
    p[`site${idx}Location`] = s.location || '';
    p[`site${idx}JobNumber`] = s.jobNumber || '';
    p[`site${idx}Entry`] = s.entry || '';
    p[`site${idx}Exit`] = s.exit || '';
    p[`site${idx}ProjectName`] = s.projectName || '';
    p[`site${idx}CustomerName`] = s.customerName || '';
    p[`site${idx}Vehicle`] = s.vehicle || '';
    
    const extS = ext && ext.sites && ext.sites[i] ? ext.sites[i] : null;
    if (s.entry && (!extS || !extS.entrySubmitTs)) {
      const { ts, lat, lng } = getMeta(`site${idx}Entry`);
      if (ts) { p[`site${idx}EntrySubmitTs`] = ts; if (lat) { p[`site${idx}EntrySubmitLat`] = lat; p[`site${idx}EntrySubmitLng`] = lng; } }
    }
    if (s.exit && (!extS || !extS.exitSubmitTs)) {
      const { ts, lat, lng } = getMeta(`site${idx}Exit`);
      if (ts) { p[`site${idx}ExitSubmitTs`] = ts; if (lat) { p[`site${idx}ExitSubmitLat`] = lat; p[`site${idx}ExitSubmitLng`] = lng; } }
    }
  });
  return p;
}

export default function Attendance() {
  const { token, user } = useAuth();
  const { width } = useWindowDimensions();
  const isLarge = width > 768;
  const date = todayStr();


  const [form, setForm] = React.useState({ ...EMPTY_RECORD });
  const [existing, setExisting] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [extraForms, setExtraForms] = React.useState({ s2_: { ...EMPTY_SHIFT }, s3_: { ...EMPTY_SHIFT }, s4_: { ...EMPTY_SHIFT }, s5_: { ...EMPTY_SHIFT } });
  const [showRounds, setShowRounds] = React.useState({ s2_: false, s3_: false, s4_: false, s5_: false });

  // Time Picker State
  const [pickModal, setPickModal] = React.useState({ open: false, field: '', h: '12', m: '00', ampm: 'AM', index: -1 });
  const repeatRef = React.useRef(null);

  const stopRepeat = () => {
    if (repeatRef.current) clearInterval(repeatRef.current);
    repeatRef.current = null;
  };

  const adjustDigit = (key, dir) => {
    setPickModal(p => {
      let val = parseInt(p[key]) + dir;
      if (key === 'h') {
        if (val > 12) val = 1;
        if (val < 1) val = 12;
      } else {
        if (val > 59) val = 0;
        if (val < 0) val = 59;
      }
      return { ...p, [key]: String(val).padStart(2, '0') };
    });
  };

  const startRepeat = (key, dir) => {
    stopRepeat();
    adjustDigit(key, dir);
    repeatRef.current = setInterval(() => adjustDigit(key, dir), 120);
  };

  // Custom Status Modal State
  const [statusModal, setStatusModal] = React.useState({ open: false, title: '', message: '', type: 'success' });
  const [errorMsg, setErrorMsg] = React.useState('');
  const showError = (msg) => { setErrorMsg(msg); setTimeout(() => setErrorMsg(''), 4500); };

  const [myJobs, setMyJobs] = React.useState([]);

  const loadData = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    try {
      const [data, schData] = await Promise.all([
        apiFetch(`/attendance/employee-attendance/${date}`, { token }).catch(() => null),
        apiFetch('/schedule?date=recent', { token }).catch(() => [])
      ]);
      setExisting(data);
      setForm(data ? parseRecord(data) : { ...EMPTY_RECORD, sites: [{ ...EMPTY_SITE }] });
      
      const jobs = (schData || []).filter(r => 
        r.taskDate === date && 
        ((r.assignedToUsername && r.assignedToUsername === user?.username) ||
        (r.assignedToName && r.assignedToName === user?.name))
      );
      setMyJobs(jobs);
    } catch (e) {
      setExisting(null); setForm({ ...EMPTY_RECORD, sites: [{ ...EMPTY_SITE }] }); setMyJobs([]);
    } finally { setBusy(false); }
  }, [token, date, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (existing) {
      const eForms = {};
      ['s2_', 's3_', 's4_', 's5_'].forEach(p => {
        eForms[p] = parseExtraShift(existing, p);
      });
      setExtraForms(eForms);
      // Only reveal rounds that have data; never hide ones already shown
      setShowRounds(prev => {
        const next = { ...prev };
        ['s2_', 's3_', 's4_', 's5_'].forEach(p => {
          if (existing[`${p}officeEntryTime`]) next[p] = true;
        });
        return next;
      });
    }
  }, [existing]);

  const updateExtraSite = (prefix, i, k, v) => setExtraForms((p) => {
    const rf = { ...p[prefix] };
    const s = [...rf.sites]; s[i] = { ...s[i], [k]: v };
    return { ...p, [prefix]: { ...rf, sites: s } };
  });

  const submitExtraAction = async (prefix, actionKey, dataOverrides = {}) => {
    setBusy(true);
    let _loc = null;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        try {
          const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, timeout: 8000 });
          _loc = { lat: p.coords.latitude, lng: p.coords.longitude };
        } catch (e) {
          const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest, timeout: 4000 });
          _loc = { lat: p.coords.latitude, lng: p.coords.longitude };
        }
      }
    } catch (e) {
      console.warn("Location error:", e);
    }
    
    if (!_loc || !_loc.lat) {
      showError('GPS Location required to mark attendance.');
      setBusy(false);
      return;
    }
    const _ts = new Date().toLocaleString('en-US', { timeZone: APP_TIMEZONE });
    const meta = { [actionKey]: { ts: _ts, lat: _loc?.lat, lng: _loc?.lng } };
    const activeForm = { ...extraForms[prefix], ...dataOverrides };
    try {
      const data = await apiFetch('/attendance/employee-attendance', {
        method: 'PUT', token,
        body: buildExtraShiftPayload(date, activeForm, existing, meta, _loc, _ts, prefix),
      });
      setExisting(data);
      setExtraForms(p => ({ ...p, [prefix]: parseExtraShift(data, prefix) }));
      setStatusModal({ open: true, title: 'Round Logged', message: 'Shift data securely stored.', type: 'success' });
    } catch (e) {
      setStatusModal({ open: true, title: 'Connection Failed', message: e.message || 'Unavailable', type: 'error' });
    } finally { setBusy(false); }
  };

  if (!token) return <Redirect href="/login" />;

  const updateSite = (i, k, v) => setForm((p) => {
    const s = [...p.sites]; s[i] = { ...s[i], [k]: v }; return { ...p, sites: s };
  });

  const openPicker = (field, currentVal, index = -1) => {
    let [h24, m] = (currentVal || nowRounded()).split(':');
    h24 = parseInt(h24 || '0');
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    setPickModal({ 
      open: true, field, 
      h: String(h12).padStart(2, '0'), 
      m: String(m || '00').padStart(2, '0'), 
      ampm, index 
    });
  };

  const savePicker = () => {
    const { field, h, m, ampm, index } = pickModal;
    let h24 = parseInt(h);
    if (ampm === 'PM' && h24 < 12) h24 += 12;
    if (ampm === 'AM' && h24 === 12) h24 = 0;
    const val = `${String(h24).padStart(2, '0')}:${m}`;
    
    if (field === 'officeEntryTime') setForm(p => ({ ...p, officeEntryTime: val }));
    else if (field === 'officeExitTime') setForm(p => ({ ...p, officeExitTime: val }));
    else if (field === 'siteEntry') updateSite(index, 'entry', val);
    else if (field === 'siteExit') updateSite(index, 'exit', val);
    else if (field.endsWith('siteEntry')) updateExtraSite(field.split('site')[0], index, 'entry', val);
    else if (field.endsWith('siteExit')) updateExtraSite(field.split('site')[0], index, 'exit', val);
    else if (field.endsWith('officeEntryTime')) setExtraForms(p => ({ ...p, [field.split('office')[0]]: { ...p[field.split('office')[0]], officeEntryTime: val } }));
    else if (field.endsWith('officeExitTime')) setExtraForms(p => ({ ...p, [field.split('office')[0]]: { ...p[field.split('office')[0]], officeExitTime: val } }));
    
    setPickModal({ open: false, field: '', h: '12', m: '00', ampm: 'AM', index: -1 });
  };

  const submitAction = async (actionKey, dataOverrides = {}) => {
    setBusy(true);
    let _loc = null;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        try {
          const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, timeout: 8000 });
          _loc = { lat: p.coords.latitude, lng: p.coords.longitude };
        } catch (gpsError) {
          const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest, timeout: 4000 });
          _loc = { lat: p.coords.latitude, lng: p.coords.longitude };
        }
      }
    } catch (e) {
      console.warn("Location error:", e);
    }
    
    if (!_loc || !_loc.lat) {
      showError('GPS Location required to mark attendance.');
      setBusy(false);
      return;
    }
    
    const _ts = new Date().toLocaleString('en-US', { timeZone: APP_TIMEZONE });
    const meta = { [actionKey]: { ts: _ts, lat: _loc?.lat, lng: _loc?.lng } };
    const activeForm = { ...form, ...dataOverrides };

    try {
      const data = await apiFetch('/attendance/employee-attendance', {
        method: existing ? 'PUT' : 'POST', token, 
        body: buildPayload(date, activeForm, existing, meta, _loc, _ts),
      });
      setExisting(data); setForm(parseRecord(data));
      setStatusModal({ open: true, title: 'System Verification', message: 'Tamper-proof log securely stored.', type: 'success' });
    } catch (e) {
      setStatusModal({ open: true, title: 'Connection Failed', message: e.message || 'Verification system unavailable', type: 'error' });
    } finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={s.root} contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" backgroundColor={C.navy} />
      
      <View style={s.headerContainer}>
        <View style={s.topNav}>
          <View style={s.systemBadge}><View style={s.pulseDot} /><Text style={s.systemBadgeText}>LIVE ATTENDANCE ACCESS</Text></View>
        </View>
        <Text style={s.headerName}>Hi, {user?.name?.split(' ')[0]}</Text>
        <Text style={s.headerDate}>{prettyToday()}</Text>
        
        <View style={s.timeFloatingCard}>
          <Text style={s.floatingTime}>{nowRounded()}</Text>
          <Text style={s.floatingLabel}>SYNCED PORTAL TIME</Text>
        </View>
      </View>
      
      {!!errorMsg && (
        <View style={{ backgroundColor: '#fef2f2', padding: 12, marginHorizontal: 25, marginTop: 45, borderRadius: 12, borderWidth: 1.5, borderColor: '#f87171' }}>
           <Text style={{ color: '#b91c1c', fontSize: 13, fontWeight: '900', textAlign: 'center' }}>⚠️ {errorMsg}</Text>
        </View>
      )}

      <View style={[s.content, !!errorMsg ? { paddingTop: 20 } : { paddingTop: 60 }]}>
        {/* Office Out Card */}
        <View style={[s.premiumCard, { borderTopColor: C.indigo, borderTopWidth: 4 }]}>
          <View style={s.cardHeader}>
             <Text style={s.cardCaption}>BASE OPERATIONS</Text>
             <Text style={s.cardMainTitle}>OFFICE (OUT)</Text>
          </View>
          
          {existing?.officeEntrySubmitTs ? (
            <View style={s.lockedView}>
              <Text style={s.lockedVal}>{formatDisplay(existing.officeEntryTime)}</Text>
              <View style={s.lockedTag}><Text style={s.lockedTagText}>📍 SECURED AT SOURCE</Text></View>
            </View>
          ) : (
            <View style={s.actionRow}>
               <View style={s.inputGroup}>
                  <TouchableOpacity style={s.pickerBtn} onPress={() => openPicker('officeEntryTime', form.officeEntryTime)}>
                    <Text style={[s.pickerBtnText, !form.officeEntryTime && { color: C.slate }]}>{form.officeEntryTime || '00:00'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={()=>setForm(p=>({...p, officeEntryTime:nowRounded()}))} style={s.nowBtn}>
                    <Text style={s.nowBtnText}>NOW ⌚</Text>
                  </TouchableOpacity>
               </View>
               <TouchableOpacity style={[s.primaryBtn, { backgroundColor: C.indigo }]} onPress={() => submitAction('officeEntry', { officeEntryTime: form.officeEntryTime || nowRounded() })} disabled={busy}>
                 <Text style={s.primaryBtnText}>SUBMIT LOG</Text>
               </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={s.sectionHeader}>
           <Text style={s.sectionLabel}>ACTIVE DEPLOYMENTS</Text>
           {!existing?.officeExitSubmitTs && (
             <TouchableOpacity style={s.addNodeBtn} onPress={() => setForm(p=>({ ...p, sites:[...p.sites, {...EMPTY_SITE}] }))}>
               <Text style={s.addNodeText}>+ ADD NEW SITE</Text>
             </TouchableOpacity>
           )}
        </View>
        {(form.sites || []).map((site, i) => {
          const extS = existing && parseRecord(existing).sites[i] ? parseRecord(existing).sites[i] : null;
          return (
            <View key={i} style={s.nodeCard}>
              <View style={s.nodeCardHeader}>
                 <Text style={s.nodeTitle}>SITE {i+1} WORKS</Text>
                 {!extS?.entrySubmitTs && (
                    <TouchableOpacity onPress={() => setForm(p=>({ ...p, sites:p.sites.filter((_,idx)=>idx!==i) }))}>
                      <Text style={s.removeText}>DISCARD</Text>
                    </TouchableOpacity>
                 )}
              </View>
              
              <View style={[s.nodeInpRow, { flexDirection: 'column' }]}>
                {myJobs.length > 0 && !extS?.entrySubmitTs && (
                   <View style={{ backgroundColor: C.indigoBg, borderRadius: 12, padding: 0, marginBottom: 5 }}>
                      <Picker
                         selectedValue={`${site.projectName || site.location || ''}||${site.jobNumber || ''}`}
                         onValueChange={(val) => {
                            if (val === '||') return;
                            const [pn, jn] = val.split('||');
                            updateSite(i, 'projectName', pn || '');
                            updateSite(i, 'location', pn || ''); // backwards compat
                            updateSite(i, 'jobNumber', jn || '');
                         }}
                         style={{ color: C.indigo }}
                         dropdownIconColor={C.indigo}
                      >
                         <Picker.Item label="-- Select Scheduled Assignment --" value="||" color={C.indigo} />
                         {myJobs.map((job, jIdx) => (
                            <Picker.Item 
                               key={jIdx} 
                               label={jobOptionLabel(job)}
                               value={`${job.projectName || ''}||${job.jobNumber || ''}`} 
                               color={C.indigo}
                            />
                         ))}
                      </Picker>
                   </View>
                )}
                <View style={{ gap: 8 }}>
                  <TextInput style={s.nodeInp} placeholder="Project Name..." value={site.projectName || site.location} onChangeText={(v) => { updateSite(i, 'projectName', v); updateSite(i, 'location', v); }} editable={!extS?.entrySubmitTs} placeholderTextColor={C.slate} />
                  <TextInput style={s.nodeInp} placeholder="Job Number..." value={site.jobNumber} onChangeText={(v) => updateSite(i, 'jobNumber', v)} editable={!extS?.entrySubmitTs} placeholderTextColor={C.slate} />
                </View>
              </View>

              <View style={s.clockGrid}>
                 {/* Arrival */}
                 <View style={[s.clockCell, { backgroundColor: extS?.entrySubmitTs ? C.bg : C.indigoBg }]}>
                    <Text style={[s.clockCellLabel, { color: C.indigo }]}>SITE (IN)</Text>
                    {extS?.entrySubmitTs ? <Text style={s.clockVal}>{formatDisplay(site.entry)}</Text> : (
                       <View style={s.clockAction}>
                          <View style={s.microInputRow}>
                            <TouchableOpacity style={s.microPicker} onPress={() => openPicker('siteEntry', site.entry, i)}>
                               <Text style={[s.microPickerText, !site.entry && { color: '#cbd5e1' }]}>{site.entry || '00:00'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={()=>updateSite(i, 'entry', nowRounded())} style={s.microNow}><Text style={s.microNowText}>NOW BUTTON ⌚</Text></TouchableOpacity>
                          </View>
                          <TouchableOpacity style={[s.actionBtn, { backgroundColor: C.indigo }]} onPress={() => {
                            const ns = [...form.sites]; ns[i].entry = site.entry || nowRounded();
                            submitAction(`site${i+1}Entry`, { sites: ns });
                          }}><Text style={s.actionBtnText}>LOG SITE</Text></TouchableOpacity>
                       </View>
                    )}
                 </View>
                 {/* Departure */}
                 <View style={[s.clockCell, { backgroundColor: extS?.exitSubmitTs ? C.bg : C.amberBg }]}>
                    <Text style={[s.clockCellLabel, { color: C.amber }]}>SITE (OUT)</Text>
                    {extS?.exitSubmitTs ? <Text style={s.clockVal}>{formatDisplay(site.exit)}</Text> : (
                       <View style={s.clockAction}>
                          <View style={s.microInputRow}>
                            <TouchableOpacity disabled={!site.entry} style={[s.microPicker, { opacity: site.entry ? 1 : 0.5 }]} onPress={() => openPicker('siteExit', site.exit, i)}>
                               <Text style={[s.microPickerText, !site.exit && { color: '#cbd5e1' }]}>{site.exit || '00:00'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity disabled={!site.entry} onPress={()=>updateSite(i, 'exit', nowRounded())} style={[s.microNow, { opacity:site.entry?1:0.5 }]}><Text style={s.microNowText}>NOW BUTTON ⌚</Text></TouchableOpacity>
                          </View>
                          <TouchableOpacity style={[s.actionBtn, { backgroundColor: C.amber, opacity:site.entry?1:0.5 }]} disabled={!site.entry} onPress={() => {
                            const ns = [...form.sites]; ns[i].exit = site.exit || nowRounded();
                            submitAction(`site${i+1}Exit`, { sites: ns });
                          }}><Text style={s.actionBtnText}>LOG SITE</Text></TouchableOpacity>
                       </View>
                    )}
                 </View>
              </View>
            </View>
          );
        })}

        {/* Office In Card */}
        <View style={[s.premiumCard, { borderTopColor: C.green, borderTopWidth: 4, marginTop: 10 }]}>
          <View style={s.cardHeader}>
             <Text style={[s.cardCaption, { color: C.green }]}>MISSION CLOSURE</Text>
             <Text style={s.cardMainTitle}>OFFICE BACK (IN)</Text>
          </View>
          
          {existing?.officeExitSubmitTs ? (
            <View style={s.lockedView}>
              <Text style={s.lockedVal}>{formatDisplay(existing.officeExitTime)}</Text>
              <View style={[s.lockedTag, { backgroundColor: C.greenBg }]}><Text style={[s.lockedTagText, { color: C.green }]}>✅ MISSION FINALIZED</Text></View>
            </View>
          ) : (
            <View style={s.actionRow}>
               <View style={s.inputGroup}>
                  <TouchableOpacity disabled={!existing?.officeEntryTime} style={[s.pickerBtn, { opacity: existing?.officeEntryTime ? 1 : 0.5 }]} onPress={() => openPicker('officeExitTime', form.officeExitTime)}>
                     <Text style={[s.pickerBtnText, !form.officeExitTime && { color: C.slate }]}>{form.officeExitTime || '00:00'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity disabled={!existing?.officeEntryTime} onPress={()=>setForm(p=>({...p, officeExitTime:nowRounded()}))} style={[s.nowBtn, { opacity: existing?.officeEntryTime?1:0.5 }]}>
                    <Text style={s.nowBtnText}>NOW ⌚</Text>
                  </TouchableOpacity>
               </View>
               <TouchableOpacity style={[s.primaryBtn, { backgroundColor: C.green, opacity: existing?.officeEntryTime?1:0.5 }]} 
                disabled={busy || !existing?.officeEntryTime}
                onPress={() => submitAction('officeExit', { officeExitTime: form.officeExitTime || nowRounded() })}>
                <Text style={s.primaryBtnText}>FINALIZE MISSION</Text>
               </TouchableOpacity>
            </View>
          )}
        </View>

        {busy && <View style={s.loader}><ActivityIndicator size="large" color={C.indigo} /></View>}

        {!!existing?.officeExitSubmitTs && !['s2_', 's3_', 's4_', 's5_'].some(p => showRounds[p] && !existing[`${p}officeExitSubmitTs`]) && !!['s2_', 's3_', 's4_', 's5_'].find(p => !showRounds[p]) && (
          <TouchableOpacity
            style={{ marginTop: 10, marginBottom: 20, backgroundColor: '#0f172a', borderRadius: 20, paddingVertical: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 }}
            onPress={() => {
              const nextP = ['s2_', 's3_', 's4_', 's5_'].find(p => !showRounds[p]);
              if (nextP) setShowRounds(prev => ({ ...prev, [nextP]: true }));
            }}
          >
            <Text style={{ fontSize: 20 }}>🔄</Text>
            <Text style={{ color: '#fbbf24', fontWeight: '900', fontSize: 14, letterSpacing: 1 }}>START NEXT ROUND</Text>
          </TouchableOpacity>
        )}

        {Object.keys(showRounds).map(prefix => {
          if (!showRounds[prefix]) return null;
          const rNum = parseInt(prefix.replace('s', ''));
          const cMain = rNum === 2 ? '#f59e0b' : rNum === 3 ? '#10b981' : rNum === 4 ? '#8b5cf6' : '#ec4899';
          const cBg   = rNum === 2 ? '#fffbeb' : rNum === 3 ? '#ecfdf5' : rNum === 4 ? '#f5f3ff' : '#fdf2f8';
          const cText = rNum === 2 ? '#92400e' : rNum === 3 ? '#064e3b' : rNum === 4 ? '#4c1d95' : '#831843';
          const cBtn  = rNum === 2 ? '#d97706' : rNum === 3 ? '#059669' : rNum === 4 ? '#7c3aed' : '#db2777';
          const shiftForm = extraForms[prefix];

          return (
            <View key={prefix} style={{ borderWidth: 2, borderColor: cMain, borderRadius: 30, padding: 4, marginTop: 10, marginBottom: 10 }}>
              <View style={{ backgroundColor: cBg, borderRadius: 26, padding: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <Text style={{ fontSize: 22 }}>🔄</Text>
                  <View>
                    <Text style={{ fontSize: 9, fontWeight: '900', color: cText, letterSpacing: 1.5 }}>CONTINUATION SHIFT</Text>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: '#0f172a' }}>ROUND {rNum} — SAME DAY</Text>
                  </View>
                </View>

                {/* Shift Office Out */}
                <View style={[s.premiumCard, { borderTopColor: cMain, borderTopWidth: 3, marginBottom: 15 }]}>
                  <Text style={[s.cardCaption, { color: cText }]}>ROUND {rNum} — BASE OPS</Text>
                  <Text style={s.cardMainTitle}>OFFICE OUT (Round {rNum})</Text>
                  {existing?.[`${prefix}officeEntrySubmitTs`] ? (
                    <View style={s.lockedView}>
                      <Text style={s.lockedVal}>{formatDisplay(existing[`${prefix}officeEntryTime`])}</Text>
                      <View style={[s.lockedTag, { backgroundColor: cBg }]}><Text style={[s.lockedTagText, { color: cBtn }]}>📍 LOCKED</Text></View>
                    </View>
                  ) : (
                    <View style={[s.actionRow, { marginTop: 15 }]}>
                      <View style={s.inputGroup}>
                        <TouchableOpacity style={s.pickerBtn} onPress={() => openPicker(`${prefix}officeEntryTime`, shiftForm.officeEntryTime)}>
                          <Text style={[s.pickerBtnText, !shiftForm.officeEntryTime && { color: C.slate }]}>{shiftForm.officeEntryTime || '00:00'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setExtraForms(p => ({ ...p, [prefix]: { ...p[prefix], officeEntryTime: nowRounded() } }))} style={s.nowBtn}>
                          <Text style={s.nowBtnText}>NOW ⌚</Text>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity style={[s.primaryBtn, { backgroundColor: cMain }]} onPress={() => submitExtraAction(prefix, `${prefix}officeEntry`, { officeEntryTime: shiftForm.officeEntryTime || nowRounded() })} disabled={busy}>
                        <Text style={s.primaryBtnText}>LOG ROUND {rNum} OUT</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Shift Sites */}
                <View style={s.sectionHeader}>
                  <Text style={s.sectionLabel}>ROUND {rNum} SITES</Text>
                  {!existing?.[`${prefix}officeExitSubmitTs`] && (
                    <TouchableOpacity style={[s.addNodeBtn, { backgroundColor: cMain }]} onPress={() => setExtraForms(p => ({ ...p, [prefix]: { ...p[prefix], sites: [...p[prefix].sites, { location: '', jobNumber: '', entry: '', exit: '', projectName: '', customerName: '', vehicle: '' }] } }))}>
                      <Text style={s.addNodeText}>+ ADD SITE</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {shiftForm.sites.map((site, i) => {
                  const extS = existing ? parseExtraShift(existing, prefix).sites[i] : null;
                  return (
                    <View key={i} style={[s.nodeCard, { borderLeftColor: cMain, borderLeftWidth: 2 }]}>
                      <View style={s.nodeCardHeader}>
                        <Text style={s.nodeTitle}>R{rNum} SITE {i + 1}</Text>
                        {!extS?.entrySubmitTs && (
                          <TouchableOpacity onPress={() => setExtraForms(p => ({ ...p, [prefix]: { ...p[prefix], sites: p[prefix].sites.filter((_, idx) => idx !== i) } }))}>
                            <Text style={s.removeText}>DISCARD</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {myJobs.length > 0 && !extS?.entrySubmitTs && (
                        <View style={{ backgroundColor: cBg, borderRadius: 12, padding: 0, marginBottom: 5 }}>
                          <Picker
                            selectedValue={`${site.projectName || site.location || ''}||${site.jobNumber || ''}`}
                            onValueChange={(val) => {
                              if (val === '||') return;
                              const [pn, jn] = val.split('||');
                              updateExtraSite(prefix, i, 'projectName', pn || '');
                              updateExtraSite(prefix, i, 'location', pn || '');
                              updateExtraSite(prefix, i, 'jobNumber', jn || '');
                            }}
                            style={{ color: cBtn }}
                            dropdownIconColor={cBtn}
                          >
                            <Picker.Item label="-- Select Scheduled Assignment --" value="||" color={cBtn} />
                            {myJobs.map((job, jIdx) => (
                              <Picker.Item
                                key={jIdx}
                                label={jobOptionLabel(job)}
                                value={`${job.projectName || ''}||${job.jobNumber || ''}`}
                                color={cBtn}
                              />
                            ))}
                          </Picker>
                        </View>
                      )}
                      <View style={{ gap: 8, marginBottom: 15 }}>
                        <TextInput style={s.nodeInp} placeholder="Project Name..." value={site.projectName} onChangeText={v => { updateExtraSite(prefix, i, 'projectName', v); updateExtraSite(prefix, i, 'location', v); }} editable={!extS?.entrySubmitTs} placeholderTextColor={C.slate} />
                        <TextInput style={s.nodeInp} placeholder="Job Number..." value={site.jobNumber} onChangeText={v => updateExtraSite(prefix, i, 'jobNumber', v)} editable={!extS?.entrySubmitTs} placeholderTextColor={C.slate} />
                      </View>
                      <View style={s.clockGrid}>
                        <View style={[s.clockCell, { backgroundColor: extS?.entrySubmitTs ? C.bg : cBg }]}>
                          <Text style={[s.clockCellLabel, { color: cBtn }]}>SITE (IN)</Text>
                          {extS?.entrySubmitTs ? <Text style={s.clockVal}>{formatDisplay(site.entry)}</Text> : (
                            <View style={s.clockAction}>
                              <View style={s.microInputRow}>
                                <TouchableOpacity style={s.microPicker} onPress={() => openPicker(`${prefix}siteEntry`, site.entry, i)}>
                                  <Text style={[s.microPickerText, !site.entry && { color: '#cbd5e1' }]}>{site.entry || '00:00'}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => updateExtraSite(prefix, i, 'entry', nowRounded())} style={s.microNow}><Text style={s.microNowText}>NOW ⌚</Text></TouchableOpacity>
                              </View>
                              <TouchableOpacity style={[s.actionBtn, { backgroundColor: cMain }]} onPress={() => {
                                const ns = [...shiftForm.sites]; ns[i].entry = site.entry || nowRounded();
                                submitExtraAction(prefix, `${prefix}site${i + 1}Entry`, { sites: ns });
                              }}><Text style={s.actionBtnText}>LOG</Text></TouchableOpacity>
                            </View>
                          )}
                        </View>
                        <View style={[s.clockCell, { backgroundColor: extS?.exitSubmitTs ? C.bg : '#fef3c7' }]}>
                          <Text style={[s.clockCellLabel, { color: cBtn }]}>SITE (OUT)</Text>
                          {extS?.exitSubmitTs ? <Text style={s.clockVal}>{formatDisplay(site.exit)}</Text> : (
                            <View style={s.clockAction}>
                              <View style={s.microInputRow}>
                                <TouchableOpacity disabled={!site.entry} style={[s.microPicker, { opacity: site.entry ? 1 : 0.5 }]} onPress={() => openPicker(`${prefix}siteExit`, site.exit, i)}>
                                  <Text style={[s.microPickerText, !site.exit && { color: '#cbd5e1' }]}>{site.exit || '00:00'}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity disabled={!site.entry} onPress={() => updateExtraSite(prefix, i, 'exit', nowRounded())} style={[s.microNow, { opacity: site.entry ? 1 : 0.5 }]}><Text style={s.microNowText}>NOW ⌚</Text></TouchableOpacity>
                              </View>
                              <TouchableOpacity style={[s.actionBtn, { backgroundColor: cBtn, opacity: site.entry ? 1 : 0.5 }]} disabled={!site.entry} onPress={() => {
                                const ns = [...shiftForm.sites]; ns[i].exit = site.exit || nowRounded();
                                submitExtraAction(prefix, `${prefix}site${i + 1}Exit`, { sites: ns });
                              }}><Text style={s.actionBtnText}>LOG</Text></TouchableOpacity>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}

                {/* Shift Office In */}
                <View style={[s.premiumCard, { borderTopColor: C.green, borderTopWidth: 3 }]}>
                  <Text style={[s.cardCaption, { color: C.green }]}>ROUND {rNum} CLOSURE</Text>
                  <Text style={s.cardMainTitle}>OFFICE IN (Round {rNum})</Text>
                  {existing?.[`${prefix}officeExitSubmitTs`] ? (
                    <View style={s.lockedView}>
                      <Text style={s.lockedVal}>{formatDisplay(existing[`${prefix}officeExitTime`])}</Text>
                      <View style={[s.lockedTag, { backgroundColor: C.greenBg }]}><Text style={[s.lockedTagText, { color: C.green }]}>✅ ROUND {rNum} COMPLETE</Text></View>
                    </View>
                  ) : (
                    <View style={[s.actionRow, { marginTop: 15 }]}>
                      <View style={s.inputGroup}>
                        <TouchableOpacity disabled={!existing?.[`${prefix}officeEntryTime`]} style={[s.pickerBtn, { opacity: existing?.[`${prefix}officeEntryTime`] ? 1 : 0.5 }]} onPress={() => openPicker(`${prefix}officeExitTime`, shiftForm.officeExitTime)}>
                          <Text style={[s.pickerBtnText, !shiftForm.officeExitTime && { color: C.slate }]}>{shiftForm.officeExitTime || '00:00'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity disabled={!existing?.[`${prefix}officeEntryTime`]} onPress={() => setExtraForms(p => ({ ...p, [prefix]: { ...p[prefix], officeExitTime: nowRounded() } }))} style={[s.nowBtn, { opacity: existing?.[`${prefix}officeEntryTime`] ? 1 : 0.5 }]}>
                          <Text style={s.nowBtnText}>NOW ⌚</Text>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity style={[s.primaryBtn, { backgroundColor: C.green, opacity: existing?.[`${prefix}officeEntryTime`] ? 1 : 0.5 }]}
                        disabled={busy || !existing?.[`${prefix}officeEntryTime`]}
                        onPress={() => submitExtraAction(prefix, `${prefix}officeExit`, { officeExitTime: shiftForm.officeExitTime || nowRounded() })}>
                        <Text style={s.primaryBtnText}>FINALIZE ROUND {rNum}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            </View>
          );
        })}

      </View>
    </ScrollView>

    {/* Time Picker Modal */}
    <Modal visible={pickModal.open} transparent animationType="fade">
       <View style={s.modalRoot}>
          <View style={s.modalCard}>
             <View style={s.modalHeaderDecoration} />
             <View style={s.modalTitleRow}>
                <View>
                  <Text style={s.modalLabel}>PRECISION AUTHENTICATION</Text>
                  <Text style={s.modalMainTitle}>Time Selection</Text>
                </View>
                <TouchableOpacity onPress={() => setPickModal({ ...pickModal, open: false })} style={s.modalCloseBtn}>
                  <Text style={{ color: C.muted, fontWeight: '900', fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
             </View>

              <View style={s.hubContainer}>
                 {/* AM/PM Switcher */}
                 <View style={s.hubMeridiemRow}>
                    {PERIODS.map(p => (
                       <TouchableOpacity 
                         key={p} 
                         onPress={() => setPickModal(prev => ({ ...prev, ampm: p }))}
                         style={[s.hubMeridiemTab, pickModal.ampm === p && s.hubMeridiemTabActive]}
                       >
                         <Text style={[s.hubMeridiemTabText, pickModal.ampm === p && s.hubMeridiemTabTextActive]}>{p}</Text>
                       </TouchableOpacity>
                    ))}
                 </View>

                 {/* Main Display Hub */}
                 <View style={s.hubDisplayRow}>
                    {/* Hour Column */}
                    <View style={s.hubDigitCol}>
                       <TouchableOpacity 
                         activeOpacity={0.6}
                         onPressIn={() => startRepeat('h', 1)}
                         onPressOut={stopRepeat}
                         style={s.hubAdjustBtn}
                       ><Text style={s.hubAdjustIcon}>▴</Text></TouchableOpacity>
                       
                       <View style={s.hubDigitBox}>
                         <Text style={s.hubDigitValue}>{pickModal.h}</Text>
                         <Text style={s.hubDigitLabel}>HOUR</Text>
                       </View>

                       <TouchableOpacity 
                         activeOpacity={0.6}
                         onPressIn={() => startRepeat('h', -1)}
                         onPressOut={stopRepeat}
                         style={s.hubAdjustBtn}
                       ><Text style={s.hubAdjustIcon}>▾</Text></TouchableOpacity>
                    </View>

                    <View style={s.hubSeparator}><Text style={s.hubSeparatorText}>:</Text></View>

                    {/* Minute Column */}
                    <View style={s.hubDigitCol}>
                       <TouchableOpacity 
                         activeOpacity={0.6}
                         onPressIn={() => startRepeat('m', 1)}
                         onPressOut={stopRepeat}
                         style={s.hubAdjustBtn}
                       ><Text style={s.hubAdjustIcon}>▴</Text></TouchableOpacity>
                       
                       <View style={s.hubDigitBox}>
                         <Text style={s.hubDigitValue}>{pickModal.m}</Text>
                         <Text style={s.hubDigitLabel}>MIN</Text>
                       </View>

                       <TouchableOpacity 
                         activeOpacity={0.6}
                         onPressIn={() => startRepeat('m', -1)}
                         onPressOut={stopRepeat}
                         style={s.hubAdjustBtn}
                       ><Text style={s.hubAdjustIcon}>▾</Text></TouchableOpacity>
                    </View>
                 </View>
              </View>
                    <View style={s.modalFooter}>
                <TouchableOpacity style={s.saveModalBtn} onPress={savePicker}>
                   <Text style={s.saveModalBtnText}>CONFIRM SELECTION</Text>
                </TouchableOpacity>
             </View>
          </View>
       </View>
    </Modal>
    {/* Custom Status Modal */}
    <Modal visible={statusModal.open} transparent animationType="fade">
       <View style={s.modalRoot}>
          <View style={[s.modalCard, { padding: 32, alignItems: 'center' }]}>
             <View style={[s.statusIconCircle, { backgroundColor: statusModal.type === 'error' ? '#fef2f2' : '#f0fdf4' }]}>
                <Text style={{ fontSize: 32 }}>{statusModal.type === 'error' ? '❌' : '✅'}</Text>
             </View>
             <Text style={s.statusTitle}>{statusModal.title}</Text>
             <Text style={s.statusMessage}>{statusModal.message}</Text>
             
             <TouchableOpacity 
                style={[s.statusBtn, { backgroundColor: statusModal.type === 'error' ? C.red : C.green }]} 
                onPress={() => setStatusModal({ ...statusModal, open: false })}
             >
                <Text style={s.statusBtnText}>CONTINUE</Text>
             </TouchableOpacity>
          </View>
       </View>
    </Modal>

    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  container: { paddingBottom: 100 },
  headerContainer: { backgroundColor: C.navy, padding: 25, paddingTop: 60, paddingBottom: 70, borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
  topNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  systemBadge: { backgroundColor: 'rgba(99,102,241,0.2)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.indigo, marginRight: 6 },
  systemBadgeText: { color: C.indigo, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  userCode: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '800' },
  headerName: { color: '#fff', fontSize: 26, fontWeight: '900' },
  headerDate: { color: C.slate, fontSize: 13, fontWeight: '600', marginTop: 4 },
  timeFloatingCard: { position: 'absolute', bottom: -35, left: 25, right: 25, backgroundColor: '#fff', borderRadius: 24, padding: 20, alignItems: 'center', elevation: 15, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.1)' },
  floatingTime: { fontSize: 32, fontWeight: '900', color: C.amber },
  floatingLabel: { fontSize: 8, fontWeight: '900', color: C.slate, letterSpacing: 1.5, marginTop: 4 },
  content: { padding: 25, paddingTop: 60 },
  premiumCard: { backgroundColor: '#fff', borderRadius: 30, padding: 25, elevation: 5, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 15, marginBottom: 25, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' },
  cardHeader: { marginBottom: 20 },
  cardCaption: { fontSize: 9, fontWeight: '900', color: C.muted, letterSpacing: 1.5, marginBottom: 4 },
  cardMainTitle: { fontSize: 16, fontWeight: '900', color: C.navy },
  lockedView: { alignItems: 'center', paddingVertical: 10 },
  lockedVal: { fontSize: 38, fontWeight: '900', color: C.navyLight },
  lockedTag: { backgroundColor: C.indigoBg, paddingHorizontal: 15, paddingVertical: 6, borderRadius: 12, marginTop: 10 },
  lockedTagText: { fontSize: 10, fontWeight: '900', color: C.indigo },
  actionRow: { gap: 15 },
  inputGroup: { flexDirection: 'row', gap: 10 },
  pickerBtn: { flex: 1, backgroundColor: C.bg, borderRadius: 16, padding: 15, borderWidth: 1.5, borderColor: C.border, justifyContent: 'center' },
  pickerBtnText: { fontSize: 18, fontWeight: '800', color: C.navy },
  nowBtn: { backgroundColor: C.border, padding: 15, borderRadius: 16, justifyContent: 'center' },
  nowBtnText: { fontWeight: '900', fontSize: 12 },
  primaryBtn: { paddingVertical: 18, borderRadius: 20, alignItems: 'center', elevation: 8 },
  primaryBtnText: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 5 },
  sectionLabel: { fontSize: 11, fontWeight: '900', color: C.muted, letterSpacing: 1.5 },
  addNodeBtn: { backgroundColor: C.indigo, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  addNodeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  nodeCard: { backgroundColor: '#fff', borderRadius: 28, padding: 20, marginBottom: 20, borderLeftWidth: 1, borderLeftColor: C.border },
  nodeCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  nodeTitle: { fontSize: 13, fontWeight: '900', color: C.navy },
  removeText: { fontSize: 9, fontWeight: '900', color: C.red },
  nodeInpRow: { gap: 8, marginBottom: 15 },
  nodeInp: { backgroundColor: C.bg, padding: 12, borderRadius: 12, fontSize: 14, fontWeight: '700', color: C.navyLight },
  clockGrid: { flexDirection: 'row', gap: 10 },
  clockCell: { flex: 1, padding: 12, borderRadius: 18 },
  clockCellLabel: { fontSize: 8, fontWeight: '900', marginBottom: 8 },
  clockVal: { fontSize: 18, fontWeight: '900', color: C.navy },
  clockAction: { gap: 10 },
  microInputRow: { gap: 6 },
  microPicker: { backgroundColor: '#fff', borderRadius: 10, padding: 8, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  microPickerText: { fontSize: 14, fontWeight: '800', color: C.navy },
  microNow: { backgroundColor: '#f1f5f9', padding: 8, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  microNowText: { fontSize: 8, fontWeight: '900', color: C.navy },
  actionBtn: { paddingVertical: 10, borderRadius: 12, alignItems: 'center', elevation: 2 },
  actionBtnText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  loader: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.7)', justifyContent: 'center', alignItems: 'center', borderRadius: 30 },
  
  // Modal Styles
  modalRoot: { flex: 1, backgroundColor: 'rgba(15,23,42,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 32, padding: 0, width: '100%', maxWidth: 400, overflow: 'hidden', elevation: 25, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20 },
  modalHeaderDecoration: { height: 6, backgroundColor: C.indigo, width: '100%' },
  modalTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingBottom: 16 },
  modalLabel: { fontSize: 9, fontWeight: '900', color: C.indigo, letterSpacing: 1.5, marginBottom: 4 },
  modalMainTitle: { fontSize: 20, fontWeight: '900', color: C.navy },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  
  hubContainer: { paddingHorizontal: 20, paddingBottom: 20 },
  hubMeridiemRow: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 14, padding: 3, marginBottom: 15 },
  hubMeridiemTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 11 },
  hubMeridiemTabActive: { backgroundColor: C.navy, elevation: 4 },
  hubMeridiemTabText: { fontSize: 12, fontWeight: '900', color: C.slate },
  hubMeridiemTabTextActive: { color: C.amber },
  
  hubDisplayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderRadius: 20, paddingVertical: 25, paddingHorizontal: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  hubDigitCol: { alignItems: 'center', gap: 10 },
  hubDigitBox: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16, minWidth: 80, alignItems: 'center', elevation: 2 },
  hubDigitValue: { fontSize: 42, fontWeight: '900', color: C.navy, height: 52, textAlignVertical: 'center' },
  hubDigitLabel: { fontSize: 7, fontWeight: '900', color: C.slate, letterSpacing: 1 },
  hubAdjustBtn: { width: 40, height: 32, backgroundColor: '#f1f5f9', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  hubAdjustIcon: { fontSize: 20, color: C.indigo, fontWeight: '900' },
  hubSeparator: { marginHorizontal: 8 },
  hubSeparatorText: { fontSize: 28, fontWeight: '900', color: C.slate, opacity: 0.3 },
  
  modalFooter: { padding: 24, paddingTop: 0 },
  saveModalBtn: { backgroundColor: C.navy, paddingVertical: 18, borderRadius: 20, alignItems: 'center', shadowColor: C.navy, shadowOpacity: 0.3, shadowRadius: 10, elevation: 12 },
  saveModalBtnText: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 1 },

  // Status Modal Styles
  statusIconCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  statusTitle: { fontSize: 22, fontWeight: '900', color: C.navy, marginBottom: 12, textAlign: 'center' },
  statusMessage: { fontSize: 14, color: C.muted, fontWeight: '600', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  statusBtn: { width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  statusBtnText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 1 }
});
