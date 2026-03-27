// ============================================================
// FILE: app/(tabs)/schedule.jsx  – Professional Card + Modal
// ============================================================
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Linking, Modal,
  useWindowDimensions
} from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../providers/AuthProvider';
import { apiFetch } from '../../lib/api';

const C = {
  bg: '#f0f4f8', navy: '#0f172a', navyMid: '#1e293b', white: '#ffffff',
  muted: '#64748b', border: '#e2e8f0', amber: '#fbbf24',
  blue: '#2563eb', blueBg: '#eff6ff', blueBorder: '#bfdbfe',
  green: '#16a34a', greenBg: '#f0fdf4',
  slate: '#64748b', slateBg: '#f8fafc',
  indigo: '#6366f1', indigoBg: '#eef2ff',
  violet: '#7c3aed',
};

function normalizeUrl(v) {
  const raw = String(v || '').trim();
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}
function dateOnly(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function dayLabel(ds) {
  const [y,m,d] = ds.split('-').map(Number);
  return new Date(y,m-1,d).toLocaleDateString('en-US',{weekday:'long'});
}
function displayDate(ds) {
  if (!ds) return '—';
  const [y,m,d] = ds.split('-').map(Number);
  return `${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}`;
}

export default function Schedule() {
  const { token, loading } = useAuth();
  const { width } = useWindowDimensions();
  const isLarge = width > 768;

  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [selectedJob, setSelectedJob] = useState(null);

  // Dynamic modal styles
  const overlaySty = [sc.modalOverlay, { justifyContent: 'center', padding: 20 }];
  const cardSty = [
    sc.modalCard,
    { 
      borderRadius: 32, 
      width: isLarge ? 600 : '100%',
      alignSelf: 'center'
    }
  ];
  const headSty = [sc.modalHeader, { borderTopLeftRadius: 32, borderTopRightRadius: 32 }];


  useEffect(() => {
    if (!token) return;
    setBusy(true);
    apiFetch('/schedule?date=recent', { token })
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((e) => setErr(e.message || 'Load failed'))
      .finally(() => setBusy(false));
  }, [token]);

  if (!loading && !token) return <Redirect href="/login" />;

  const today = dateOnly(new Date());
  const yesterday = dateOnly(new Date(Date.now() - 86400000));
  const tomorrow = dateOnly(new Date(Date.now() + 86400000));

  const grouped = useMemo(() => {
    const byDate = rows.reduce((acc, r) => {
      if (!acc[r.taskDate]) acc[r.taskDate] = [];
      acc[r.taskDate].push(r);
      return acc;
    }, {});
    const groupJobs = (list) => {
      const map = new Map();
      (list || []).forEach(r => {
        const k = [r.projectName,r.customerName,r.customerPerson,r.customerContact,r.jobNumber,r.description,r.site,r.officeTime,r.siteTime,r.location,r.vehicle].join('||');
        if (!map.has(k)) map.set(k, { ...r, technicians: [] });
        const e = map.get(k);
        const t = r.assignedToName || r.assignedToUsername || '';
        if (t && !e.technicians.includes(t)) e.technicians.push(t);
      });
      return [...map.values()];
    };
    return [
      { key: yesterday, title: 'YESTERDAY', accent: C.slate, headBg: '#f1f5f9' },
      { key: today,     title: 'TODAY',     accent: C.blue,  headBg: '#eff6ff' },
      { key: tomorrow,  title: 'TOMORROW',  accent: C.green, headBg: '#f0fdf4' },
    ].map(s => ({ ...s, items: groupJobs(byDate[s.key] || []) }));
  }, [rows]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 50 }}>
        {/* Header */}
        <View style={sc.pageHeader}>
          <Text style={sc.pageTitle}>Work Schedule</Text>
          {busy && <ActivityIndicator color={C.blue} style={{ marginTop: 8 }} />}
          {err ? <Text style={sc.errText}>{err}</Text> : null}
        </View>

        {grouped.map(section => (
          <View key={section.key} style={sc.sectionWrap}>
            {/* Section Header */}
            <View style={[sc.sectionHead, { backgroundColor: section.headBg, borderLeftColor: section.accent }]}>
              <View>
                <Text style={[sc.sectionLabel, { color: section.accent }]}>{section.title}</Text>
                <Text style={sc.sectionDate}>{displayDate(section.key)}</Text>
                <Text style={sc.sectionDay}>({dayLabel(section.key)})</Text>
              </View>
              <View style={[sc.countBadge, { backgroundColor: section.accent }]}>
                <Text style={sc.countBadgeText}>{section.items.length} {section.items.length === 1 ? 'Job' : 'Jobs'}</Text>
              </View>
            </View>

            {section.items.length === 0 ? (
              <View style={sc.emptyRow}><Text style={sc.emptyText}>No work scheduled</Text></View>
            ) : (
              section.items.map((job, idx) => (
                <TouchableOpacity key={idx} activeOpacity={0.85} onPress={() => setSelectedJob(job)}>
                  <View style={[sc.jobCard, { borderLeftColor: section.accent }]}>
                    {/* Project + Job No */}
                    <View style={sc.cardTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={[sc.cardLabel, { color: section.accent }]}>PROJECT</Text>
                        <Text style={sc.cardProject}>{job.projectName || '—'}</Text>
                      </View>
                      {job.jobNumber ? (
                        <View style={[sc.jobNoBadge, { backgroundColor: section.accent + '22', borderColor: section.accent + '55' }]}>
                          <Text style={[sc.jobNoLabel, { color: section.accent }]}>JOB NO</Text>
                          <Text style={[sc.jobNoVal, { color: C.navy }]}>{job.jobNumber}</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Customer + Paired Contacts */}
                    <View style={sc.clientBox}>
                      <View style={sc.clientRow}>
                        <Text style={sc.clientRowLabel}>🏢 CUSTOMER</Text>
                        <Text style={sc.clientRowVal}>{job.customerName || '—'}</Text>
                      </View>
                      {job.customerContact ? (() => {
                        const names = String(job.customerPerson || '').split(',').map(n=>n.trim()).filter(Boolean);
                        const nums  = String(job.customerContact).split(',').map(n=>n.trim()).filter(Boolean);
                        const len   = Math.max(names.length,nums.length);
                        return (
                          <View style={{ marginTop: 6, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 6, gap: 6 }}>
                            <Text style={sc.clientRowLabel}>📞 CONTACTS</Text>
                            {Array.from({length:len},(_,i)=>{
                              const name = names[i]||null;
                              const num  = nums[i]||null;
                              if (!num) return null;
                              return (
                                <View key={i} style={{ flexDirection:'row', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                                  {name ? (
                                    <View style={sc.nameBadge}><Text style={sc.nameBadgeText}>{name}</Text></View>
                                  ) : null}
                                  <TouchableOpacity onPress={()=>Linking.openURL(`tel:${num}`)} style={sc.phoneBtn}>
                                    <Text style={sc.phoneBtnText}>📞 {num}</Text>
                                  </TouchableOpacity>
                                </View>
                              );
                            })}
                          </View>
                        );
                      })() : null}
                    </View>

                    {/* Scope */}
                    {(job.description||job.title) ? (
                      <Text style={sc.scopeText} numberOfLines={2}>📋 {job.description||job.title}</Text>
                    ) : null}

                    {/* Staff names */}
                    {job.technicians?.length > 0 && (
                      <View style={sc.teamBox}>
                        <Text style={sc.teamLabel}>👷 TEAM</Text>
                        <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6, marginTop:5 }}>
                          {job.technicians.map((t,ti)=>(
                            <View key={ti} style={sc.staffChip}>
                              <View style={sc.staffNum}><Text style={sc.staffNumText}>{ti+1}</Text></View>
                              <Text style={sc.staffName}>{t}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Footer tags */}
                    <View style={sc.cardFooter}>
                      {job.site && job.site!=='All Sites' && <View style={sc.tag}><Text style={sc.tagText}>📍 {job.site}</Text></View>}
                      {job.officeTime ? <View style={[sc.tag,{backgroundColor:'#f0fdf4'}]}><Text style={[sc.tagText,{color:'#15803d'}]}>🏢 {job.officeTime}</Text></View> : null}
                      {job.siteTime ? <View style={[sc.tag,{backgroundColor:'#fef3c7'}]}><Text style={[sc.tagText,{color:'#b45309'}]}>🏗️ {job.siteTime}</Text></View> : null}
                      {job.vehicle ? <View style={[sc.tag,{backgroundColor:'#fdf4ff'}]}><Text style={[sc.tagText,{color:'#7e22ce'}]}>🚗 {job.vehicle}</Text></View> : null}
                      <View style={[sc.tag,{backgroundColor:section.accent+'18',marginLeft:'auto'}]}>
                        <Text style={[sc.tagText,{color:section.accent,fontWeight:'900'}]}>Details →</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        ))}
      </ScrollView>

      {/* Detail Modal */}
      <Modal visible={!!selectedJob} animationType="slide" transparent onRequestClose={()=>setSelectedJob(null)}>
        <View style={overlaySty}>
          <View style={cardSty}>
            {/* Modal Header */}
            <View style={headSty}>

              <View style={{ flex:1 }}>
                <Text style={sc.modalBadge}>JOB BRIEFING</Text>
                <Text style={sc.modalTitle}>{selectedJob?.projectName||'—'}</Text>
                {selectedJob?.jobNumber ? <Text style={sc.modalJobNo}>Job #{selectedJob.jobNumber}</Text> : null}
              </View>
              <TouchableOpacity onPress={()=>setSelectedJob(null)} style={sc.modalClose}>
                <Text style={sc.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:20, gap:14 }}>
              {/* Client info */}
              <View style={sc.modalSection}>
                <Text style={sc.modalSectionTitle}>CLIENT INFORMATION</Text>
                <View style={{ flexDirection:'row', gap:12, marginBottom:12 }}>
                  <View style={{ flex:1 }}>
                    <Text style={sc.modalFieldLabel}>COMPANY</Text>
                    <Text style={sc.modalFieldVal}>{selectedJob?.customerName||'—'}</Text>
                  </View>
                </View>
                {/* Paired contacts */}
                {(selectedJob?.customerContact||selectedJob?.customerPerson) ? (() => {
                  const names = String(selectedJob?.customerPerson||'').split(',').map(n=>n.trim()).filter(Boolean);
                  const nums  = String(selectedJob?.customerContact||'').split(',').map(n=>n.trim()).filter(Boolean);
                  const len   = Math.max(names.length,nums.length);
                  return (
                    <View style={{ gap:10 }}>
                      <Text style={sc.modalFieldLabel}>CONTACTS</Text>
                      {Array.from({length:len},(_,i)=>{
                        const name=names[i]||null;
                        const num=nums[i]||null;
                        return (
                          <View key={i} style={{ flexDirection:'row', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                            {name ? <View style={sc.modalNameBadge}><Text style={sc.modalNameText}>👤 {name}</Text></View> : null}
                            {num ? (
                              <TouchableOpacity onPress={()=>Linking.openURL(`tel:${num}`)} style={sc.modalPhoneBtn}>
                                <Text style={sc.modalPhoneText}>📞 {num}</Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  );
                })() : null}
              </View>

              {/* Scope */}
              <View style={sc.modalSection}>
                <Text style={sc.modalSectionTitle}>SCOPE OF WORK</Text>
                <Text style={sc.modalBodyText}>{selectedJob?.description||selectedJob?.title||'—'}</Text>
              </View>

              {/* Logistics */}
              <View style={sc.modalSection}>
                <Text style={sc.modalSectionTitle}>LOGISTICS</Text>
                <View style={{ flexDirection:'row', flexWrap:'wrap', gap:12 }}>
                  {[
                    {label:'SITE',    val: selectedJob?.site||'All Sites', icon:'📍'},
                    {label:'VEHICLE', val: selectedJob?.vehicle||'—',      icon:'🚗'},
                    {label:'OFFICE',  val: selectedJob?.officeTime||'--:--', icon:'🏢'},
                    {label:'SITE TIME',val:selectedJob?.siteTime||'--:--', icon:'🏗️'},
                  ].map(({label,val,icon})=>(
                    <View key={label} style={sc.logisticItem}>
                      <Text style={sc.modalFieldLabel}>{label}</Text>
                      <Text style={sc.logisticVal}>{icon} {val}</Text>
                    </View>
                  ))}
                </View>
                {selectedJob?.location ? (
                  <TouchableOpacity onPress={()=>Linking.openURL(normalizeUrl(selectedJob.location))} style={sc.mapModalBtn}>
                    <Text style={sc.mapModalBtnText}>🗺️  Open Navigation Map</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Team */}
              {selectedJob?.technicians?.length > 0 && (
                <View style={sc.modalSection}>
                  <Text style={sc.modalSectionTitle}>DEPLOYED TEAM</Text>
                  <View style={{ gap:8 }}>
                    {selectedJob.technicians.map((t,ti)=>(
                      <View key={ti} style={sc.teamMemberRow}>
                        <View style={sc.teamMemberNum}><Text style={sc.teamMemberNumText}>{ti+1}</Text></View>
                        <Text style={sc.teamMemberName}>{t}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Remarks */}
              {selectedJob?.remarks ? (
                <View style={[sc.modalSection,{backgroundColor:'#fffbeb',borderColor:'#fde68a',borderWidth:1}]}>
                  <Text style={[sc.modalSectionTitle,{color:'#b45309'}]}>REMARKS</Text>
                  <Text style={[sc.modalBodyText,{color:'#78350f'}]}>{selectedJob.remarks}</Text>
                </View>
              ) : null}
            </ScrollView>

            <TouchableOpacity onPress={()=>setSelectedJob(null)} style={sc.modalCloseBtn}>
              <Text style={sc.modalCloseBtnText}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const sc = StyleSheet.create({
  pageHeader: { padding:20, paddingBottom:10, backgroundColor: C.navy },
  pageTitle: { fontSize:24, fontWeight:'900', color:'#fff' },
  errText: { color:'#fca5a5', fontWeight:'700', marginTop:6, fontSize:13 },

  sectionWrap: { marginHorizontal:16, marginTop:16 },
  sectionHead: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:14, borderRadius:14, borderLeftWidth:4, marginBottom:12 },
  sectionLabel: { fontSize:9, fontWeight:'900', letterSpacing:1.2 },
  sectionDate: { fontSize:18, fontWeight:'900', color:C.navy, marginTop:2 },
  sectionDay: { fontSize:10, fontWeight:'700', color:C.muted },
  countBadge: { paddingHorizontal:14, paddingVertical:6, borderRadius:999 },
  countBadgeText: { color:'#fff', fontWeight:'900', fontSize:13 },

  emptyRow: { backgroundColor:C.white, borderRadius:12, padding:30, alignItems:'center', borderWidth:1, borderColor:C.border, borderStyle:'dashed' },
  emptyText: { color:C.muted, fontWeight:'700', fontSize:13 },

  jobCard: { backgroundColor:C.white, borderRadius:18, padding:16, marginBottom:12, borderLeftWidth:5, elevation:3, shadowColor:'#000', shadowOpacity:0.07, shadowRadius:8, gap:10 },
  cardTop: { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', gap:8 },
  cardLabel: { fontSize:9, fontWeight:'900', letterSpacing:1, marginBottom:3 },
  cardProject: { fontSize:14, fontWeight:'900', color:C.navy, lineHeight:20 },
  jobNoBadge: { borderWidth:1, borderRadius:8, padding:6, alignItems:'center', flexShrink:0 },
  jobNoLabel: { fontSize:8, fontWeight:'900' },
  jobNoVal: { fontSize:12, fontWeight:'900', fontFamily:'monospace' },

  clientBox: { backgroundColor:'#f8fafc', borderRadius:10, padding:12, gap:4 },
  clientRow: { flexDirection:'row', alignItems:'center', gap:8 },
  clientRowLabel: { fontSize:9, fontWeight:'900', color:'#94a3b8', letterSpacing:0.5, minWidth:80 },
  clientRowVal: { fontSize:12, fontWeight:'800', color:C.navy, flex:1 },

  nameBadge: { backgroundColor:'#eff6ff', borderWidth:1, borderColor:'#bfdbfe', borderRadius:20, paddingHorizontal:10, paddingVertical:3 },
  nameBadgeText: { fontSize:11, fontWeight:'900', color:'#1e40af' },
  phoneBtn: { backgroundColor:C.blue, borderRadius:20, paddingHorizontal:12, paddingVertical:5, elevation:2 },
  phoneBtnText: { color:'#fff', fontWeight:'800', fontSize:12 },

  scopeText: { fontSize:11, color:C.muted, fontWeight:'500', lineHeight:17 },

  teamBox: { backgroundColor:C.navy, borderRadius:10, padding:10 },
  teamLabel: { fontSize:9, fontWeight:'900', color:'#94a3b8', letterSpacing:0.5 },
  staffChip: { flexDirection:'row', alignItems:'center', gap:5, backgroundColor:'rgba(255,255,255,0.08)', paddingHorizontal:10, paddingVertical:4, borderRadius:20, borderWidth:1, borderColor:'rgba(251,191,36,0.3)' },
  staffNum: { width:18, height:18, borderRadius:9, backgroundColor:C.amber, alignItems:'center', justifyContent:'center' },
  staffNumText: { fontSize:9, fontWeight:'900', color:C.navy },
  staffName: { fontSize:11, fontWeight:'700', color:'#e2e8f0' },

  cardFooter: { flexDirection:'row', flexWrap:'wrap', gap:6, borderTopWidth:1, borderTopColor:'#f1f5f9', paddingTop:8 },
  tag: { backgroundColor:'#f1f5f9', paddingHorizontal:10, paddingVertical:3, borderRadius:20 },
  tagText: { fontSize:10, fontWeight:'700', color:'#334155' },

  // Modal
  modalOverlay: { 
    flex:1, 
    backgroundColor:'rgba(15,23,42,0.85)', 
    justifyContent:'center',
    alignItems: 'center',
    padding: 20
  },
  modalCard: { 
    backgroundColor: C.white, 
    borderRadius: 32, 
    height: '85%',
    maxHeight: '90%', 
    minHeight: 550,
    width: '100%',
    maxWidth: 600,
    flex: 0,
    elevation: 20,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    overflow: 'hidden'
  },


  modalHeader: { 
    backgroundColor: C.navy, 
    padding: 24, 
    flexDirection: 'row', 
    alignItems: 'center' 
  },

  modalBadge: { fontSize: 9, fontWeight: '900', color: C.amber, letterSpacing: 1.5, marginBottom: 4 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#fff', lineHeight: 24 },
  modalJobNo: { fontSize: 12, fontWeight: '700', color: '#94a3b8', marginTop: 2 },
  modalClose: { backgroundColor: 'rgba(255,255,255,0.15)', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { color: '#fff', fontWeight: '900', fontSize: 16 },



  modalSection: { backgroundColor:'#f8fafc', borderRadius:14, padding:16, marginBottom:4 },
  modalSectionTitle: { fontSize:9, fontWeight:'900', color:'#94a3b8', letterSpacing:1, marginBottom:12 },
  modalFieldLabel: { fontSize:9, fontWeight:'700', color:'#94a3b8', marginBottom:4 },
  modalFieldVal: { fontSize:15, fontWeight:'800', color:C.navy },
  modalBodyText: { fontSize:13, fontWeight:'600', color:'#334155', lineHeight:21 },

  modalNameBadge: { backgroundColor:'#eff6ff', borderWidth:1.5, borderColor:'#bfdbfe', borderRadius:20, paddingHorizontal:12, paddingVertical:5 },
  modalNameText: { fontSize:13, fontWeight:'900', color:'#1e40af' },
  modalPhoneBtn: { backgroundColor:C.blue, borderRadius:12, paddingHorizontal:16, paddingVertical:8, elevation:3 },
  modalPhoneText: { color:'#fff', fontWeight:'800', fontSize:13 },

  logisticItem: { width:'45%' },
  logisticVal: { fontSize:13, fontWeight:'800', color:C.navy, marginTop:2 },
  mapModalBtn: { marginTop:14, backgroundColor:'#1d4ed8', borderRadius:12, padding:14, alignItems:'center' },
  mapModalBtnText: { color:'#fff', fontWeight:'900', fontSize:14 },

  teamMemberRow: { flexDirection:'row', alignItems:'center', gap:10, backgroundColor:C.navy, borderRadius:12, paddingHorizontal:14, paddingVertical:10 },
  teamMemberNum: { width:26, height:26, borderRadius:13, backgroundColor:C.amber, alignItems:'center', justifyContent:'center' },
  teamMemberNumText: { fontSize:11, fontWeight:'900', color:C.navy },
  teamMemberName: { fontSize:14, fontWeight:'700', color:'#fff' },

  modalCloseBtn: { margin:16, backgroundColor:C.navy, borderRadius:16, padding:16, alignItems:'center' },
  modalCloseBtnText: { color:'#fff', fontWeight:'900', fontSize:14, letterSpacing:1 },
});