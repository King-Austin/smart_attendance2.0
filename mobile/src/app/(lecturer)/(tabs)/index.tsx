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

export default function LecturerHome() {
  const { colors } = useAppTheme();
  const { profile } = useAuth();
  const courses = useQuery({ queryKey: ['lecturer-assigned-courses', profile?.id], queryFn: () => mobileApi.assignedLecturerCourses(profile!.id), enabled: Boolean(profile?.id && profile.approvalStatus === 'approved') });
  const sessions = useQuery({ queryKey: ['lecturer-sessions', courses.data?.map((item) => item.id)], queryFn: () => mobileApi.lecturerSessions(courses.data?.map((item) => item.id) ?? []), enabled: Boolean(courses.data), refetchInterval: 10_000 });
  const active = sessions.data?.filter((session) => session.status === 'active') ?? [];
  if (profile?.approvalStatus !== 'approved') return <Screen><BrandHeader eyebrow="Lecturer account" title="Approval pending" subtitle="An administrator must verify your staff identity and department." /><Card style={{ backgroundColor: colors.warningSoft }}><StatusPill label={profile?.approvalStatus ?? 'pending'} tone="warning" /><AppText variant="heading">Course and session access is locked</AppText><AppText>You will receive a push notification as soon as an administrator approves the account.</AppText></Card></Screen>;
  return <Screen><BrandHeader eyebrow="Lecturer dashboard" title={`Welcome, ${profile?.name ?? 'Lecturer'}`} subtitle="Open sessions and monitor verified check-ins." /><View style={styles.metrics}><MetricCard value={String(courses.data?.length ?? 0)} label="Selected courses" /><MetricCard value={String(active.length)} label="Active sessions" accent="orange" /></View><Button disabled={!courses.data?.length} onPress={() => router.push('/(lecturer)/create-session')}>Open attendance session</Button><SectionHeader title="Active sessions" />{active.length ? active.map((session) => <Card key={session.id} style={{ borderColor: colors.success }}><View style={styles.between}><StatusPill label="Open" tone="success" /><AppText variant="caption">{new Date(session.startTime).toLocaleTimeString()}</AppText></View><AppText variant="title">{session.courseCode}</AppText><AppText variant="heading">{session.topic}</AppText><Button variant="secondary" onPress={() => router.push({ pathname: '/(lecturer)/(tabs)/sessions', params: { sessionId: session.id } })}>View live ledger</Button></Card>) : <Card><AppText>No active session.</AppText></Card>}<SectionHeader title="Recent sessions" /><Card>{sessions.data?.filter((item) => item.status !== 'active').slice(0, 4).map((session) => <View key={session.id} style={styles.row}><View style={styles.copy}><AppText variant="label">{session.courseCode} · {session.topic}</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>{session.date}</AppText></View><StatusPill label={session.status} /></View>)}</Card></Screen>;
}

const styles = StyleSheet.create({ metrics: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' }, between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm }, copy: { flex: 1 } });
