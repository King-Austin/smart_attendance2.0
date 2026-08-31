import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { BrandHeader } from '@/components/ui/brand-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MetricCard } from '@/components/ui/metric-card';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusPill } from '@/components/ui/status-pill';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAuth } from '@/providers/auth-provider';
import { mobileApi } from '@/services/mobile-api';

export default function StudentHome() {
  const { colors } = useAppTheme();
  const { profile } = useAuth();
  const courses = useQuery({ queryKey: ['student-course-ids', profile?.id], queryFn: () => mobileApi.studentCourseIds(profile!.id), enabled: Boolean(profile) });
  const sessions = useQuery({ queryKey: ['student-active-sessions', courses.data], queryFn: () => mobileApi.activeStudentSessions(courses.data ?? []), enabled: Boolean(courses.data), refetchInterval: 15_000 });
  const history = useQuery({ queryKey: ['student-history', profile?.id], queryFn: () => mobileApi.studentHistory(profile!.id), enabled: Boolean(profile) });
  const total = history.data?.length ?? 0;
  const verified = history.data?.filter((record) => record.status === 'verified').length ?? 0;
  const rate = total ? Math.round((verified / total) * 100) : 0;
  return <Screen><BrandHeader eyebrow="Student dashboard" title={`Good day, ${profile?.name.split(' ')[0] ?? 'Student'}`} subtitle="Active eligible sessions appear automatically." />
    <View style={styles.metrics}><MetricCard value={`${rate}%`} label="Overall attendance" /><MetricCard value={String(courses.data?.length ?? 0)} label="Selected courses" accent="orange" /></View>
    <SectionHeader title="Active now" />
    {sessions.isLoading ? <Card><AppText>Checking for active sessions…</AppText></Card> : sessions.data?.length ? sessions.data.map((session) => <Card key={session.id} style={{ borderColor: colors.primary }}><View style={styles.between}><StatusPill label="Attendance open" tone="success" /><AppText variant="caption" style={{ color: colors.textSecondary }}>{new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</AppText></View><AppText variant="title">{session.courseCode}</AppText><AppText variant="heading">{session.courseTitle}</AppText><AppText style={{ color: colors.textSecondary }}>{session.lecturerName} · {session.topic}</AppText><AppText variant="caption" style={{ color: colors.primary }}>Precise GPS + server-validated live face · 150 m</AppText><Button onPress={() => router.push(`/(student)/attendance/${session.id}`)}>Mark attendance</Button></Card>) : <Card><AppText variant="heading">No eligible session is open</AppText><AppText style={{ color: colors.textSecondary }}>This page refreshes automatically.</AppText></Card>}
    <SectionHeader title="Recent records" action="View history" />
    <Card>{history.data?.slice(0, 3).map((record) => <View key={record.id} style={styles.record}><View style={styles.copy}><AppText variant="label">{record.courseCode} · {record.courseTitle}</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>{new Date(record.createdAt).toLocaleString()}</AppText></View><StatusPill label={record.status === 'verified' ? 'Present' : record.status} tone={record.status === 'verified' ? 'success' : 'danger'} /></View>)}{!history.data?.length ? <AppText style={{ color: colors.textSecondary }}>No attendance has been recorded yet.</AppText> : null}</Card>
  </Screen>;
}

const styles = StyleSheet.create({ metrics: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' }, between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm }, record: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm }, copy: { flex: 1, gap: Spacing.xs } });
