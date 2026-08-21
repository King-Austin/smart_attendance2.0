import { useQuery } from '@tanstack/react-query';
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
import { mobileApi } from '@/services/mobile-api';

export default function AdminHome() {
  const { colors } = useAppTheme(); const overview = useQuery({ queryKey: ['admin-overview'], queryFn: mobileApi.adminOverview, refetchInterval: 30_000 }); const item = overview.data;
  return <Screen><BrandHeader eyebrow="Faculty administration" title="Operations overview" subtitle="Live counts from Supabase across lecturer approvals and academic structure." /><View style={styles.metrics}><MetricCard value={String(item?.departments ?? 0)} label="Departments" /><MetricCard value={String(item?.courses ?? 0)} label="Courses" accent="orange" /><MetricCard value={String(item?.pending ?? 0)} label="Pending lecturers" accent="gold" /></View><SectionHeader title="Requires attention" /><Card style={{ borderColor: item?.pending ? colors.warning : colors.success }}><View style={styles.between}><View><AppText variant="heading">Lecturer approvals</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>{item?.pending ? `${item.pending} staff profiles need review.` : 'No pending profiles.'}</AppText></View><StatusPill label={`${item?.pending ?? 0} pending`} tone={item?.pending ? 'warning' : 'success'} /></View></Card><SectionHeader title="Today’s attendance" /><Card><View style={styles.between}><View><AppText variant="heading">{item?.sessions ?? 0} sessions</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>Opened today</AppText></View><View><AppText variant="heading" style={{ color: colors.success }}>{item?.attendanceRate ?? 0}%</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>Verified records</AppText></View></View></Card></Screen>;
}
const styles = StyleSheet.create({ metrics: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md } });
