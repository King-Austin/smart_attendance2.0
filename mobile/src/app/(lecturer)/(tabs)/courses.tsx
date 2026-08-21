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

export default function LecturerCourses() {
  const { colors } = useAppTheme(); const { profile } = useAuth(); const queryClient = useQueryClient();
  const data = useQuery({ queryKey: ['lecturer-course-selection', profile?.departmentId, profile?.id], queryFn: () => mobileApi.lecturerCourses(profile!.departmentId!, profile!.id), enabled: Boolean(profile?.departmentId && profile.approvalStatus === 'approved') });
  const summaries = useQuery({ queryKey: ['course-attendance-summaries', data.data?.selected], queryFn: () => mobileApi.courseAttendanceSummaries(data.data?.selected ?? []), enabled: Boolean(data.data?.selected.length) });
  const toggle = useMutation({ mutationFn: ({ courseId, next }: { courseId: string; next: boolean }) => mobileApi.setLecturerCourse(profile!.id, courseId, next), onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ['lecturer-course-selection'] }), queryClient.invalidateQueries({ queryKey: ['lecturer-assigned-courses'] })]); } });
  return <Screen><BrandHeader eyebrow={profile?.department ?? 'Department'} title="Select courses" subtitle="Approved department courses become active immediately. Multiple lecturers receive equal course access." />{profile?.approvalStatus !== 'approved' ? <Card style={{ backgroundColor: colors.warningSoft }}><AppText>Course selection unlocks after administrator approval.</AppText></Card> : <><Card>{data.isLoading ? <AppText>Loading department courses…</AppText> : data.data?.courses.map((course) => { const selected = data.data.selected.includes(course.id); return <Pressable key={course.id} disabled={toggle.isPending} onPress={() => toggle.mutate({ courseId: course.id, next: !selected })} style={[styles.row, { borderBottomColor: colors.border }]}><View style={styles.copy}><AppText variant="label">{course.code} · {course.title}</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>{course.level} · {course.semester}</AppText></View><StatusPill label={selected ? 'Managing' : 'Select'} tone={selected ? 'success' : 'info'} /></Pressable>; })}</Card><Card><AppText variant="heading">Course attendance summaries</AppText>{data.data?.courses.filter((course) => data.data.selected.includes(course.id)).map((course) => { const summary = summaries.data?.[course.id]; return <View key={course.id} style={[styles.row, { borderBottomColor: colors.border }]}><View style={styles.copy}><AppText variant="label">{course.code} · {course.title}</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>{summary?.verified ?? 0} verified of {summary?.expected ?? 0} expected across {summary?.sessions ?? 0} sessions</AppText></View><StatusPill label={`${summary?.rate ?? 0}%`} tone={(summary?.rate ?? 0) >= 75 ? 'success' : 'warning'} /></View>; })}</Card></>}{toggle.error ? <AppText style={{ color: colors.danger }}>{toggle.error.message}</AppText> : null}</Screen>;
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth }, copy: { flex: 1, gap: Spacing.xs } });
