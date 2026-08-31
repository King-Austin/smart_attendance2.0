import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { AppText } from './app-text';

export function ListRow({ title, subtitle, meta, onPress }: { title: string; subtitle?: string; meta?: string; onPress?: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
      <View style={styles.copy}><AppText variant="label">{title}</AppText>{subtitle ? <AppText variant="caption" style={{ color: colors.textSecondary }}>{subtitle}</AppText> : null}</View>
      {meta ? <AppText variant="caption" style={{ color: colors.textSecondary }}>{meta}</AppText> : null}
      {onPress ? <View style={[styles.chevron, { backgroundColor: colors.surfaceMuted }]}><AppText style={{ color: colors.primary }}>›</AppText></View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  copy: { flex: 1, gap: 3 },
  chevron: { width: 30, height: 30, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
});
