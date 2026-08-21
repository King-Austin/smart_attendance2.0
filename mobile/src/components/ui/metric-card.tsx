import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { AppText } from './app-text';
import { Card } from './card';

export function MetricCard({ value, label, accent = 'blue' }: { value: string; label: string; accent?: 'blue' | 'orange' | 'gold' }) {
  const { colors } = useAppTheme();
  const color = accent === 'orange' ? colors.orange : accent === 'gold' ? colors.gold : colors.primary;
  return <Card style={styles.card}><View style={[styles.bar, { backgroundColor: color }]} /><AppText variant="title">{value}</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>{label}</AppText></Card>;
}

const styles = StyleSheet.create({ card: { flex: 1, minWidth: 140 }, bar: { width: 34, height: 4, borderRadius: 2, marginBottom: Spacing.xs } });
