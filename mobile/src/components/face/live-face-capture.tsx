import { CameraView, type CameraCapturedPicture } from 'expo-camera';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { mobileApi } from '@/services/mobile-api';
import {
  analyseLivenessCapture,
  lightingLabel,
  ON_DEVICE_LIVENESS_METHOD,
  ON_DEVICE_LIVENESS_VERSION,
  type AnalysedLivenessFrame,
  validateLivenessFrame,
} from '@/services/on-device-liveness';
import type { FaceAnalysis } from '../../../modules/on-device-face-analysis/src/OnDeviceFaceAnalysis.types';
import { AppText } from '../ui/app-text';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { StatusPill } from '../ui/status-pill';

export interface LiveFacePayload {
  image: string;
  livenessEvidence: {
    challengeId: string;
    method: typeof ON_DEVICE_LIVENESS_METHOD;
    version: typeof ON_DEVICE_LIVENESS_VERSION;
    completedAt: string;
    frames: AnalysedLivenessFrame[];
  };
}

type LocalFrame = AnalysedLivenessFrame & { image: string };

export function LiveFaceCapture({ onComplete, purpose, busy }: { onComplete: (payload: LiveFacePayload) => void | Promise<void>; purpose: 'enrolment' | 'attendance'; busy?: boolean }) {
  const { colors } = useAppTheme();
  const camera = useRef<CameraView>(null);
  const challenge = useQuery({ queryKey: ['liveness-challenge', purpose], queryFn: () => mobileApi.issueLivenessChallenge(purpose), staleTime: 0, gcTime: 0 });
  const instructions = challenge.data?.instructions ?? [];
  const [index, setIndex] = useState(0);
  const [frames, setFrames] = useState<LocalFrame[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<FaceAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const restart = async () => {
    setFrames([]);
    setIndex(0);
    setLastAnalysis(null);
    setError(null);
    await challenge.refetch();
  };

  const capture = async () => {
    if (!camera.current || !cameraReady || !instructions[index]) return;
    setCapturing(true);
    setError(null);
    try {
      if (instructions[index] === 'Close both eyes') await new Promise((resolve) => setTimeout(resolve, 650));
      const picture: CameraCapturedPicture = await camera.current.takePictureAsync({ base64: true, quality: 0.4, skipProcessing: false, shutterSound: false });
      if (!picture.base64 || !picture.uri) throw new Error('Camera did not return a face image.');
      if (!challenge.data) throw new Error('The liveness challenge expired.');

      const local = await analyseLivenessCapture(picture.uri, picture.base64);
      setLastAnalysis(local.analysis);
      const validationError = validateLivenessFrame(instructions[index], local.analysis, frames);
      if (validationError) throw new Error(validationError);

      const next: LocalFrame[] = [...frames, {
        instruction: instructions[index],
        capturedAt: new Date().toISOString(),
        imageHash: local.imageHash,
        analysis: local.analysis,
        image: picture.base64,
      }];

      if (index === instructions.length - 1) {
        const evidenceFrames = next.map(({ image: _image, ...frame }) => frame);
        await onComplete({
          image: next[0].image,
          livenessEvidence: {
            challengeId: challenge.data.id,
            method: ON_DEVICE_LIVENESS_METHOD,
            version: ON_DEVICE_LIVENESS_VERSION,
            completedAt: new Date().toISOString(),
            frames: evidenceFrames,
          },
        });
      } else {
        setFrames(next);
        setIndex((value) => value + 1);
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Face capture failed.';
      if (index === instructions.length - 1) {
        setFrames([]);
        setIndex(0);
        setLastAnalysis(null);
        await challenge.refetch();
      }
      setError(message);
    } finally {
      setCapturing(false);
    }
  };

  if (challenge.isLoading) return <Card><AppText variant="heading">Preparing a private live-face check…</AppText><AppText style={{ color: colors.textSecondary }}>The movement sequence is randomized and expires shortly.</AppText></Card>;
  if (challenge.error || !instructions.length) return <Card><AppText style={{ color: colors.danger }}>{challenge.error?.message ?? 'Challenge unavailable.'}</AppText><Button onPress={() => void challenge.refetch()}>Try again</Button></Card>;

  const instruction = instructions[index];
  const lightReady = Boolean(lastAnalysis?.isWellLit);
  return (
    <View style={styles.container}>
      <Card style={{ backgroundColor: colors.primarySoft }}>
        <AppText variant="label" style={{ color: colors.primary }}>Prepare your environment</AppText>
        <AppText style={{ color: colors.textSecondary }}>Face a window or lamp. Avoid strong light behind you, remove dark glasses, wipe the lens, and keep every other person outside the frame.</AppText>
      </Card>

      <View style={[styles.cameraFrame, { borderColor: lightReady ? colors.success : colors.primary, backgroundColor: colors.navy }]}>
        <CameraView ref={camera} style={styles.camera} facing="front" mirror onCameraReady={() => setCameraReady(true)} />
        <View pointerEvents="none" style={styles.overlay}>
          <View style={[styles.faceGuide, { borderColor: lightReady ? colors.success : '#FFFFFF' }]} />
          <View style={[styles.cameraStatus, { backgroundColor: lightReady ? colors.success : 'rgba(15,20,51,0.82)' }]}>
            <AppText variant="caption" style={styles.statusText}>{lightingLabel(lastAnalysis)}</AppText>
          </View>
        </View>
      </View>

      <Card>
        <View style={styles.between}>
          <StatusPill label={`Step ${index + 1} of ${instructions.length}`} />
          <AppText variant="caption" style={{ color: colors.textSecondary }}>Google ML Kit · on device</AppText>
        </View>
        <AppText variant="title">{instruction}</AppText>
        <AppText style={{ color: colors.textSecondary }}>{instruction === 'Close both eyes' ? 'Tap below, then hold both eyes closed until the capture completes.' : instruction === 'Look straight' ? 'Keep both eyes open and centre your full face inside the oval.' : 'Move naturally toward the named shoulder and keep your face inside the oval.'}</AppText>
        {error ? <View style={[styles.feedback, { backgroundColor: colors.dangerSoft }]}><AppText variant="label" style={{ color: colors.danger }}>Adjust and try again</AppText><AppText>{error}</AppText></View> : null}
        <Button disabled={!cameraReady} loading={capturing || busy} onPress={() => void capture()}>{index === instructions.length - 1 ? 'Complete live-face check' : index === 0 ? 'Check lighting and face' : 'Capture this movement'}</Button>
        {index > 0 ? <Button variant="ghost" disabled={capturing || busy} onPress={() => void restart()}>Restart live check</Button> : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.lg },
  cameraFrame: { height: 390, borderWidth: 3, borderRadius: Radius.lg, overflow: 'hidden' },
  camera: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  faceGuide: { width: 230, height: 300, borderWidth: 3, borderRadius: 120, backgroundColor: 'transparent' },
  cameraStatus: { position: 'absolute', left: Spacing.lg, right: Spacing.lg, bottom: Spacing.lg, minHeight: 34, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.md },
  statusText: { color: '#FFFFFF' },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  feedback: { padding: Spacing.md, borderRadius: Radius.md, gap: Spacing.xs },
});
