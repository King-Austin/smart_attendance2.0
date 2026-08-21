import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { BrandHeader } from '@/components/ui/brand-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { StatusPill } from '@/components/ui/status-pill';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

const checkIns = [['King Austin', '2021/123456', '12:14'], ['Adaeze Okafor', '2021/120184', '12:13'], ['Chinedu Nwafor', '2021/122903', '12:11']];

export default function LecturerSessions() {
  const { colors } = useAppTheme();
  return <Screen><BrandHeader eyebrow="Live monitoring" title="Attendance sessions" subtitle="Verified check-ins appear here through Supabase Realtime." /><Card><View style={styles.between}><View><AppText variant="heading">EEE 510 · Software Engineering</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>Session SES-2026-1204</AppText></View><StatusPill label="Open" tone="success" /></View><View style={[styles.progressTrack, { backgroundColor: colors.surfaceMuted }]}><View style={[styles.progress, { backgroundColor: colors.success }]} /></View><AppText variant="caption" style={{ color: colors.textSecondary }}>38 of 52 students verified</AppText><Button variant="danger">End session</Button></Card><Card><AppText variant="heading">Latest check-ins</AppText>{checkIns.map(([name, reg, time]) => <View key={reg} style={[styles.checkIn, { borderBottomColor: colors.border }]}><View style={styles.copy}><AppText variant="label">{name}</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>{reg}</AppText></View><StatusPill label={time} tone="success" /></View>)}<Button variant="secondary">Export ledger</Button></Card></Screen>;
}

const styles = StyleSheet.create({ between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.md }, progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' }, progress: { width: '73%', height: '100%' }, checkIn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth }, copy: { flex: 1 } });
