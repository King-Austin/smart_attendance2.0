import { useState } from 'react';

import { useAppTheme } from '@/hooks/use-app-theme';
import { registerPushNotifications } from '@/services/push-registration';
import { AppText } from '../ui/app-text';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { StatusPill } from '../ui/status-pill';

export function NotificationCard() {
  const { colors } = useAppTheme(); const [busy, setBusy] = useState(false); const [enabled, setEnabled] = useState(false); const [error, setError] = useState<string | null>(null);
  const enable = async () => { setBusy(true); setError(null); try { await registerPushNotifications(); setEnabled(true); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Notifications could not be enabled.'); } finally { setBusy(false); } };
  if (enabled) return <Card style={{ backgroundColor: colors.successSoft }}><StatusPill label="Notifications enabled" tone="success" /><AppText variant="caption">Session, attendance, and lecturer-approval alerts are registered for this device.</AppText></Card>;
  return <Card><AppText variant="heading">Attendance alerts</AppText><AppText style={{ color: colors.textSecondary }}>Enable notifications to know when a session opens and whether verification succeeds or fails.</AppText>{error ? <AppText style={{ color: colors.danger }}>{error}</AppText> : null}<Button loading={busy} onPress={() => void enable()}>Enable notifications</Button></Card>;
}
