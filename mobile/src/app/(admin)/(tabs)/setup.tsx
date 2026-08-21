import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { BrandHeader } from '@/components/ui/brand-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAuth } from '@/providers/auth-provider';
import { mobileApi } from '@/services/mobile-api';

const levels = ['100 Level', '200 Level', '300 Level', '400 Level', '500 Level'];
const semesters = ['First Semester', 'Second Semester'];

export default function AcademicSetup() {
  const { colors } = useAppTheme(); const { profile } = useAuth(); const queryClient = useQueryClient();
  const faculties = useQuery({ queryKey: ['faculties'], queryFn: mobileApi.faculties }); const [facultyId, setFacultyId] = useState(''); const effectiveFacultyId = facultyId || profile?.facultyId || faculties.data?.[0]?.id || '';
  const departments = useQuery({ queryKey: ['departments', effectiveFacultyId], queryFn: () => mobileApi.departments(effectiveFacultyId), enabled: Boolean(effectiveFacultyId) });
  const [departmentName, setDepartmentName] = useState(''); const [departmentCode, setDepartmentCode] = useState(''); const [departmentId, setDepartmentId] = useState('');
  const [courseCode, setCourseCode] = useState(''); const [courseTitle, setCourseTitle] = useState(''); const [level, setLevel] = useState('100 Level'); const [semester, setSemester] = useState('First Semester'); const [units, setUnits] = useState('3');
  const selectedDepartment = useMemo(() => departments.data?.find((item) => item.id === departmentId), [departmentId, departments.data]);
  const addDepartment = useMutation({ mutationFn: () => mobileApi.createDepartment({ facultyId: effectiveFacultyId, name: departmentName, code: departmentCode, createdBy: profile!.id }), onSuccess: async () => { setDepartmentName(''); setDepartmentCode(''); await queryClient.invalidateQueries({ queryKey: ['departments', effectiveFacultyId] }); } });
  const addCourse = useMutation({ mutationFn: () => mobileApi.createCourse({ id: `${departmentId.slice(0, 8)}-${courseCode.toLowerCase().replace(/[^a-z0-9]/g, '')}`, code: courseCode, title: courseTitle, creditUnit: Number(units), facultyId: effectiveFacultyId, departmentId, departmentName: selectedDepartment!.name, level, semester }), onSuccess: async () => { setCourseCode(''); setCourseTitle(''); await queryClient.invalidateQueries({ queryKey: ['admin-overview'] }); } });
  const input = [styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }];
  return <Screen><BrandHeader eyebrow="Academic structure" title="Departments and courses" subtitle="Seed real faculty data through RLS-protected mobile forms." /><Card><AppText variant="label">Faculty</AppText>{faculties.data?.map((item) => <Pressable key={item.id} onPress={() => { setFacultyId(item.id); setDepartmentId(''); }} style={[styles.option, { borderColor: effectiveFacultyId === item.id ? colors.primary : colors.border }]}><AppText>{item.name}</AppText></Pressable>)}<AppText variant="label">Departments</AppText>{departments.data?.map((item) => <Pressable key={item.id} onPress={() => setDepartmentId(item.id)} style={[styles.option, { borderColor: departmentId === item.id ? colors.primary : colors.border }]}><AppText>{item.code} · {item.name}</AppText></Pressable>)}</Card>
    <Card><AppText variant="heading">Add department</AppText><TextInput value={departmentCode} onChangeText={setDepartmentCode} autoCapitalize="characters" placeholder="Code, e.g. ECE" placeholderTextColor={colors.textFaint} style={input} /><TextInput value={departmentName} onChangeText={setDepartmentName} placeholder="Department name" placeholderTextColor={colors.textFaint} style={input} />{addDepartment.error ? <AppText style={{ color: colors.danger }}>{addDepartment.error.message}</AppText> : null}<Button disabled={!effectiveFacultyId || departmentCode.trim().length < 2 || departmentName.trim().length < 3} loading={addDepartment.isPending} onPress={() => addDepartment.mutate()}>Save department</Button></Card>
    <Card><AppText variant="heading">Add course</AppText><TextInput value={courseCode} onChangeText={setCourseCode} autoCapitalize="characters" placeholder="Course code" placeholderTextColor={colors.textFaint} style={input} /><TextInput value={courseTitle} onChangeText={setCourseTitle} placeholder="Course title" placeholderTextColor={colors.textFaint} style={input} /><TextInput value={units} onChangeText={setUnits} keyboardType="number-pad" placeholder="Credit units" placeholderTextColor={colors.textFaint} style={input} /><AppText variant="label">Level</AppText><View style={styles.wrap}>{levels.map((item) => <Pressable key={item} onPress={() => setLevel(item)} style={[styles.pill, { backgroundColor: level === item ? colors.primary : colors.surfaceMuted }]}><AppText variant="caption" style={{ color: level === item ? '#fff' : colors.text }}>{item}</AppText></Pressable>)}</View><AppText variant="label">Semester</AppText><View style={styles.row}>{semesters.map((item) => <Pressable key={item} onPress={() => setSemester(item)} style={[styles.pill, { flex: 1, backgroundColor: semester === item ? colors.primary : colors.surfaceMuted }]}><AppText variant="caption" style={{ color: semester === item ? '#fff' : colors.text }}>{item}</AppText></Pressable>)}</View>{addCourse.error ? <AppText style={{ color: colors.danger }}>{addCourse.error.message}</AppText> : null}<Button disabled={!selectedDepartment || courseCode.trim().length < 3 || courseTitle.trim().length < 3 || !Number.isFinite(Number(units))} loading={addCourse.isPending} onPress={() => addCourse.mutate()}>Save course</Button></Card>
  </Screen>;
}

const styles = StyleSheet.create({ input: { minHeight: 52, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, fontSize: 15 }, option: { minHeight: 48, borderWidth: 2, borderRadius: Radius.md, justifyContent: 'center', paddingHorizontal: Spacing.md }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }, row: { flexDirection: 'row', gap: Spacing.sm }, pill: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.pill, alignItems: 'center' } });
