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

export default function LecturerHome() {
  const { colors } = useAppTheme();
  const { profile } = useAuth();
  return <Screen><BrandHeader eyebrow="Lecturer dashboard" title={`Welcome, ${profile?.name ?? 'Lecturer'}`} subtitle="Open sessions and monitor verified check-ins in real time." /><View style={styles.metrics}><MetricCard value="2" label="Assigned courses" /><MetricCard value="74" label="Students enrolled" accent="orange" /></View><Button onPress={() => router.push('/(lecturer)/create-session')}>Open attendance session</Button><SectionHeader title="Live session" /><Card style={{ borderColor: colors.success }}><View style={styles.between}><StatusPill label="Open" tone="success" /><AppText variant="caption" style={{ color: colors.textSecondary }}>12 min elapsed</AppText></View><AppText variant="title">EEE 510</AppText><AppText variant="heading">Software Engineering</AppText><View style={styles.metrics}><MetricCard value="38" label="Verified" /><MetricCard value="52" label="Expected" accent="gold" /></View><Button variant="secondary" onPress={() => router.push('/(lecturer)/(tabs)/sessions')}>View live ledger</Button></Card><SectionHeader title="Today" /><Card><AppText variant="label">EEE 509 · Database Management Systems</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>Ended 12:40 · 46/51 verified</AppText></Card></Screen>;
}

const styles = StyleSheet.create({ metrics: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' }, between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' } });
