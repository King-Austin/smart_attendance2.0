import { useQuery } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { BrandHeader } from '@/components/ui/brand-header';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { StatusPill } from '@/components/ui/status-pill';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAuth } from '@/providers/auth-provider';
import { mobileApi } from '@/services/mobile-api';

export default function StudentHistory() {
  const { colors } = useAppTheme();
  const { profile } = useAuth();
  const history = useQuery({ queryKey: ['student-history', profile?.id], queryFn: () => mobileApi.studentHistory(profile!.id), enabled: Boolean(profile) });
  return <Screen><BrandHeader eyebrow="Attendance report" title="History" subtitle="Your server-verified and corrected attendance ledger." /><Card>{history.isLoading ? <AppText>Loading history…</AppText> : history.data?.map((record) => <View key={record.id} style={[styles.row, { borderBottomColor: colors.border }]}><View style={styles.copy}><AppText variant="label">{record.courseCode} · {record.courseTitle}</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>{new Date(record.createdAt).toLocaleString()} · {record.topic}</AppText>{record.correctedAt ? <AppText variant="caption" style={{ color: colors.gold }}>Corrected with audit trail</AppText> : null}</View><StatusPill label={record.status === 'verified' ? 'Present' : record.status} tone={record.status === 'verified' ? 'success' : 'danger'} /></View>)}{!history.data?.length && !history.isLoading ? <AppText>No attendance records yet.</AppText> : null}</Card></Screen>;
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth }, copy: { flex: 1, gap: Spacing.xs } });
