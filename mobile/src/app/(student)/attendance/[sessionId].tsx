import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { LiveFaceCapture, type LiveFacePayload } from '@/components/face/live-face-capture';
import { PermissionPrimer } from '@/components/permissions/permission-primer';
import { AppText } from '@/components/ui/app-text';
import { BrandHeader } from '@/components/ui/brand-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { StatusPill } from '@/components/ui/status-pill';
import { useAppTheme } from '@/hooks/use-app-theme';
import { verifyAttendance } from '@/services/attendance-verification';
import { mobileApi } from '@/services/mobile-api';

type Reading = { latitude: number; longitude: number; accuracy: number; capturedAt: string };

export default function AttendanceCheckIn() {
  const { sessionId = '' } = useLocalSearchParams<{ sessionId: string }>();
  const { colors } = useAppTheme();
  const queryClient = useQueryClient();
  const session = useQuery({ queryKey: ['session', sessionId], queryFn: () => mobileApi.session(sessionId), enabled: Boolean(sessionId) });
  const [locationReady, setLocationReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [reading, setReading] = useState<Reading | null>(null);
  const [scanning, setScanning] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ distance: number; faceScore: number } | null>(null);

  const acquireLocation = async () => {
    setScanning(true); setError(null);
    try {
      let best: Location.LocationObject | null = null;
      for (let index = 0; index < 3; index += 1) {
        const sample = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
        if (!best || (sample.coords.accuracy ?? Infinity) < (best.coords.accuracy ?? Infinity)) best = sample;
      }
      const accuracy = best?.coords.accuracy ?? Infinity;
      if (!best || accuracy > 25) throw new Error(`GPS accuracy is ${Number.isFinite(accuracy) ? Math.round(accuracy) : 'unknown'} m. Move into an open area; 25 m or better is required.`);
      setReading({ latitude: best.coords.latitude, longitude: best.coords.longitude, accuracy, capturedAt: new Date(best.timestamp).toISOString() });
      setLocationReady(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Precise location could not be acquired.'); }
    finally { setScanning(false); }
  };

  const verify = async (capture: LiveFacePayload) => {
    if (!reading) return;
    setVerifying(true); setError(null);
    try {
      const fresh = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
      const freshAccuracy = fresh.coords.accuracy ?? Infinity;
      if (freshAccuracy > 25) throw new Error(`Your final GPS fix is only accurate to ${Math.round(freshAccuracy)} m. Move into an open area and retry.`);
      const freshReading = { latitude: fresh.coords.latitude, longitude: fresh.coords.longitude, accuracy: freshAccuracy, capturedAt: new Date(fresh.timestamp).toISOString() };
      const response = await verifyAttendance({ sessionId, image: capture.image, location: freshReading, livenessEvidence: capture.livenessEvidence });
      if (!response.ok) throw new Error(response.message);
      setResult({ distance: response.distance, faceScore: response.faceScore });
      await queryClient.invalidateQueries({ queryKey: ['student-history'] });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Attendance verification failed.'); throw cause; }
    finally { setVerifying(false); }
  };

  return <Screen><BrandHeader eyebrow="Secure attendance" title="Verify attendance" subtitle={session.data ? `${session.data.courseCode} · ${session.data.courseTitle}` : 'Loading session…'} />
    {session.data?.status !== 'active' && !session.isLoading ? <Card style={{ backgroundColor: colors.dangerSoft }}><AppText variant="heading" style={{ color: colors.danger }}>Session closed</AppText><AppText>This session no longer accepts attendance.</AppText><Button onPress={() => router.back()}>Return</Button></Card> : null}
    {error ? <Card style={{ backgroundColor: colors.dangerSoft }}><AppText variant="label" style={{ color: colors.danger }}>Verification stopped</AppText><AppText>{error}</AppText></Card> : null}
    {result ? <Card style={{ backgroundColor: colors.successSoft }}><StatusPill label="Server verified" tone="success" /><AppText variant="title" style={{ color: colors.success }}>Attendance recorded</AppText><AppText>Face match: {Math.round(result.faceScore * 100)}% · Distance: {result.distance} m</AppText><Button onPress={() => router.replace('/(student)/(tabs)')}>Return home</Button></Card> : <>
      {!locationReady ? <><PermissionPrimer kind="location" onGranted={() => void acquireLocation()} />{scanning ? <Card><AppText variant="heading">Acquiring precise GPS…</AppText><AppText>Comparing three high-accuracy fixes.</AppText></Card> : null}</> : <Card style={{ backgroundColor: colors.successSoft }}><StatusPill label="Precise location ready" tone="success" /><AppText>Accuracy: {Math.round(reading?.accuracy ?? 0)} m. The server makes the final 150 m decision.</AppText></Card>}
      {locationReady && !cameraReady ? <PermissionPrimer kind="camera" onGranted={() => setCameraReady(true)} /> : null}
      {locationReady && cameraReady ? <LiveFaceCapture purpose="attendance" busy={verifying} onComplete={verify} /> : null}
      <Button variant="ghost" onPress={() => router.back()}>Cancel check-in</Button>
    </>}
  </Screen>;
}
