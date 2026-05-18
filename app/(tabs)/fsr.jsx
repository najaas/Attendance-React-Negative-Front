import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Redirect } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import Svg, { Path, Rect } from 'react-native-svg';
import { useAuth } from '../providers/AuthProvider';
import { apiFetch } from '../../lib/api';

const emptyItem = { jobNo: '', slNo: '', panelRef: '', material: '', qty: '', completionDate: '', doneBy: '' };
const todayStr = () => new Date().toISOString().slice(0, 10);
const norm = (v) => String(v || '').trim().toLowerCase();

const baseForm = (user) => ({
  _id: '',
  project: '',
  jobRef: '',
  client: '',
  date: todayStr(),
  purpose: '',
  timeInOut: '',
  contact: '',
  transport: '',
  switchboardRef: '',
  location: '',
  serviceDetails: '',
  observation: '',
  items: [{ ...emptyItem, slNo: '1' }],
  conclusion: '',
  techOrg: 'PACIFIC OCEAN',
  techName: user?.shortName || user?.name || '',
  techDesignation: user?.designation || '',
  techDate: todayStr(),
  clientOrg: '',
  clientName: '',
  clientDesignation: '',
  clientDate: '',
  othersOrg: '',
  othersName: '',
  othersDesignation: '',
  othersDate: '',
  techSignature: '',
  clientSignature: '',
  othersSignature: '',
  formType: 'table',
  workDonePlain: '',
  status: 'processing',
});

function SignaturePad({ label, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [strokes, setStrokes] = useState([]);
  const currentPoints = useRef([]);

  useEffect(() => {
    if (!open) return;
    if (!value) {
      setStrokes([]);
      return;
    }
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) setStrokes(parsed);
    } catch {
      setStrokes([]);
    }
  }, [open, value]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentPoints.current = [[locationX, locationY]];
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentPoints.current.push([locationX, locationY]);
        setStrokes((prev) => {
          const next = [...prev];
          if (next.length === 0 || next[next.length - 1].done) {
            next.push({ points: [[locationX, locationY]], done: false });
          } else {
            next[next.length - 1] = { ...next[next.length - 1], points: [...next[next.length - 1].points, [locationX, locationY]] };
          }
          return next;
        });
      },
      onPanResponderRelease: () => {
        setStrokes((prev) => {
          const next = [...prev];
          if (next.length > 0) next[next.length - 1] = { ...next[next.length - 1], done: true };
          return next;
        });
      },
    })
  ).current;

  const clear = () => setStrokes([]);
  const save = () => {
    const payload = strokes.filter((s) => (s.points || []).length > 0).map((s) => s.points);
    onChange(payload.length ? JSON.stringify(payload) : '');
    setOpen(false);
  };

  const renderPath = (pts) => {
    if (!pts || pts.length === 0) return '';
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i += 1) d += ` L ${pts[i][0]} ${pts[i][1]}`;
    return d;
  };

  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity disabled={disabled} onPress={() => setOpen(true)} style={[styles.signPreview, disabled && { opacity: 0.55 }]}> 
        <Text style={styles.signPreviewText}>{value ? 'Signature Added (tap edit)' : 'Tap to Sign'}</Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.signModal}>
          <View style={styles.signHeader}>
            <Text style={styles.signTitle}>{label}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={clear} style={styles.signBtn}><Text style={styles.signBtnText}>Clear</Text></TouchableOpacity>
              <TouchableOpacity onPress={save} style={[styles.signBtn, { backgroundColor: '#16a34a', borderColor: '#16a34a' }]}><Text style={[styles.signBtnText, { color: '#fff' }]}>Done</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setOpen(false)} style={styles.signBtn}><Text style={styles.signBtnText}>Close</Text></TouchableOpacity>
            </View>
          </View>

          <View style={styles.signCanvas} {...pan.panHandlers}>
            <Svg width="100%" height="100%">
              <Rect x="0" y="0" width="100%" height="100%" fill="#ffffff" />
              {strokes.map((s, idx) => (
                <Path key={idx} d={renderPath(s.points)} stroke="#0f172a" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              ))}
            </Svg>
          </View>
          <Text style={styles.helper}>Sign inside white area</Text>
        </View>
      </Modal>
    </View>
  );
}

export default function FsrScreen() {
  const { token, loading, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [assignedFsrs, setAssignedFsrs] = useState([]);
  const [mySchedules, setMySchedules] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState('');
  const [form, setForm] = useState(baseForm(user));
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setForm((p) => ({ ...p, techName: user?.shortName || user?.name || p.techName, techDesignation: user?.designation || p.techDesignation }));
  }, [user?.shortName, user?.name, user?.designation]);

  const loadAll = async () => {
    if (!token) return;
    setBusy(true);
    setErr('');
    try {
      const [fsrsRaw, schedulesRaw] = await Promise.all([
        apiFetch('/fsr?limit=300', { token }),
        apiFetch('/schedule?date=recent', { token }),
      ]);

      const allFsrs = Array.isArray(fsrsRaw) ? fsrsRaw : [];
      const allSchedules = Array.isArray(schedulesRaw) ? schedulesRaw : [];
      const meU = norm(user?.username);
      const meN = norm(user?.name);
      const meS = norm(user?.shortName);

      const mineFsrs = allFsrs.filter((f) => {
        const mineByTech = [meN, meS].includes(norm(f?.techName));
        const mineByAssign = Array.isArray(f?.assignedEmployees) && f.assignedEmployees.map(norm).includes(meU);
        return mineByTech || mineByAssign;
      });

      const mineSchedules = allSchedules.filter((s) => {
        const byUser = norm(s?.assignedToUsername) === meU;
        const byName = norm(s?.assignedToName) === meN || norm(s?.assignedToName) === meS;
        return byUser || byName;
      });

      setAssignedFsrs(mineFsrs);
      setMySchedules(mineSchedules);
    } catch (e) {
      setErr(e.message || 'Failed to load FSR data');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [token, user?.username]);

  if (!loading && !token) return <Redirect href="/login" />;

  const pendingAssigned = useMemo(() => assignedFsrs.filter((f) => f.status !== 'completed'), [assignedFsrs]);
  const pendingSchedules = useMemo(() => {
    const today = todayStr();
    return mySchedules.filter((s) => s.status !== 'completed' && (s.taskDate === today || s.statusDate === today));
  }, [mySchedules]);

  const projectOptions = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const s of pendingSchedules) {
      const p = String(s.projectName || '').trim();
      const k = norm(p);
      if (!p || seen.has(k)) continue;
      seen.add(k);
      out.push(p);
    }
    return out;
  }, [pendingSchedules]);

  const jobOptions = useMemo(() => {
    const seen = new Set();
    const out = [];
    const pool = form.project ? pendingSchedules.filter((s) => norm(s.projectName) === norm(form.project)) : pendingSchedules;
    for (const s of pool) {
      const j = String(s.jobNumber || '').trim();
      const k = norm(j);
      if (!j || seen.has(k)) continue;
      seen.add(k);
      out.push(j);
    }
    return out;
  }, [pendingSchedules, form.project]);

  const isLocked = (fieldName) => {
    if (!selectedReportId) return false;
    const report = assignedFsrs.find((f) => f._id === selectedReportId);
    if (!report) return false;
    if (report.status === 'completed') return true;
    if (report.status === 'processing') return true;
    if (report.status === 'pending') return false;
    return !!report[fieldName];
  };

  const setToast = (text, type = 'ok') => {
    if (type === 'ok') {
      setMsg(text);
      setErr('');
    } else {
      setErr(text);
      setMsg('');
    }
  };

  const applyScheduleToForm = (schedule, forced = {}) => {
    if (!schedule) return;
    setForm((p) => ({
      ...p,
      project: String(forced.project ?? schedule.projectName ?? p.project).trim(),
      jobRef: String(forced.jobRef ?? schedule.jobNumber ?? p.jobRef).trim(),
      client: String(schedule.customerName || p.client).trim(),
      contact: String(schedule.customerPerson || schedule.customerContact || p.contact).trim(),
      transport: String(schedule.vehicle || p.transport).trim(),
      location: String(schedule.site || p.location).trim(),
      serviceDetails: String(schedule.description || schedule.title || schedule.remarks || p.serviceDetails).trim(),
    }));
  };

  const handleProjectPick = (value) => {
    setForm((p) => ({ ...p, project: value }));
    if (!value) return;
    const first = pendingSchedules.find((s) => norm(s.projectName) === norm(value));
    if (first) applyScheduleToForm(first, { project: value, jobRef: first.jobNumber || '' });
  };

  const handleJobPick = (value) => {
    setForm((p) => ({ ...p, jobRef: value }));
    if (!value) return;
    const found = pendingSchedules.find((s) => {
      const sameJob = norm(s.jobNumber) === norm(value);
      if (!sameJob) return false;
      if (!form.project) return true;
      return norm(s.projectName) === norm(form.project);
    });
    if (found) applyScheduleToForm(found, { project: form.project || found.projectName || '', jobRef: value });
  };

  const handleReportSelect = (id) => {
    setSelectedReportId(id);
    if (!id) {
      setForm(baseForm(user));
      return;
    }
    const report = assignedFsrs.find((f) => f._id === id);
    if (!report) return;
    setForm({
      ...baseForm(user),
      ...report,
      _id: report._id,
      techName: user?.shortName || user?.name || report.techName || '',
      techDesignation: user?.designation || report.techDesignation || '',
      techDate: todayStr(),
      items: Array.isArray(report.items) && report.items.length > 0 ? report.items : [{ ...emptyItem, slNo: '1' }],
    });
  };

  const updateField = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  const handleItemChange = (index, field, value) => {
    setForm((p) => {
      const items = [...p.items];
      items[index] = { ...items[index], [field]: value };
      return { ...p, items };
    });
  };

  const addItem = () => setForm((p) => ({ ...p, items: [...p.items, { ...emptyItem, slNo: String(p.items.length + 1) }] }));
  const removeItem = (idx) => setForm((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  const doSubmit = async () => {
    if (!form.project || !form.jobRef) return setToast('Project and Job Ref required', 'bad');
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const payload = {
        ...form,
        status: 'processing',
        techName: user?.shortName || user?.name || form.techName,
        techDesignation: user?.designation || form.techDesignation,
        techDate: form.techDate || todayStr(),
        assignedEmployees: Array.from(new Set([...(form.assignedEmployees || []), user?.username].filter(Boolean))),
      };
      const isUpdate = !!form._id;
      const url = isUpdate ? `/fsr/${form._id}` : '/fsr';
      const method = isUpdate ? 'PUT' : 'POST';
      await apiFetch(url, { method, token, body: payload });
      setToast(isUpdate ? 'FSR updated' : 'FSR submitted', 'ok');
      setSelectedReportId('');
      setForm(baseForm(user));
      await loadAll();
    } catch (e) {
      setToast(e.message || 'FSR submit failed', 'bad');
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  };

  const Input = ({ label, value, onChangeText, multiline = false, placeholder = '', readOnly = false }) => (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={String(value || '')}
        onChangeText={onChangeText}
        editable={!readOnly}
        placeholder={placeholder}
        style={[styles.input, multiline && styles.inputArea, readOnly && { backgroundColor: '#f1f5f9' }]}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Field Service Report</Text>
      <Text style={styles.sub}>Employee side full options</Text>

      {busy && <ActivityIndicator style={{ marginVertical: 8 }} />}
      {!!msg && <Text style={styles.ok}>{msg}</Text>}
      {!!err && <Text style={styles.bad}>{err}</Text>}

      <View style={styles.card}>
        <Text style={styles.label}>Assigned Pending Report</Text>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={selectedReportId} onValueChange={handleReportSelect}>
            <Picker.Item label="-- Start Blank Report --" value="" />
            {pendingAssigned.map((f) => (
              <Picker.Item
                key={f._id}
                label={`${String(f.status || 'pending').toUpperCase()} - ${f.project || 'Untitled'} (${f.jobRef || 'N/A'})`}
                value={f._id}
              />
            ))}
          </Picker>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Auto Fill From My Schedules</Text>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={form.project} onValueChange={handleProjectPick}>
            <Picker.Item label="-- Select Project --" value="" />
            {projectOptions.map((p) => <Picker.Item key={p} label={p} value={p} />)}
          </Picker>
        </View>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={form.jobRef} onValueChange={handleJobPick}>
            <Picker.Item label="-- Select Job Ref --" value="" />
            {jobOptions.map((j) => <Picker.Item key={j} label={j} value={j} />)}
          </Picker>
        </View>
      </View>

      <View style={styles.card}>
        <Input label="Project" value={form.project} onChangeText={(v) => updateField('project', v)} readOnly={isLocked('project')} />
        <Input label="Client" value={form.client} onChangeText={(v) => updateField('client', v)} readOnly={isLocked('client')} />
        <Input label="Job Ref" value={form.jobRef} onChangeText={(v) => updateField('jobRef', v)} readOnly={isLocked('jobRef')} />
        <Input label="Purpose" value={form.purpose} onChangeText={(v) => updateField('purpose', v)} readOnly={isLocked('purpose')} />
        <Input label="Date (YYYY-MM-DD)" value={form.date} onChangeText={(v) => updateField('date', v)} readOnly={isLocked('date')} />
        <Input label="Contact" value={form.contact} onChangeText={(v) => updateField('contact', v)} readOnly={isLocked('contact')} />
        <Input label="Time In / Out" value={form.timeInOut} onChangeText={(v) => updateField('timeInOut', v)} readOnly={isLocked('timeInOut')} />
        <Input label="Switchboard Ref" value={form.switchboardRef} onChangeText={(v) => updateField('switchboardRef', v)} readOnly={isLocked('switchboardRef')} />
        <Input label="Transport" value={form.transport} onChangeText={(v) => updateField('transport', v)} readOnly={isLocked('transport')} />
        <Input label="Location" value={form.location} onChangeText={(v) => updateField('location', v)} readOnly={isLocked('location')} />
        <Input label="Service Details" value={form.serviceDetails} onChangeText={(v) => updateField('serviceDetails', v)} multiline readOnly={isLocked('serviceDetails')} />
        <Input label="Observation" value={form.observation} onChangeText={(v) => updateField('observation', v)} multiline readOnly={isLocked('observation')} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Report Type</Text>
        <View style={styles.typeRow}>
          <TouchableOpacity style={[styles.typeBtn, form.formType === 'table' && styles.typeBtnActive]} onPress={() => updateField('formType', 'table')}>
            <Text style={[styles.typeText, form.formType === 'table' && styles.typeTextActive]}>Standard FSR</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.typeBtn, form.formType === 'plain' && styles.typeBtnActive]} onPress={() => updateField('formType', 'plain')}>
            <Text style={[styles.typeText, form.formType === 'plain' && styles.typeTextActive]}>Form 2</Text>
          </TouchableOpacity>
        </View>

        {form.formType === 'table' ? (
          <View>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Work Done List</Text>
              <TouchableOpacity onPress={addItem} style={styles.smallBtn}><Text style={styles.smallBtnText}>+ Add Row</Text></TouchableOpacity>
            </View>
            {form.items.map((it, i) => (
              <View key={i} style={styles.itemCard}>
                <Text style={styles.itemTitle}>Row {i + 1}</Text>
                <Input label="Job#" value={it.jobNo} onChangeText={(v) => handleItemChange(i, 'jobNo', v)} />
                <Input label="SL#" value={it.slNo} onChangeText={(v) => handleItemChange(i, 'slNo', v)} />
                <Input label="Panel Ref" value={it.panelRef} onChangeText={(v) => handleItemChange(i, 'panelRef', v)} />
                <Input label="Description" value={it.material} onChangeText={(v) => handleItemChange(i, 'material', v)} />
                <Input label="QTY" value={it.qty} onChangeText={(v) => handleItemChange(i, 'qty', v)} />
                <Input label="Completion Date" value={it.completionDate} onChangeText={(v) => handleItemChange(i, 'completionDate', v)} />
                <Input label="Done By" value={it.doneBy} onChangeText={(v) => handleItemChange(i, 'doneBy', v)} />
                {form.items.length > 1 && <TouchableOpacity onPress={() => removeItem(i)} style={[styles.smallBtn, { backgroundColor: '#fee2e2', borderColor: '#fecaca' }]}><Text style={[styles.smallBtnText, { color: '#dc2626' }]}>Remove</Text></TouchableOpacity>}
              </View>
            ))}
          </View>
        ) : (
          <Input label="Work Done (Form 2)" value={form.workDonePlain} onChangeText={(v) => updateField('workDonePlain', v)} multiline />
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Technician Block</Text>
        <Input label="Tech Name" value={form.techName} onChangeText={(v) => updateField('techName', v)} />
        <Input label="Tech Designation" value={form.techDesignation} onChangeText={(v) => updateField('techDesignation', v)} />
        <Input label="Tech Date" value={form.techDate} onChangeText={(v) => updateField('techDate', v)} />
        <SignaturePad label="TECHNICIAN SIGNATURE" value={form.techSignature} onChange={(v) => updateField('techSignature', v)} disabled={isLocked('techSignature')} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Client Block</Text>
        <Input label="Client Org" value={form.clientOrg} onChangeText={(v) => updateField('clientOrg', v)} />
        <Input label="Client Name" value={form.clientName} onChangeText={(v) => updateField('clientName', v)} />
        <Input label="Client Designation" value={form.clientDesignation} onChangeText={(v) => updateField('clientDesignation', v)} />
        <Input label="Client Date" value={form.clientDate} onChangeText={(v) => updateField('clientDate', v)} />
        <SignaturePad label="CLIENT SIGNATURE" value={form.clientSignature} onChange={(v) => updateField('clientSignature', v)} disabled={isLocked('clientSignature')} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Others Block</Text>
        <Input label="Others Org" value={form.othersOrg} onChangeText={(v) => updateField('othersOrg', v)} />
        <Input label="Others Name" value={form.othersName} onChangeText={(v) => updateField('othersName', v)} />
        <Input label="Others Designation" value={form.othersDesignation} onChangeText={(v) => updateField('othersDesignation', v)} />
        <Input label="Others Date" value={form.othersDate} onChangeText={(v) => updateField('othersDate', v)} />
        <SignaturePad label="OTHERS SIGNATURE" value={form.othersSignature} onChange={(v) => updateField('othersSignature', v)} disabled={isLocked('othersSignature')} />
      </View>

      <TouchableOpacity onPress={() => setConfirmOpen(true)} style={styles.submitBtn} disabled={busy}>
        <Text style={styles.submitText}>{form._id ? 'Update FSR' : 'Submit FSR'}</Text>
      </TouchableOpacity>

      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => setConfirmOpen(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Submit FSR?</Text>
            <Text style={styles.modalText}>Are you sure you want to submit this report?</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => setConfirmOpen(false)} style={styles.modalBtnCancel}><Text style={styles.modalBtnTextCancel}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={doSubmit} style={styles.modalBtnOk}><Text style={styles.modalBtnTextOk}>Yes Submit</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f4f8' },
  container: { padding: 16, paddingBottom: 42 },
  title: { fontSize: 26, fontWeight: '900', color: '#0f172a' },
  sub: { marginTop: 2, marginBottom: 12, color: '#64748b', fontWeight: '700' },
  ok: { backgroundColor: '#dcfce7', color: '#166534', padding: 10, borderRadius: 10, marginBottom: 8, fontWeight: '700' },
  bad: { backgroundColor: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 10, marginBottom: 8, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, padding: 12, marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '800', color: '#334155', marginBottom: 4 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10 },
  inputArea: { minHeight: 88 },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: '#0f172a', marginBottom: 8 },
  pickerWrap: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: 8, backgroundColor: '#f8fafc' },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  typeBtn: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: '#f8fafc' },
  typeBtnActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  typeText: { color: '#475569', fontWeight: '800' },
  typeTextActive: { color: '#fbbf24' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  smallBtn: { borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  smallBtnText: { color: '#2563eb', fontWeight: '800', fontSize: 12 },
  itemCard: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 10, marginBottom: 10, backgroundColor: '#fcfcfd' },
  itemTitle: { fontSize: 13, fontWeight: '900', color: '#0f172a', marginBottom: 6 },
  submitBtn: { backgroundColor: '#0f172a', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitText: { color: '#fbbf24', fontSize: 14, fontWeight: '900' },
  signPreview: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12, backgroundColor: '#fff' },
  signPreviewText: { color: '#334155', fontWeight: '700' },
  signModal: { flex: 1, backgroundColor: '#fff', paddingTop: 42 },
  signHeader: { paddingHorizontal: 12, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  signTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  signBtn: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#f8fafc' },
  signBtnText: { color: '#334155', fontWeight: '800', fontSize: 12 },
  signCanvas: { flex: 1, margin: 12, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, overflow: 'hidden' },
  helper: { textAlign: 'center', color: '#64748b', fontSize: 12, fontWeight: '700', marginBottom: 12 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  modalCard: { width: '100%', backgroundColor: '#fff', borderRadius: 14, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a', marginBottom: 8 },
  modalText: { color: '#475569', fontWeight: '600', marginBottom: 12 },
  modalBtnCancel: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: '#e2e8f0' },
  modalBtnOk: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: '#0f172a' },
  modalBtnTextCancel: { color: '#334155', fontWeight: '800' },
  modalBtnTextOk: { color: '#fbbf24', fontWeight: '800' },
});
