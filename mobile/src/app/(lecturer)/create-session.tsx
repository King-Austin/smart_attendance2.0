import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';

import { PermissionPrimer } from '@/components/permissions/permission-primer';
import { AppText } from '@/components/ui/app-text';
import { BrandHeader } from '@/components/ui/brand-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { StatusPill } from '@/components/ui/status-pill';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAuth } from '@/providers/auth-provider';
import { mobileApi } from '@/services/mobile-api';

export default function CreateSession() {
  const { colors } = useAppTheme(); const { profile } = useAuth(); const queryClient = useQueryClient();
  const courses = useQuery({ queryKey: ['lecturer-assigned-courses', profile?.id], queryFn: () => mobileApi.assignedLecturerCourses(profile!.id), enabled: Boolean(profile) });
  const [courseId, setCourseId] = useState(''); const [topic, setTopic] = useState(''); const [permission, setPermission] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const open = async () => { setBusy(true); setError(null); try { let best: Location.LocationObject | null = null; for (let index = 0; index < 3; index += 1) { const item = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation }); if (!best || (item.coords.accuracy ?? Infinity) < (best.coords.accuracy ?? Infinity)) best = item; } const accuracy = best?.coords.accuracy ?? Infinity; if (!best || accuracy > 25) throw new Error(`Anchor accuracy must be 25 m or better. Current best: ${Math.round(accuracy)} m.`); await mobileApi.createSession({ courseId, topic, latitude: best.coords.latitude, longitude: best.coords.longitude, accuracy }); await queryClient.invalidateQueries({ queryKey: ['lecturer-sessions'] }); router.replace('/(lecturer)/(tabs)/sessions'); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Session could not be opened.'); } finally { setBusy(false); } };
  return <Screen><BrandHeader eyebrow="New attendance session" title="Open a session" subtitle="The server validates course access, anchor quality, and the fixed radius." /><Card><AppText variant="label">Course</AppText>{courses.data?.map((course) => <Pressable key={course.id} onPress={() => setCourseId(course.id)} style={[styles.option, { borderColor: courseId === course.id ? colors.primary : colors.border }]}><AppText variant="label">{course.code} · {course.title}</AppText></Pressable>)}<AppText variant="label">Lecture topic</AppText><TextInput value={topic} onChangeText={setTopic} placeholder="Topic" placeholderTextColor={colors.textFaint} style={[styles.input, { color: colors.text, borderColor: colors.border }]} /><StatusPill label={`${Brand.attendanceRadiusMeters} metres · fixed policy`} /></Card>{!permission ? <PermissionPrimer kind="location" onGranted={() => setPermission(true)} /> : <Card style={{ backgroundColor: colors.successSoft }}><AppText>Precise-location permission ready. Three fresh fixes will be sampled when you open the session.</AppText></Card>}{error ? <AppText style={{ color: colors.danger }}>{error}</AppText> : null}<Button disabled={!permission || !courseId || topic.trim().length < 3} loading={busy} onPress={() => void open()}>Open attendance now</Button><Button variant="ghost" onPress={() => router.back()}>Cancel</Button></Screen>;
}

const styles = StyleSheet.create({ option: { minHeight: 52, borderWidth: 2, borderRadius: Radius.md, justifyContent: 'center', paddingHorizontal: Spacing.md }, input: { minHeight: 52, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, fontSize: 15 } });
