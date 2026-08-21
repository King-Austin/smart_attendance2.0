import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { BrandHeader } from '@/components/ui/brand-header';
import { Card } from '@/components/ui/card';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { StatusPill } from '@/components/ui/status-pill';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

const courses = [
  { code: 'EEE 501', title: 'Computer Aided Design', unit: 3 },
  { code: 'EEE 509', title: 'Database Management Systems', unit: 3 },
  { code: 'EEE 510', title: 'Software Engineering', unit: 3 },
];

export default function StudentCourses() {
  const { colors } = useAppTheme();
  return <Screen><BrandHeader eyebrow="500 Level · First semester" title="My courses" subtitle="Select only courses available to your department, level and semester." /><Card><View style={styles.summary}><AppText variant="heading">3 selected courses</AppText><StatusPill label="9 credit units" /></View>{courses.map((course) => <ListRow key={course.code} title={`${course.code} · ${course.title}`} meta={`${course.unit} units`} onPress={() => {}} />)}</Card><Card style={{ backgroundColor: colors.goldSoft }}><AppText variant="label" style={{ color: colors.gold }}>Course-selection policy</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>Changes affect future sessions only. Existing attendance records remain in the audit ledger.</AppText></Card></Screen>;
}

const styles = StyleSheet.create({ summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.md } });
