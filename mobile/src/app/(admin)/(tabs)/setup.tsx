import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { BrandHeader } from '@/components/ui/brand-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

export default function AcademicSetup() {
  const { colors } = useAppTheme();
  const [department, setDepartment] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  return <Screen><BrandHeader eyebrow="Academic structure" title="Departments and courses" subtitle="Seed each faculty department and its courses directly from mobile." /><Card><AppText variant="heading">Engineering</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>4 departments · 86 courses</AppText><ListRow title="Electrical and Electronic Engineering" meta="32 courses" onPress={() => {}} /><ListRow title="Mechanical Engineering" meta="21 courses" onPress={() => {}} /><ListRow title="Chemical Engineering" meta="18 courses" onPress={() => {}} /><ListRow title="Civil Engineering" meta="15 courses" onPress={() => {}} /></Card><Card><AppText variant="heading">Add department</AppText><TextInput value={department} onChangeText={setDepartment} placeholder="Department name" placeholderTextColor={colors.textFaint} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} /><Button disabled={!department.trim()}>Save department</Button></Card><Card><AppText variant="heading">Add course</AppText><View style={styles.row}><TextInput value={courseCode} onChangeText={setCourseCode} autoCapitalize="characters" placeholder="Course code" placeholderTextColor={colors.textFaint} style={[styles.input, styles.code, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} /><TextInput value={courseTitle} onChangeText={setCourseTitle} placeholder="Course title" placeholderTextColor={colors.textFaint} style={[styles.input, styles.title, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} /></View><AppText variant="caption" style={{ color: colors.textSecondary }}>Level, semester and credit-unit selectors will be stored with every course.</AppText><Button disabled={!courseCode.trim() || !courseTitle.trim()}>Save course</Button></Card></Screen>;
}

const styles = StyleSheet.create({ input: { minHeight: 52, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, fontSize: 15 }, row: { flexDirection: 'row', gap: Spacing.sm }, code: { flex: 0.38 }, title: { flex: 0.62 } });
