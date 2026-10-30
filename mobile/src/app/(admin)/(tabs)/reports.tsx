import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { BrandHeader } from '@/components/ui/brand-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { StatusPill } from '@/components/ui/status-pill';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { mobileApi } from '@/services/mobile-api';
import { exportSessionCsv } from '@/services/report-export';
import type { AttendanceRecord } from '@/types/data';

export default function AdminReports() {
  const { colors } = useAppTheme(); const queryClient = useQueryClient(); const sessions = useQuery({ queryKey: ['admin-sessions'], queryFn: mobileApi.adminSessions, refetchInterval: 15_000 });
  const [selectedId, setSelectedId] = useState(''); const effectiveId = selectedId || sessions.data?.[0]?.id || ''; const selected = useMemo(() => sessions.data?.find((item) => item.id === effectiveId), [effectiveId, sessions.data]);
  const records = useQuery({ queryKey: ['admin-session-records', effectiveId], queryFn: () => mobileApi.sessionRecords(effectiveId), enabled: Boolean(effectiveId) });
  const [editing, setEditing] = useState<AttendanceRecord | null>(null); const [status, setStatus] = useState<AttendanceRecord['status']>('verified'); const [reason, setReason] = useState('');
  const correction = useMutation({ mutationFn: () => mobileApi.correctAttendance(editing!.id, status, reason), onSuccess: async () => { setEditing(null); setReason(''); await queryClient.invalidateQueries({ queryKey: ['admin-session-records', effectiveId] }); } });
  return <Screen><BrandHeader eyebrow="Faculty reports" title="Session ledgers" subtitle="Administrators can export every ledger and make reasoned, permanently audited corrections." /><Card>{sessions.data?.map((session) => <Pressable key={session.id} onPress={() => setSelectedId(session.id)} style={[styles.option, { borderColor: effectiveId === session.id ? colors.primary : colors.border }]}><View style={styles.copy}><AppText variant="label">{session.courseCode} · {session.topic}</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>{session.date} · {session.lecturerName}</AppText></View><StatusPill label={session.status} tone={session.status === 'active' ? 'success' : 'info'} /></Pressable>)}{!sessions.data?.length ? <AppText>No sessions found.</AppText> : null}</Card>{selected ? <Card><AppText variant="heading">{selected.courseCode} ledger</AppText>{records.data?.map((record) => <View key={record.id} style={[styles.record, { borderBottomColor: colors.border }]}><View style={styles.copy}><AppText variant="label">{record.studentName}</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>{record.regNumber} · {new Date(record.createdAt).toLocaleString()}</AppText></View><StatusPill label={record.status} tone={record.status === 'verified' ? 'success' : 'danger'} /><Button variant="ghost" onPress={() => { setEditing(record); setStatus(record.status); }}>Correct</Button></View>)}<Button variant="secondary" disabled={!records.data?.length} onPress={() => void exportSessionCsv(selected, records.data ?? [])}>Export CSV</Button></Card> : null}{editing ? <Card style={{ borderColor: colors.gold }}><AppText variant="heading">Correct {editing.studentName}</AppText><View style={styles.row}>{(['verified', 'missed', 'failed'] as const).map((item) => <Pressable key={item} onPress={() => setStatus(item)} style={[styles.pill, { backgroundColor: status === item ? colors.primary : colors.surfaceMuted }]}><AppText variant="caption" style={{ color: status === item ? '#fff' : colors.text }}>{item}</AppText></Pressable>)}</View><TextInput value={reason} onChangeText={setReason} multiline placeholder="Required reason" placeholderTextColor={colors.textFaint} style={[styles.reason, { borderColor: colors.border, color: colors.text }]} />{correction.error ? <AppText style={{ color: colors.danger }}>{correction.error.message}</AppText> : null}<Button disabled={reason.trim().length < 8} loading={correction.isPending} onPress={() => correction.mutate()}>Save audited correction</Button><Button variant="ghost" onPress={() => setEditing(null)}>Cancel</Button></Card> : null}</Screen>;
}

const styles = StyleSheet.create({ option: { minHeight: 58, borderWidth: 2, borderRadius: Radius.md, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md }, copy: { flex: 1, gap: Spacing.xs }, record: { gap: Spacing.sm, paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth }, row: { flexDirection: 'row', gap: Spacing.sm }, pill: { flex: 1, borderRadius: Radius.pill, alignItems: 'center', padding: Spacing.sm }, reason: { minHeight: 90, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, textAlignVertical: 'top' } });
