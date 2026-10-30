import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { BrandHeader } from '@/components/ui/brand-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { StatusPill } from '@/components/ui/status-pill';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { mobileApi } from '@/services/mobile-api';

export default function AdminApprovals() {
  const { colors } = useAppTheme(); const queryClient = useQueryClient();
  const lecturers = useQuery({ queryKey: ['pending-lecturers'], queryFn: mobileApi.pendingLecturers });
  const review = useMutation({ mutationFn: ({ id, decision }: { id: string; decision: 'approved' | 'rejected' }) => mobileApi.reviewLecturer(id, decision), onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ['pending-lecturers'] }), queryClient.invalidateQueries({ queryKey: ['admin-overview'] })]); } });
  return <Screen><BrandHeader eyebrow="Account control" title="Lecturer approvals" subtitle="Confirm staff identity and department before granting course access." />{lecturers.isLoading ? <Card><AppText>Loading pending lecturers…</AppText></Card> : lecturers.data?.map((lecturer) => <Card key={lecturer.id}><View style={styles.between}><View style={styles.copy}><AppText variant="heading">{lecturer.name}</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>{lecturer.staffId ?? 'No staff ID'} · {lecturer.department}</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>{lecturer.email}</AppText></View><StatusPill label="Pending" tone="warning" /></View><View style={styles.actions}><View style={styles.action}><Button variant="secondary" loading={review.isPending} onPress={() => review.mutate({ id: lecturer.id, decision: 'rejected' })}>Reject</Button></View><View style={styles.action}><Button loading={review.isPending} onPress={() => review.mutate({ id: lecturer.id, decision: 'approved' })}>Approve</Button></View></View></Card>)}{!lecturers.data?.length && !lecturers.isLoading ? <Card style={{ backgroundColor: colors.successSoft }}><AppText variant="heading" style={{ color: colors.success }}>All caught up</AppText><AppText>No lecturer account is waiting for review.</AppText></Card> : null}{review.error ? <AppText style={{ color: colors.danger }}>{review.error.message}</AppText> : null}</Screen>;
}
const styles = StyleSheet.create({ between: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md }, copy: { flex: 1, gap: Spacing.xs }, actions: { flexDirection: 'row', gap: Spacing.sm }, action: { flex: 1 } });
