import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { BrandHeader } from '@/components/ui/brand-header';
import { Card } from '@/components/ui/card';
import { MetricCard } from '@/components/ui/metric-card';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusPill } from '@/components/ui/status-pill';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

export default function AdminHome() {
  const { colors } = useAppTheme();
  return <Screen><BrandHeader eyebrow="Faculty administration" title="Operations overview" subtitle="Manage lecturer approval and academic structure across your faculty." /><View style={styles.metrics}><MetricCard value="4" label="Departments" /><MetricCard value="86" label="Seeded courses" accent="orange" /><MetricCard value="3" label="Pending lecturers" accent="gold" /></View><SectionHeader title="Requires attention" /><Card style={{ borderColor: colors.warning }}><View style={styles.between}><View><AppText variant="heading">Lecturer approvals</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>Three new staff profiles need review.</AppText></View><StatusPill label="3 pending" tone="warning" /></View></Card><SectionHeader title="Today’s attendance" /><Card><View style={styles.between}><View><AppText variant="heading">9 sessions</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>Across 4 departments</AppText></View><View><AppText variant="heading" style={{ color: colors.success }}>81%</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>Average attendance</AppText></View></View></Card></Screen>;
}

const styles = StyleSheet.create({ metrics: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md } });
