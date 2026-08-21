import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { PermissionPrimer } from '@/components/permissions/permission-primer';
import { AppText } from '@/components/ui/app-text';
import { BrandHeader } from '@/components/ui/brand-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { StatusPill } from '@/components/ui/status-pill';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

export default function CreateSession() {
  const { colors } = useAppTheme();
  const [locationReady, setLocationReady] = useState(false);
  const [topic, setTopic] = useState('Relational database design');
  return <Screen><BrandHeader eyebrow="New attendance session" title="Open a session" subtitle="The session anchors to your precise current location and stays open until you end it." /><Card><AppText variant="label">Course</AppText><View style={[styles.select, { borderColor: colors.border, backgroundColor: colors.background }]}><View><AppText variant="label">EEE 509</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>Database Management Systems</AppText></View><AppText style={{ color: colors.primary }}>⌄</AppText></View><AppText variant="label">Topic</AppText><TextInput value={topic} onChangeText={setTopic} placeholder="Lecture topic" placeholderTextColor={colors.textFaint} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} /><View style={styles.between}><View><AppText variant="label">Attendance radius</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>Fixed university policy</AppText></View><StatusPill label={`${Brand.attendanceRadiusMeters} metres`} /></View></Card>{!locationReady ? <PermissionPrimer kind="location" onGranted={() => setLocationReady(true)} /> : <Card style={{ backgroundColor: colors.successSoft }}><StatusPill label="Location ready" tone="success" /><AppText variant="caption" style={{ color: colors.textSecondary }}>A precise anchor will be captured when the session opens.</AppText></Card>}<Button disabled={!locationReady || !topic.trim()} onPress={() => router.replace('/(lecturer)/(tabs)/sessions')}>Open attendance now</Button><Button variant="ghost" onPress={() => router.back()}>Cancel</Button></Screen>;
}

const styles = StyleSheet.create({ input: { minHeight: 52, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, fontSize: 15 }, select: { minHeight: 64, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md } });
