import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { BrandHeader } from '@/components/ui/brand-header';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { StatusPill } from '@/components/ui/status-pill';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

const records = [
  ['EEE 510', 'Software Engineering', '21 Aug 2026 · 10:14', 'Present'],
  ['EEE 501', 'Computer Aided Design', '19 Aug 2026 · 09:07', 'Present'],
  ['EEE 509', 'Database Management Systems', '15 Aug 2026 · 12:12', 'Absent'],
];

export default function StudentHistory() {
  const { colors } = useAppTheme();
  return <Screen><BrandHeader eyebrow="Attendance report" title="History" subtitle="A permanent view of your verified course attendance." /><Card>{records.map(([code, title, date, status]) => <View key={`${code}-${date}`} style={[styles.row, { borderBottomColor: colors.border }]}><View style={styles.copy}><AppText variant="label">{code} · {title}</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>{date}</AppText></View><StatusPill label={status} tone={status === 'Present' ? 'success' : 'danger'} /></View>)}</Card></Screen>;
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth }, copy: { flex: 1, gap: Spacing.xs } });
