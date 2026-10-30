import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
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
import { useAuth } from '@/providers/auth-provider';
import { mobileApi } from '@/services/mobile-api';
import { exportSessionCsv } from '@/services/report-export';
import type { AttendanceRecord } from '@/types/data';

export default function LecturerSessions() {
  const params = useLocalSearchParams<{ sessionId?: string }>(); const { colors } = useAppTheme(); const { profile } = useAuth(); const queryClient = useQueryClient();
  const courses = useQuery({ queryKey: ['lecturer-assigned-courses', profile?.id], queryFn: () => mobileApi.assignedLecturerCourses(profile!.id), enabled: Boolean(profile) });
  const sessions = useQuery({ queryKey: ['lecturer-sessions', courses.data?.map((item) => item.id)], queryFn: () => mobileApi.lecturerSessions(courses.data?.map((item) => item.id) ?? []), enabled: Boolean(courses.data), refetchInterval: 10_000 });
  const [selectedId, setSelectedId] = useState(params.sessionId ?? '');
  const effectiveSelectedId = selectedId || sessions.data?.[0]?.id || '';
  const selected = useMemo(() => sessions.data?.find((item) => item.id === effectiveSelectedId), [effectiveSelectedId, sessions.data]);
  const records = useQuery({ queryKey: ['session-records', effectiveSelectedId], queryFn: () => mobileApi.sessionRecords(effectiveSelectedId), enabled: Boolean(effectiveSelectedId), refetchInterval: selected?.status === 'active' ? 5_000 : false });
  const end = useMutation({ mutationFn: () => mobileApi.endSession(effectiveSelectedId), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['lecturer-sessions'] }); } });
  const [editing, setEditing] = useState<AttendanceRecord | null>(null); const [nextStatus, setNextStatus] = useState<AttendanceRecord['status']>('verified'); const [reason, setReason] = useState('');
  const correct = useMutation({ mutationFn: () => mobileApi.correctAttendance(editing!.id, nextStatus, reason), onSuccess: async () => { setEditing(null); setReason(''); await queryClient.invalidateQueries({ queryKey: ['session-records', effectiveSelectedId] }); } });
  return <Screen><BrandHeader eyebrow="Realtime ledger" title="Attendance sessions" subtitle="Assigned lecturers can view shared-course ledgers. Only the creator can correct a record." />
    <Card><AppText variant="label">Choose session</AppText>{sessions.data?.map((session) => <Pressable key={session.id} onPress={() => setSelectedId(session.id)} style={[styles.option, { borderColor: effectiveSelectedId === session.id ? colors.primary : colors.border }]}><View style={styles.copy}><AppText variant="label">{session.courseCode} · {session.topic}</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>{session.date} · {session.lecturerName}</AppText></View><StatusPill label={session.status} tone={session.status === 'active' ? 'success' : 'info'} /></Pressable>)}{!sessions.data?.length ? <AppText>No session has been created for your courses.</AppText> : null}</Card>
    {selected ? <><Card><View style={styles.between}><View style={styles.copy}><AppText variant="title">{selected.courseCode}</AppText><AppText variant="heading">{selected.topic}</AppText></View><StatusPill label={selected.status} tone={selected.status === 'active' ? 'success' : 'info'} /></View><AppText variant="caption" style={{ color: colors.textSecondary }}>{records.data?.length ?? 0} of {selected.enrolledCount} enrolled students recorded</AppText>{selected.status === 'active' && selected.lecturerId === profile?.id ? <Button variant="danger" loading={end.isPending} onPress={() => end.mutate()}>End session</Button> : null}</Card>
      <Card><AppText variant="heading">Attendance ledger</AppText>{records.data?.map((record) => <View key={record.id} style={[styles.record, { borderBottomColor: colors.border }]}><View style={styles.copy}><AppText variant="label">{record.studentName}</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>{record.regNumber ?? 'No registration number'} · {new Date(record.createdAt).toLocaleTimeString()}</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>Face {record.faceScore ? Math.round(record.faceScore * 100) : 0}% · {record.distance ?? '—'} m · GPS ±{record.gpsAccuracy ?? '—'} m</AppText></View><StatusPill label={record.status} tone={record.status === 'verified' ? 'success' : 'danger'} />{selected.lecturerId === profile?.id ? <Button variant="ghost" onPress={() => { setEditing(record); setNextStatus(record.status); }}>Correct</Button> : null}</View>)}{!records.data?.length ? <AppText>No check-ins recorded yet.</AppText> : null}<Button variant="secondary" disabled={!records.data?.length} onPress={() => void exportSessionCsv(selected, records.data ?? [])}>Export CSV ledger</Button></Card>
      {editing ? <Card style={{ borderColor: colors.gold }}><AppText variant="heading">Correct {editing.studentName}</AppText><View style={styles.statuses}>{(['verified', 'missed', 'failed'] as const).map((status) => <Pressable key={status} onPress={() => setNextStatus(status)} style={[styles.pill, { backgroundColor: nextStatus === status ? colors.primary : colors.surfaceMuted }]}><AppText variant="caption" style={{ color: nextStatus === status ? '#fff' : colors.text }}>{status}</AppText></Pressable>)}</View><TextInput value={reason} onChangeText={setReason} multiline placeholder="Required correction reason (minimum 8 characters)" placeholderTextColor={colors.textFaint} style={[styles.reason, { color: colors.text, borderColor: colors.border }]} />{correct.error ? <AppText style={{ color: colors.danger }}>{correct.error.message}</AppText> : null}<Button disabled={reason.trim().length < 8} loading={correct.isPending} onPress={() => correct.mutate()}>Save audited correction</Button><Button variant="ghost" onPress={() => setEditing(null)}>Cancel</Button></Card> : null}</> : null}
  </Screen>;
}

const styles = StyleSheet.create({ option: { minHeight: 58, borderWidth: 2, borderRadius: Radius.md, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md }, between: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md }, copy: { flex: 1, gap: Spacing.xs }, record: { gap: Spacing.sm, paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth }, statuses: { flexDirection: 'row', gap: Spacing.sm }, pill: { flex: 1, borderRadius: Radius.pill, alignItems: 'center', padding: Spacing.sm }, reason: { minHeight: 92, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, textAlignVertical: 'top' } });
