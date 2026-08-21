import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

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

export default function StudentHome() {
  const { colors } = useAppTheme();
  const { profile } = useAuth();
  const firstName = profile?.name.split(' ')[0] ?? 'Student';
  return (
    <Screen>
      <BrandHeader eyebrow="Student dashboard" title={`Good day, ${firstName}`} subtitle="Your verified attendance at a glance." />
      <View style={styles.metrics}><MetricCard value="84%" label="Overall attendance" /><MetricCard value="3" label="Courses this semester" accent="orange" /></View>
      <SectionHeader title="Active now" />
      <Card style={{ borderColor: colors.primary }}>
        <View style={styles.between}><StatusPill label="Attendance open" tone="success" /><AppText variant="caption" style={{ color: colors.textSecondary }}>Opened 8 min ago</AppText></View>
        <View><AppText variant="title">EEE 509</AppText><AppText variant="heading">Database Management Systems</AppText></View>
        <AppText style={{ color: colors.textSecondary }}>Dr. Kemi Alabi · Engineering Block B</AppText>
        <View style={[styles.notice, { backgroundColor: colors.primarySoft }]}><AppText variant="caption" style={{ color: colors.primary }}>Precise GPS + live face required · 150 m radius</AppText></View>
        <Button onPress={() => router.push('/(student)/attendance/SES-2026-1204')}>Mark attendance</Button>
      </Card>
      <SectionHeader title="Recent records" action="View history" />
      <Card>
        {[['EEE 510', 'Software Engineering', 'Verified · Today, 10:14'], ['EEE 501', 'Computer Aided Design', 'Verified · 19 Aug, 09:07']].map(([code, title, meta]) => (
          <Pressable key={code} style={styles.record}><View style={styles.recordCopy}><AppText variant="label">{code} · {title}</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>{meta}</AppText></View><StatusPill label="Present" tone="success" /></Pressable>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({ metrics: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm }, notice: { padding: Spacing.md, borderRadius: 12 }, record: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, gap: Spacing.md }, recordCopy: { flex: 1, gap: Spacing.xs } });
