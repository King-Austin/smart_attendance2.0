import { StyleSheet, View } from 'react-native';

import { Brand, Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { AppText } from './app-text';

export function BrandHeader({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.wrap}>
      <View style={styles.brandRow}>
        <View style={[styles.mark, { backgroundColor: colors.primary }]}><AppText variant="label" style={styles.markText}>NAU</AppText></View>
        <View style={styles.brandCopy}>
          <AppText variant="label">{Brand.name}</AppText>
          <AppText variant="caption" style={{ color: colors.textSecondary }}>Nnamdi Azikiwe University</AppText>
        </View>
      </View>
      {eyebrow ? <AppText variant="caption" style={{ color: colors.orange, textTransform: 'uppercase', letterSpacing: 1 }}>{eyebrow}</AppText> : null}
      <AppText variant="title">{title}</AppText>
      {subtitle ? <AppText style={{ color: colors.textSecondary }}>{subtitle}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  brandCopy: { flex: 1 },
  mark: { width: 44, height: 44, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  markText: { color: '#FFFFFF', fontWeight: '800' },
});
