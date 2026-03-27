import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Modal, Alert, StatusBar,
  useWindowDimensions
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

const HH = Array.from({length: 24}, (_, i) => String(i).padStart(2, '0'));
const MM = Array.from({length: 60}, (_, i) => String(i).padStart(2, '0'));

function nowRounded() {
  const d = zonedNow();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function todayStr() {
  const d = zonedNow();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function prettyToday() {
  const d = zonedNow();
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}
function formatDisplay(val24) {
  if (!val24 || val24 === '00:00' || val24 === '—') return '—';
  try {
    const [h24, m] = val24.split(':').map(Number);
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    const mer = h24 >= 12 ? 'PM' : 'AM';
    return `${String(h12).padStart(2, '0')}:${String(m || 0).padStart(2, '0')} ${mer}`;
  } catch(e) { return val24; }
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

  // Time Picker State
  const [pickModal, setPickModal] = React.useState({ open: false, field: '', val: '', index: -1 });

  // Custom Status Modal State
  const [statusModal, setStatusModal] = React.useState({ open: false, title: '', message: '', type: 'success' });

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

  useEffect(() => { loadData(); }, [loadData]);

  if (!token) return <Redirect href="/login" />;

  const updateSite = (i, k, v) => setForm((p) => {
    const s = [...p.sites]; s[i] = { ...s[i], [k]: v }; return { ...p, sites: s };
  });

  const openPicker = (field, currentVal, index = -1) => {
    setPickModal({ open: true, field, val: currentVal || nowRounded(), index });
  };

  const savePicker = () => {
    const { field, val, index } = pickModal;
    if (field === 'officeEntryTime') setForm(p => ({ ...p, officeEntryTime: val }));
    else if (field === 'officeExitTime') setForm(p => ({ ...p, officeExitTime: val }));
    else if (field === 'siteEntry') updateSite(index, 'entry', val);
    else if (field === 'siteExit') updateSite(index, 'exit', val);
    setPickModal({ open: false, field: '', val: '', index: -1 });
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
    } catch (e) {}
    
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

      <View style={s.content}>
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

        {form.sites.map((site, i) => {
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
                               label={`${job.projectName || 'Task'}${job.jobNumber ? ` (#${job.jobNumber})` : ''}${job.customerName ? ` - ${job.customerName}` : ''}${job.customerPerson ? ` (${job.customerPerson})` : ''}`} 
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
                            <TouchableOpacity onPress={()=>updateSite(i, 'entry', nowRounded())} style={s.microNow}><Text style={s.microNowText}>NOW ⌚</Text></TouchableOpacity>
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
                            <TouchableOpacity disabled={!site.entry} onPress={()=>updateSite(i, 'exit', nowRounded())} style={[s.microNow, { opacity:site.entry?1:0.5 }]}><Text style={s.microNowText}>NOW ⌚</Text></TouchableOpacity>
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
      </View>
    </ScrollView>

    {/* Time Picker Modal */}
    <Modal visible={pickModal.open} transparent animationType="fade">
       <View style={s.modalRoot}>
          <View style={s.modalCard}>
             <View style={s.modalHeaderDecoration} />
             <View style={s.modalTitleRow}>
                <View>
                  <Text style={s.modalLabel}>PRECISION LOGGING</Text>
                  <Text style={s.modalMainTitle}>Select Time</Text>
                </View>
                <TouchableOpacity onPress={() => setPickModal({ ...pickModal, open: false })} style={s.modalCloseBtn}>
                  <Text style={{ color: C.muted, fontWeight: '900', fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
             </View>
             
             <View style={s.pickerContainer}>
                <View style={s.pickerColumn}>
                   <View style={s.pickerHeader}><Text style={s.pickerHeaderText}>HOUR</Text></View>
                   <Picker 
                      selectedValue={pickModal.val.split(':')[0]} 
                      onValueChange={(h) => setPickModal({ ...pickModal, val: `${h}:${pickModal.val.split(':')[1] || '00'}` })}
                      style={s.nativePicker}
                      itemStyle={s.pickerItemStyle}
                   >
                      {HH.map(h => <Picker.Item key={h} label={h} value={h} color={C.navy} />)}
                   </Picker>
                </View>
                
                <View style={s.pickerDivider}>
                   <Text style={s.pickerDividerText}>:</Text>
                </View>
                
                <View style={s.pickerColumn}>
                   <View style={s.pickerHeader}><Text style={s.pickerHeaderText}>MINUTE</Text></View>
                   <Picker 
                      selectedValue={pickModal.val.split(':')[1]} 
                      onValueChange={(m) => setPickModal({ ...pickModal, val: `${pickModal.val.split(':')[0] || '00'}:${m}` })}
                      style={s.nativePicker}
                      itemStyle={s.pickerItemStyle}
                   >
                      {MM.map(m => <Picker.Item key={m} label={m} value={m} color={C.navy} />)}
                   </Picker>
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
  
  pickerContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 24 },
  pickerColumn: { flex: 1, backgroundColor: '#fcfdfe', borderRadius: 20, borderWidth: 1, borderColor: '#f1f5f9', overflow: 'hidden' },
  pickerHeader: { backgroundColor: '#f8fafc', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
  pickerHeaderText: { fontSize: 9, fontWeight: '900', color: C.muted, letterSpacing: 1 },
  nativePicker: { width: '100%', height: 180 },
  pickerItemStyle: { fontSize: 22, fontWeight: '800', color: C.navy, height: 180 },
  
  pickerDivider: { width: 30, alignItems: 'center' },
  pickerDividerText: { fontSize: 24, fontWeight: '900', color: C.slate },
  
  modalFooter: { padding: 20, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  saveModalBtn: { backgroundColor: C.navy, paddingVertical: 16, borderRadius: 16, alignItems: 'center', shadowColor: C.navy, shadowOpacity: 0.3, shadowRadius: 8, elevation: 10 },
  saveModalBtnText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 1 },

  // Status Modal Styles
  statusIconCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  statusTitle: { fontSize: 22, fontWeight: '900', color: C.navy, marginBottom: 12, textAlign: 'center' },
  statusMessage: { fontSize: 14, color: C.muted, fontWeight: '600', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  statusBtn: { width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  statusBtnText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 1 }
});
