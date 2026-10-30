import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';
import { useAuth } from '@/providers/auth-provider';

export default function EntryScreen() {
  const { loading, profile } = useAuth();
  const { colors } = useAppTheme();
  if (loading) return <View style={[styles.loading, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  if (!profile) return <Redirect href="/(auth)/sign-in" />;
  if (profile.role === 'student' && !profile.faceEnrolled) return <Redirect href="/(student)/enroll-face" />;
  if (profile.role === 'student') return <Redirect href="/(student)/(tabs)" />;
  if (profile.role === 'lecturer') return <Redirect href="/(lecturer)/(tabs)" />;
  return <Redirect href="/(admin)/(tabs)" />;
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
