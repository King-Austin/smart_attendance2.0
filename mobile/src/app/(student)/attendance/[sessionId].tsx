import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PermissionPrimer } from '@/components/permissions/permission-primer';
import { AppText } from '@/components/ui/app-text';
import { BrandHeader } from '@/components/ui/brand-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { StatusPill } from '@/components/ui/status-pill';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

type Stage = 'location-permission' | 'location-scan' | 'camera-permission' | 'face' | 'done';

export default function AttendanceCheckIn() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { colors } = useAppTheme();
  const [stage, setStage] = useState<Stage>('location-permission');
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scanLocation = async () => {
    setStage('location-scan');
    setError(null);
    try {
      const samples = await Promise.all([1, 2, 3].map(() => Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation })));
      const best = samples.reduce((current, sample) => (sample.coords.accuracy ?? Infinity) < (current.coords.accuracy ?? Infinity) ? sample : current);
      const bestAccuracy = best.coords.accuracy ?? Infinity;
      setAccuracy(Number.isFinite(bestAccuracy) ? Math.round(bestAccuracy) : null);
      if (bestAccuracy > 25) {
        setError(`GPS accuracy is ${Number.isFinite(bestAccuracy) ? Math.round(bestAccuracy) : 'unknown'} m. Move into an open area and retry.`);
        setStage('location-permission');
        return;
      }
      setStage('camera-permission');
    } catch {
      setError('Precise location could not be acquired. Check that GPS is enabled and retry.');
      setStage('location-permission');
    }
  };

  return (
    <Screen>
      <BrandHeader eyebrow={`Session ${sessionId}`} title="Verify attendance" subtitle="EEE 509 · Database Management Systems" />
      <Card><View style={styles.steps}>{[['1', 'Precise location', stage !== 'location-permission' ? 'done' : 'active'], ['2', 'Live face', stage === 'face' || stage === 'done' ? 'active' : 'pending'], ['3', 'Recorded', stage === 'done' ? 'done' : 'pending']].map(([number, label, state]) => <View key={number} style={styles.step}><View style={[styles.number, { backgroundColor: state === 'pending' ? colors.surfaceMuted : colors.primary }]}><AppText variant="caption" style={{ color: state === 'pending' ? colors.textSecondary : '#FFFFFF' }}>{number}</AppText></View><AppText variant="caption" style={{ color: state === 'pending' ? colors.textSecondary : colors.text }}>{label}</AppText></View>)}</View></Card>
      {error ? <Card style={{ backgroundColor: colors.dangerSoft }}><AppText variant="label" style={{ color: colors.danger }}>Verification paused</AppText><AppText style={{ color: colors.textSecondary }}>{error}</AppText></Card> : null}
      {stage === 'location-permission' ? <PermissionPrimer kind="location" onGranted={() => void scanLocation()} /> : null}
      {stage === 'location-scan' ? <Card><AppText variant="heading">Acquiring precise GPS…</AppText><AppText style={{ color: colors.textSecondary }}>Comparing three high-accuracy samples. Keep the phone still.</AppText></Card> : null}
      {stage === 'camera-permission' ? <><Card style={{ backgroundColor: colors.successSoft }}><StatusPill label="Location ready" tone="success" /><AppText variant="label">Best GPS accuracy: {accuracy ?? '—'} m</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>The secure server will make the final 150-metre geofence decision.</AppText></Card><PermissionPrimer kind="camera" onGranted={() => setStage('face')} /></> : null}
      {stage === 'face' ? <Card><StatusPill label="Camera ready" tone="success" /><AppText variant="heading">Live-face scanner</AppText><AppText style={{ color: colors.textSecondary }}>Native liveness guidance and best-frame capture will connect here. Final identity matching remains server-side.</AppText><Button onPress={() => setStage('done')}>Preview successful verification</Button></Card> : null}
      {stage === 'done' ? <Card style={{ backgroundColor: colors.successSoft }}><AppText variant="title" style={{ color: colors.success }}>Attendance verified</AppText><AppText>EEE 509 · Today, 12:14</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>This preview does not write a live attendance record.</AppText><Button onPress={() => router.replace('/(student)/(tabs)')}>Return home</Button></Card> : null}
      {stage !== 'done' ? <Button variant="ghost" onPress={() => router.back()}>Cancel check-in</Button> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ steps: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm }, step: { flex: 1, alignItems: 'center', gap: Spacing.xs }, number: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' } });
