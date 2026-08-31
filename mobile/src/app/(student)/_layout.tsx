import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/providers/auth-provider';

export default function StudentLayout() {
  const { profile } = useAuth();
  if (!profile) return <Redirect href="/(auth)/sign-in" />;
  if (profile.role !== 'student') return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
