import { CameraView, type CameraCapturedPicture } from 'expo-camera';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { mobileApi } from '@/services/mobile-api';
import { AppText } from '../ui/app-text';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { StatusPill } from '../ui/status-pill';

export interface LiveFacePayload { image: string; livenessEvidence: { challengeId: string; capturedAt: string; frames: { instruction: string; image: string }[] } }

export function LiveFaceCapture({ onComplete, purpose, busy }: { onComplete: (payload: LiveFacePayload) => void | Promise<void>; purpose: 'enrolment' | 'attendance'; busy?: boolean }) {
  const { colors } = useAppTheme();
  const camera = useRef<CameraView>(null);
  const challenge = useQuery({ queryKey: ['liveness-challenge', purpose], queryFn: () => mobileApi.issueLivenessChallenge(purpose), staleTime: 0, gcTime: 0 });
  const instructions = challenge.data?.instructions ?? [];
  const [index, setIndex] = useState(0);
  const [frames, setFrames] = useState<{ instruction: string; image: string }[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const capture = async () => {
    if (!camera.current) return;
    setCapturing(true); setError(null);
    try {
      const picture: CameraCapturedPicture = await camera.current.takePictureAsync({ base64: true, quality: 0.35, skipProcessing: false, shutterSound: false });
      if (!picture.base64) throw new Error('Camera did not return a face image.');
      if (!challenge.data || !instructions[index]) throw new Error('The liveness challenge expired.');
      const next = [...frames, { instruction: instructions[index], image: picture.base64 }];
      if (index === instructions.length - 1) {
        await onComplete({ image: next[0].image, livenessEvidence: { challengeId: challenge.data.id, capturedAt: new Date().toISOString(), frames: next } });
      } else {
        setFrames(next); setIndex((value) => value + 1);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Face capture failed.');
      setFrames([]); setIndex(0);
      await challenge.refetch();
    } finally { setCapturing(false); }
  };

  if (challenge.isLoading) return <Card><AppText variant="heading">Issuing secure challenge…</AppText></Card>;
  if (challenge.error || !instructions.length) return <Card><AppText style={{ color: colors.danger }}>{challenge.error?.message ?? 'Challenge unavailable.'}</AppText><Button onPress={() => void challenge.refetch()}>Try again</Button></Card>;
  return <View style={styles.container}><View style={[styles.cameraFrame, { borderColor: colors.primary }]}><CameraView ref={camera} style={styles.camera} facing="front" mirror /></View><Card><View style={styles.between}><StatusPill label={`Step ${index + 1} of ${instructions.length}`} /><AppText variant="caption" style={{ color: colors.textSecondary }}>Server-issued challenge</AppText></View><AppText variant="title">{instructions[index]}</AppText><AppText style={{ color: colors.textSecondary }}>Keep only one face inside the frame. The server will validate every challenge frame and reject photos or reused captures.</AppText>{error ? <AppText style={{ color: colors.danger }}>{error}</AppText> : null}<Button loading={capturing || busy} onPress={() => void capture()}>{index === instructions.length - 1 ? 'Capture and verify' : 'Capture this step'}</Button></Card></View>;
}

const styles = StyleSheet.create({ container: { gap: Spacing.lg }, cameraFrame: { height: 390, borderWidth: 3, borderRadius: Radius.lg, overflow: 'hidden' }, camera: { flex: 1 }, between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm } });
