import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { AppText } from './app-text';

export function StatusPill({ label, tone = 'info' }: { label: string; tone?: 'info' | 'success' | 'warning' | 'danger' }) {
  const { colors } = useAppTheme();
  const color = tone === 'success' ? colors.success : tone === 'warning' ? colors.warning : tone === 'danger' ? colors.danger : colors.primary;
  const background = tone === 'success' ? colors.successSoft : tone === 'warning' ? colors.warningSoft : tone === 'danger' ? colors.dangerSoft : colors.primarySoft;
  return <View style={[styles.pill, { backgroundColor: background }]}><AppText variant="caption" style={{ color }}>{label}</AppText></View>;
}

const styles = StyleSheet.create({ pill: { alignSelf: 'flex-start', borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs } });
