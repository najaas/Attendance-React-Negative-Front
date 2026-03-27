// ============================================================
// FILE: app/(tabs)/history.jsx  – Professional Card-Based Design
// ============================================================
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Modal
} from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../providers/AuthProvider';
import { apiFetch } from '../../lib/api';

const C = {
  bg: '#f0f4f8', navy: '#0f172a', navyMid: '#1e293b', white: '#ffffff',
  muted: '#64748b', border: '#e2e8f0', amber: '#fbbf24',
  indigo: '#6366f1', indigoBg: '#eef2ff',
  green: '#10b981', greenBg: '#ecfdf5',
  red: '#ef4444', redBg: '#fef2f2',
  slate: '#94a3b8',
};

function fmt(val) {
  if (!val || val === '00:00' || val === '–' || val === '-') return '–';
  try {
    const [h24, m] = String(val).split(':').map(Number);
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    const mer = h24 >= 12 ? 'PM' : 'AM';
    return `${String(h12).padStart(2,'0')}:${String(m||0).padStart(2,'0')} ${mer}`;
  } catch { return val; }
}

function displayDate(ds) {
  if (!ds) return '—';
  const [y,m,d] = String(ds).split('-').map(Number);
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dateObj = new Date(y,m-1,d);
  return { dayName: days[dateObj.getDay()], date: `${String(d).padStart(2,'0')} ${months[m-1]}`, year: String(y) };
}

function parseSites(row) {
  const sites = [];
  for (let i = 1; i <= 6; i++) {
    const loc = row[`site${i}Location`];
    const job = row[`site${i}JobNumber`];
    const entry = row[`site${i}Entry`];
    const exit  = row[`site${i}Exit`];
    const proj  = row[`site${i}ProjectName`];
    const cust  = row[`site${i}CustomerName`];
    if (loc || job || entry || exit) {
      sites.push({ loc: loc||proj||'—', job: job||'—', entry: entry||'—', exit: exit||'—', customer: cust||'' });
    }
  }
  return sites;
}

export default function History() {
  const { token, loading } = useAuth();
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!token) return;
    setBusy(true);
    apiFetch('/attendance/employee-attendance-history', { token })
      .then((data) => {
        if (!Array.isArray(data)) return setRows([]);
        const limit = new Date(); limit.setDate(limit.getDate() - 30);
        const filtered = data.filter(h => new Date(h.date) >= limit);
        setRows(filtered.sort((a,b) => new Date(b.date) - new Date(a.date)));
      })
      .catch((e) => setErr(e.message || 'Load failed'))
      .finally(() => setBusy(false));
  }, [token]);

  if (!loading && !token) return <Redirect href="/login" />;

  const selectedSites = selected ? parseSites(selected) : [];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={h.header}>
        <Text style={h.title}>Attendance History</Text>
        <Text style={h.subtitle}>Last 30 days</Text>
        {busy && <ActivityIndicator color={C.amber} style={{ marginTop: 8 }} />}
        {err ? <Text style={h.errText}>{err}</Text> : null}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 50 }}>
        {rows.length === 0 && !busy ? (
          <View style={h.emptyWrap}>
            <Text style={{ fontSize: 48 }}>📋</Text>
            <Text style={h.emptyTitle}>No Records Yet</Text>
            <Text style={h.emptySubtitle}>Your attendance history will appear here once you start recording.</Text>
          </View>
        ) : (
          rows.map((row, idx) => {
            const d = displayDate(row.date);
            const sites = parseSites(row);
            const hasEntry = !!row.officeEntryTime;
            const hasExit  = !!row.officeExitTime;
            return (
              <TouchableOpacity key={idx} activeOpacity={0.85} onPress={() => setSelected(row)}>
                <View style={h.card}>
                  {/* Left date column */}
                  <View style={h.dateCol}>
                    <Text style={h.dateDay}>{d.dayName}</Text>
                    <Text style={h.dateNum}>{d.date.split(' ')[0]}</Text>
                    <Text style={h.dateMon}>{d.date.split(' ')[1]}</Text>
                    <Text style={h.dateYear}>{d.year}</Text>
                  </View>

                  {/* Main content */}
                  <View style={h.cardBody}>
                    {/* Office times */}
                    <View style={h.officeRow}>
                      <View style={[h.timeCell, { backgroundColor: hasEntry ? C.indigoBg : '#f8fafc' }]}>
                        <Text style={h.timeCellLabel}>OFFICE OUT</Text>
                        <Text style={[h.timeCellVal, { color: hasEntry ? C.indigo : C.slate }]}>
                          {fmt(row.officeEntryTime)}
                        </Text>
                      </View>
                      <View style={[h.timeCell, { backgroundColor: hasExit ? '#ecfdf5' : '#f8fafc' }]}>
                        <Text style={h.timeCellLabel}>OFFICE IN</Text>
                        <Text style={[h.timeCellVal, { color: hasExit ? C.green : C.slate }]}>
                          {fmt(row.officeExitTime)}
                        </Text>
                      </View>
                    </View>

                    {/* Sites summary */}
                    {sites.length > 0 && (
                      <View style={h.siteSummary}>
                        <Text style={h.siteSummaryLabel}>🏗️ {sites.length} Site Visit{sites.length > 1 ? 's' : ''}</Text>
                        {sites.map((s, si) => (
                          <View key={si} style={h.siteRow}>
                            <View style={h.siteDot} />
                            <Text style={h.siteLocText} numberOfLines={1}>{s.loc}</Text>
                            <Text style={h.siteTimeText}>{fmt(s.entry)} → {fmt(s.exit)}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    <View style={h.viewMoreRow}>
                      <Text style={h.viewMore}>Full Details →</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Detail Modal */}
      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={h.modalOverlay}>
          <View style={h.modalCard}>
            {/* Modal Header */}
            {selected && (() => {
              const d = displayDate(selected.date);
              return (
                <View style={h.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={h.modalBadge}>ATTENDANCE RECORD</Text>
                    <Text style={h.modalDate}>{d.date} {d.year}</Text>
                    <Text style={h.modalDayName}>{d.dayName.toUpperCase()}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelected(null)} style={h.modalClose}>
                    <Text style={h.modalCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })()}

            <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
              {/* Office Times */}
              <View style={h.modalSection}>
                <Text style={h.modalSectionTitle}>OFFICE PRESENCE</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={[h.modalTimeBox, { flex: 1, backgroundColor: selected?.officeEntryTime ? C.indigoBg : '#f8fafc' }]}>
                    <Text style={h.modalTimeLabel}>DEPARTURE (OUT)</Text>
                    <Text style={[h.modalTimeVal, { color: selected?.officeEntryTime ? C.indigo : C.slate }]}>
                      {fmt(selected?.officeEntryTime)}
                    </Text>
                  </View>
                  <View style={[h.modalTimeBox, { flex: 1, backgroundColor: selected?.officeExitTime ? '#ecfdf5' : '#f8fafc' }]}>
                    <Text style={h.modalTimeLabel}>ARRIVAL (IN)</Text>
                    <Text style={[h.modalTimeVal, { color: selected?.officeExitTime ? C.green : C.slate }]}>
                      {fmt(selected?.officeExitTime)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Site nodes */}
              {selectedSites.length > 0 && (
                <View style={h.modalSection}>
                  <Text style={h.modalSectionTitle}>SITE DEPLOYMENTS ({selectedSites.length})</Text>
                  {selectedSites.map((s, si) => (
                    <View key={si} style={h.modalSiteCard}>
                      <View style={h.modalSiteHeader}>
                        <View style={h.modalSiteNum}><Text style={h.modalSiteNumText}>{si+1}</Text></View>
                        <Text style={h.modalSiteLoc} numberOfLines={2}>{s.loc}</Text>
                      </View>
                      {s.job !== '—' && (
                        <Text style={h.modalSiteJob}>Job #{s.job}</Text>
                      )}
                      {s.customer ? <Text style={h.modalSiteCust}>🏢 {s.customer}</Text> : null}
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                        <View style={[h.modalSiteTime, { backgroundColor: C.indigoBg }]}>
                          <Text style={h.modalSiteTimeLabel}>ARRIVAL</Text>
                          <Text style={[h.modalSiteTimeVal, { color: C.indigo }]}>{fmt(s.entry)}</Text>
                        </View>
                        <View style={[h.modalSiteTime, { backgroundColor: '#fef3c7' }]}>
                          <Text style={h.modalSiteTimeLabel}>DEPARTURE</Text>
                          <Text style={[h.modalSiteTimeVal, { color: '#b45309' }]}>{fmt(s.exit)}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {selectedSites.length === 0 && (
                <View style={[h.modalSection, { alignItems: 'center', paddingVertical: 30 }]}>
                  <Text style={{ fontSize: 32 }}>🏠</Text>
                  <Text style={[h.modalSectionTitle, { marginTop: 10, textAlign: 'center' }]}>OFFICE ONLY DAY</Text>
                  <Text style={{ color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 4 }}>No site visits recorded</Text>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity onPress={() => setSelected(null)} style={h.modalCloseBtn}>
              <Text style={h.modalCloseBtnText}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const h = StyleSheet.create({
  header: { backgroundColor: C.navy, padding: 24, paddingTop: 28, paddingBottom: 20 },
  title: { fontSize: 26, fontWeight: '900', color: '#fff' },
  subtitle: { fontSize: 12, fontWeight: '700', color: '#64748b', marginTop: 2 },
  errText: { color: '#fca5a5', fontWeight: '700', marginTop: 6, fontSize: 13 },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: C.navy },
  emptySubtitle: { fontSize: 13, color: C.muted, textAlign: 'center', fontWeight: '600', lineHeight: 20, maxWidth: 260 },

  card: { backgroundColor: C.white, borderRadius: 18, marginBottom: 12, flexDirection: 'row', overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8 },
  dateCol: { width: 66, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 2 },
  dateDay: { fontSize: 9, fontWeight: '900', color: C.amber, letterSpacing: 1 },
  dateNum: { fontSize: 24, fontWeight: '900', color: '#fff' },
  dateMon: { fontSize: 10, fontWeight: '800', color: '#94a3b8' },
  dateYear: { fontSize: 9, fontWeight: '700', color: '#64748b' },

  cardBody: { flex: 1, padding: 14, gap: 10 },
  officeRow: { flexDirection: 'row', gap: 8 },
  timeCell: { flex: 1, padding: 10, borderRadius: 12, alignItems: 'center' },
  timeCellLabel: { fontSize: 8, fontWeight: '900', color: '#94a3b8', letterSpacing: 0.5, marginBottom: 3 },
  timeCellVal: { fontSize: 15, fontWeight: '900' },

  siteSummary: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, gap: 5 },
  siteSummaryLabel: { fontSize: 9, fontWeight: '900', color: '#94a3b8', letterSpacing: 0.5, marginBottom: 3 },
  siteRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  siteDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.indigo, flexShrink: 0 },
  siteLocText: { fontSize: 11, fontWeight: '700', color: C.navy, flex: 1 },
  siteTimeText: { fontSize: 10, fontWeight: '600', color: C.muted },

  viewMoreRow: { alignItems: 'flex-end' },
  viewMore: { fontSize: 10, fontWeight: '900', color: C.indigo },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.8)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: C.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '92%' },
  modalHeader: { backgroundColor: C.navy, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, flexDirection: 'row', alignItems: 'flex-start' },
  modalBadge: { fontSize: 9, fontWeight: '900', color: C.amber, letterSpacing: 1.5, marginBottom: 6 },
  modalDate: { fontSize: 20, fontWeight: '900', color: '#fff' },
  modalDayName: { fontSize: 12, fontWeight: '700', color: '#64748b', marginTop: 2 },
  modalClose: { backgroundColor: 'rgba(255,255,255,0.1)', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { color: '#fff', fontWeight: '900', fontSize: 16 },

  modalSection: { backgroundColor: '#f8fafc', borderRadius: 14, padding: 16, marginBottom: 4 },
  modalSectionTitle: { fontSize: 9, fontWeight: '900', color: '#94a3b8', letterSpacing: 1, marginBottom: 12 },
  modalTimeBox: { padding: 14, borderRadius: 12, alignItems: 'center' },
  modalTimeLabel: { fontSize: 8, fontWeight: '900', color: '#94a3b8', letterSpacing: 0.5, marginBottom: 5 },
  modalTimeVal: { fontSize: 20, fontWeight: '900' },

  modalSiteCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border, borderLeftWidth: 4, borderLeftColor: C.indigo },
  modalSiteHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  modalSiteNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.indigo, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  modalSiteNumText: { fontSize: 10, fontWeight: '900', color: '#fff' },
  modalSiteLoc: { fontSize: 13, fontWeight: '800', color: C.navy, flex: 1 },
  modalSiteJob: { fontSize: 11, fontWeight: '700', color: C.muted, marginBottom: 2 },
  modalSiteCust: { fontSize: 11, fontWeight: '700', color: '#475569' },
  modalSiteTime: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center' },
  modalSiteTimeLabel: { fontSize: 8, fontWeight: '900', color: '#94a3b8', letterSpacing: 0.5, marginBottom: 3 },
  modalSiteTimeVal: { fontSize: 14, fontWeight: '900' },

  modalCloseBtn: { margin: 16, backgroundColor: C.navy, borderRadius: 16, padding: 16, alignItems: 'center' },
  modalCloseBtnText: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
});