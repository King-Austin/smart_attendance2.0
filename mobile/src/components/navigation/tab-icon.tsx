import { StyleSheet, Text, type ColorValue } from 'react-native';

export function TabIcon({ symbol, color }: { symbol: string; color: ColorValue }) {
  return <Text style={[styles.icon, { color }]}>{symbol}</Text>;
}

const styles = StyleSheet.create({ icon: { fontSize: 20, lineHeight: 24 } });
