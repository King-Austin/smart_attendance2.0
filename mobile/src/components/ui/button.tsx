import * as Haptics from 'expo-haptics';
import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { AppText } from './app-text';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({ children, onPress, variant = 'primary', loading, disabled, testID }: PropsWithChildren<{ onPress?: () => void; variant?: Variant; loading?: boolean; disabled?: boolean; testID?: string }>) {
  const { colors } = useAppTheme();
  const background = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : variant === 'ghost' ? 'transparent' : colors.surface;
  const foreground = variant === 'primary' || variant === 'danger' ? '#FFFFFF' : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      testID={testID}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress?.();
      }}
      style={({ pressed }) => [styles.button, { backgroundColor: background, borderColor: variant === 'secondary' ? colors.border : 'transparent', opacity: disabled ? 0.45 : pressed ? 0.78 : 1 }]}
    >
      {loading ? <ActivityIndicator color={foreground} /> : <AppText variant="label" style={{ color: foreground, fontFamily: Fonts.medium }}>{children}</AppText>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 44, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.sm, paddingHorizontal: Spacing.lg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
});
