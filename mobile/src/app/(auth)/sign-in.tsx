import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { BrandHeader } from '@/components/ui/brand-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAuth } from '@/providers/auth-provider';

export default function SignInScreen() {
  const { colors } = useAppTheme();
  const { configured, profile, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) router.replace('/');
  }, [profile]);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      router.replace('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.page, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <BrandHeader eyebrow="Secure campus attendance" title="Welcome back" subtitle="Sign in with your Nnamdi Azikiwe University account." />
        <Card>
          <View style={styles.field}>
            <AppText variant="label">Email address</AppText>
            <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="name@unizik.edu.ng" placeholderTextColor={colors.textFaint} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} />
          </View>
          <View style={styles.field}>
            <AppText variant="label">Password</AppText>
            <TextInput secureTextEntry value={password} onChangeText={setPassword} placeholder="Enter your password" placeholderTextColor={colors.textFaint} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} />
          </View>
          {error ? <AppText variant="caption" style={{ color: colors.danger }}>{error}</AppText> : null}
          {!configured ? <AppText variant="caption" style={{ color: colors.warning }}>Live credentials are not available in this installation.</AppText> : null}
          <Button disabled={!configured || !email || !password} loading={loading} onPress={() => void submit()}>Sign in securely</Button>
        </Card>
        <Button variant="secondary" onPress={() => router.push('/(auth)/register')}>Create student or lecturer account</Button>
        <AppText variant="caption" style={[styles.footer, { color: colors.textSecondary }]}>Discipline · Self Reliance · Excellence</AppText>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', width: '100%', maxWidth: 520, alignSelf: 'center', padding: Spacing.xl, gap: Spacing.lg },
  field: { gap: Spacing.sm },
  input: { minHeight: 52, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, fontSize: 15 },
  footer: { textAlign: 'center', marginTop: Spacing.sm },
});
