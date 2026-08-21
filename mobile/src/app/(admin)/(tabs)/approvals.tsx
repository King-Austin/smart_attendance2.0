import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { BrandHeader } from '@/components/ui/brand-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { StatusPill } from '@/components/ui/status-pill';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

const lecturers = [
  ['Dr. Chinyere Okafor', 'NAU/ENG/0184', 'Electronic and Computer Engineering'],
  ['Engr. Emeka Obi', 'NAU/ENG/0231', 'Mechanical Engineering'],
  ['Dr. Hauwa Yusuf', 'NAU/ENG/0207', 'Chemical Engineering'],
];

export default function AdminApprovals() {
  const { colors } = useAppTheme();
  return <Screen><BrandHeader eyebrow="Account control" title="Lecturer approvals" subtitle="Confirm staff identity and department before granting course access." />{lecturers.map(([name, staffId, department]) => <Card key={staffId}><View style={styles.between}><View style={styles.copy}><AppText variant="heading">{name}</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>{staffId} · {department}</AppText></View><StatusPill label="Pending" tone="warning" /></View><View style={styles.actions}><View style={styles.action}><Button variant="secondary">Reject</Button></View><View style={styles.action}><Button>Approve</Button></View></View></Card>)}</Screen>;
}

const styles = StyleSheet.create({ between: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md }, copy: { flex: 1, gap: Spacing.xs }, actions: { flexDirection: 'row', gap: Spacing.sm }, action: { flex: 1 } });
