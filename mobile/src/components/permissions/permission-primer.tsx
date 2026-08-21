import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { permissionsService, type PermissionKind, type PermissionState } from '@/services/permissions';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const copy: Record<PermissionKind, { title: string; body: string; action: string }> = {
  location: { title: 'Confirm your lecture location', body: 'UNIZIK Presence uses precise location only during check-in to confirm that you are within the fixed 150-metre lecture radius.', action: 'Allow precise location' },
  camera: { title: 'Allow camera for live-face verification', body: 'UNIZIK Presence analyses lighting, face position, eye state, and head movement locally with Google ML Kit. Captures are temporary, are never saved to your gallery, and the camera is used only while this verification screen is open.', action: 'Continue to camera permission' },
  notifications: { title: 'Know when attendance opens', body: 'Get notified when a lecturer opens a session, when check-in finishes, or when a lecturer account is approved.', action: 'Enable notifications' },
};

export function PermissionPrimer({ kind, onGranted }: { kind: PermissionKind; onGranted?: () => void }) {
  const { colors } = useAppTheme();
  const [state, setState] = useState<PermissionState>('undetermined');
  const [loading, setLoading] = useState(true);
  const onGrantedRef = useRef(onGranted);

  useEffect(() => {
    onGrantedRef.current = onGranted;
  }, [onGranted]);

  useEffect(() => {
    permissionsService.check(kind).then((result) => {
      setState(result.state);
      setLoading(false);
      if (result.state === 'granted') onGrantedRef.current?.();
    });
  }, [kind]);

  const request = async () => {
    setLoading(true);
    const result = await permissionsService.request(kind);
    setState(result.state);
    setLoading(false);
    if (result.state === 'granted') onGranted?.();
  };

  if (state === 'granted') {
    return <Card style={{ backgroundColor: colors.successSoft }}><AppText variant="label" style={{ color: colors.success }}>Permission ready</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>{copy[kind].title}</AppText></Card>;
  }

  return (
    <Card>
      <View style={styles.copy}>
        <AppText variant="heading">{copy[kind].title}</AppText>
        <AppText style={{ color: colors.textSecondary }}>{copy[kind].body}</AppText>
      </View>
      {state === 'blocked' ? (
        <Button onPress={() => void permissionsService.openSettings()}>Open app settings</Button>
      ) : (
        <Button loading={loading} onPress={() => void request()}>{copy[kind].action}</Button>
      )}
      {state === 'denied' ? <AppText variant="caption" style={{ color: colors.danger }}>Permission was declined. This verification cannot continue until access is granted.</AppText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({ copy: { gap: Spacing.sm } });
