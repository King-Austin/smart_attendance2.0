import { router } from 'expo-router';
import { useState } from 'react';

import { LiveFaceCapture, type LiveFacePayload } from '@/components/face/live-face-capture';
import { PermissionPrimer } from '@/components/permissions/permission-primer';
import { AppText } from '@/components/ui/app-text';
import { BrandHeader } from '@/components/ui/brand-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAuth } from '@/providers/auth-provider';
import { mobileApi } from '@/services/mobile-api';

export default function EnrollFaceScreen() {
  const { colors } = useAppTheme();
  const { profile, refreshProfile, signOut } = useAuth();
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  const enroll = async (payload: LiveFacePayload) => {
    setBusy(true); setError(null);
    try {
      await mobileApi.enrollFace(payload.image, payload.livenessEvidence);
      await refreshProfile();
      setComplete(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Face enrolment failed.');
      throw cause;
    } finally { setBusy(false); }
  };

  return <Screen><BrandHeader eyebrow="Biometric identity" title={profile?.faceEnrolled ? 'Replace enrolled face' : 'Enrol your face'} subtitle="Private on-device movement checks confirm liveness before your face is compared with every enrolled identity." />
    {complete ? <Card style={{ backgroundColor: colors.successSoft }}><AppText variant="title" style={{ color: colors.success }}>Face enrolled securely</AppText><AppText>No duplicate identity was found. You can now use precise GPS and live face to mark attendance.</AppText><Button onPress={() => router.replace('/(student)/(tabs)')}>Continue to dashboard</Button></Card> : <>
      <Card><AppText variant="label" style={{ color: colors.primary }}>Duplicate prevention is mandatory</AppText><AppText style={{ color: colors.textSecondary }}>The final embedding is compared server-side against all other accounts in one locked database transaction. A matching face cannot be reused.</AppText></Card>
      {!cameraReady ? <PermissionPrimer kind="camera" onGranted={() => setCameraReady(true)} /> : <LiveFaceCapture purpose="enrolment" busy={busy} onComplete={enroll} />}
      {error ? <Card style={{ backgroundColor: colors.dangerSoft }}><AppText variant="label" style={{ color: colors.danger }}>Enrolment rejected</AppText><AppText>{error}</AppText></Card> : null}
      <Button variant="ghost" onPress={() => void signOut()}>Sign out</Button>
    </>}
  </Screen>;
}
