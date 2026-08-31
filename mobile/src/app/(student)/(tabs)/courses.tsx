import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { BrandHeader } from '@/components/ui/brand-header';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { StatusPill } from '@/components/ui/status-pill';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAuth } from '@/providers/auth-provider';
import { mobileApi } from '@/services/mobile-api';

export default function StudentCourses() {
  const { colors } = useAppTheme();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const available = useQuery({ queryKey: ['eligible-courses', profile?.departmentId, profile?.level, profile?.semester], queryFn: () => mobileApi.eligibleStudentCourses(profile!), enabled: Boolean(profile?.departmentId) });
  const selected = useQuery({ queryKey: ['student-course-ids', profile?.id], queryFn: () => mobileApi.studentCourseIds(profile!.id), enabled: Boolean(profile) });
  const toggle = useMutation({ mutationFn: ({ courseId, next }: { courseId: string; next: boolean }) => mobileApi.setStudentCourse(profile!.id, courseId, next), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['student-course-ids'] }); } });
  const units = available.data?.filter((course) => selected.data?.includes(course.id)).reduce((sum, course) => sum + course.creditUnit, 0) ?? 0;
  return <Screen><BrandHeader eyebrow={`${profile?.level ?? ''} · ${profile?.semester ?? ''}`} title="Select courses" subtitle="Supabase permits only courses matching your department, level and semester." /><Card><View style={styles.summary}><AppText variant="heading">{selected.data?.length ?? 0} selected</AppText><StatusPill label={`${units} credit units`} /></View>{available.isLoading ? <AppText>Loading eligible courses…</AppText> : available.data?.map((course) => { const checked = selected.data?.includes(course.id) ?? false; return <Pressable key={course.id} disabled={toggle.isPending} onPress={() => toggle.mutate({ courseId: course.id, next: !checked })} style={[styles.row, { borderBottomColor: colors.border }]}><View style={styles.copy}><AppText variant="label">{course.code} · {course.title}</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>{course.creditUnit} units · {course.semester}</AppText></View><StatusPill label={checked ? 'Selected' : 'Add'} tone={checked ? 'success' : 'info'} /></Pressable>; })}{!available.data?.length && !available.isLoading ? <AppText>No courses have been seeded for this scope.</AppText> : null}</Card>{toggle.error ? <AppText style={{ color: colors.danger }}>{toggle.error.message}</AppText> : null}</Screen>;
}

const styles = StyleSheet.create({ summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.md }, row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth }, copy: { flex: 1, gap: Spacing.xs } });
