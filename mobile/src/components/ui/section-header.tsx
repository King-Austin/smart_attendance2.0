import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { useAppTheme } from '@/hooks/use-app-theme';

export function SectionHeader({ title, action }: { title: string; action?: string }) {
  const { colors } = useAppTheme();
  return <View style={styles.row}><AppText variant="heading">{title}</AppText>{action ? <AppText variant="label" style={{ color: colors.primary }}>{action}</AppText> : null}</View>;
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' } });
