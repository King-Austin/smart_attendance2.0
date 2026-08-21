import { AppText } from '@/components/ui/app-text';
import { BrandHeader } from '@/components/ui/brand-header';
import { Card } from '@/components/ui/card';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { StatusPill } from '@/components/ui/status-pill';
import { useAppTheme } from '@/hooks/use-app-theme';

export default function LecturerCourses() {
  const { colors } = useAppTheme();
  return <Screen><BrandHeader eyebrow="Engineering faculty" title="My courses" subtitle="Approved lecturers can select department courses immediately. Multiple lecturers have equal course access." /><Card><ListRow title="EEE 509 · Database Management Systems" subtitle="51 students · First semester" onPress={() => {}} /><ListRow title="EEE 510 · Software Engineering" subtitle="52 students · First semester" onPress={() => {}} /></Card><Card style={{ backgroundColor: colors.primarySoft }}><StatusPill label="Selection open" /><AppText variant="label">Add another department course</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>Only courses in your approved department are visible.</AppText></Card></Screen>;
}
