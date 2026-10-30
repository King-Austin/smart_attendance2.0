import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/providers/auth-provider';

export default function LecturerLayout() {
  const { profile } = useAuth();
  if (!profile) return <Redirect href="/(auth)/sign-in" />;
  if (profile.role !== 'lecturer') return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
