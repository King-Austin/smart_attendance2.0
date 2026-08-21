import { Pressable, StyleSheet, View } from 'react-native';

import { Brand, Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { AppText } from './app-text';

export function BrandHeader({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.wrap, { borderBottomColor: colors.border, backgroundColor: `${colors.surface}F2` }]}>
      <View style={styles.brandRow}>
        <View style={[styles.mark, { backgroundColor: colors.primary }]}>
          <AppText variant="heading" style={styles.markText}>⌖</AppText>
        </View>
        <View style={styles.brandCopy}>
          <AppText variant="label">{title}</AppText>
          <AppText variant="caption" numberOfLines={1} style={{ color: colors.textSecondary }}>{Brand.name}</AppText>
        </View>
        <Pressable style={[styles.rolePill, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
          <AppText variant="caption" style={{ color: colors.textSecondary }}>{eyebrow ?? Brand.shortName}</AppText>
        </Pressable>
      </View>
      {subtitle ? <AppText variant="caption" numberOfLines={2} style={{ color: colors.textSecondary }}>{subtitle}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: -Spacing.lg, marginTop: -Spacing.lg, marginBottom: Spacing.sm, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, gap: Spacing.xs },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  brandCopy: { flex: 1 },
  mark: { width: 36, height: 36, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  markText: { color: '#FFFFFF', fontWeight: '800', lineHeight: 24 },
  rolePill: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
});
