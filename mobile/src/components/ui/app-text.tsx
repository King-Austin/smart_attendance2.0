import type { TextProps } from 'react-native';
import { StyleSheet, Text } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption';

export function AppText({ variant = 'body', style, ...props }: TextProps & { variant?: Variant }) {
  const { colors } = useAppTheme();
  return <Text {...props} style={[styles.base, styles[variant], { color: colors.text }, style]} />;
}

const styles = StyleSheet.create({
  base: { fontFamily: Fonts.regular },
  display: { fontFamily: Fonts.bold, fontSize: 32, lineHeight: 39, letterSpacing: -0.8 },
  title: { fontFamily: Fonts.bold, fontSize: 24, lineHeight: 31, letterSpacing: -0.4 },
  heading: { fontFamily: Fonts.medium, fontSize: 18, lineHeight: 24 },
  body: { fontSize: 15, lineHeight: 22 },
  label: { fontFamily: Fonts.medium, fontSize: 14, lineHeight: 19 },
  caption: { fontSize: 12, lineHeight: 17 },
});
