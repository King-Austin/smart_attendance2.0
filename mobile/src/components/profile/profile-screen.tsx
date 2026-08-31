import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { BrandHeader } from '@/components/ui/brand-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { StatusPill } from '@/components/ui/status-pill';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAuth } from '@/providers/auth-provider';
import { NotificationCard } from '@/components/notifications/notification-card';

export function ProfileScreen() {
  const { colors } = useAppTheme();
  const { profile, signOut } = useAuth();
  if (!profile) return null;
  const initials = profile.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  return (
    <Screen>
      <BrandHeader eyebrow={`${profile.role} account`} title="Profile" subtitle="Your identity and institutional access." />
      <Card style={styles.identity}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}><AppText variant="title" style={{ color: '#FFFFFF' }}>{initials}</AppText></View>
        <View style={styles.identityCopy}><AppText variant="heading">{profile.name}</AppText><AppText variant="caption" style={{ color: colors.textSecondary }}>{profile.email}</AppText><StatusPill label={profile.role === 'lecturer' ? (profile.approvalStatus === 'approved' ? 'Approved lecturer' : 'Approval pending') : profile.role === 'student' ? (profile.faceEnrolled ? 'Face enrolled' : 'Face required') : 'Faculty admin'} tone={profile.role === 'lecturer' && profile.approvalStatus !== 'approved' ? 'warning' : 'success'} /></View>
      </Card>
      <Card>
        <ListRow title="Faculty" meta={profile.faculty || 'Not set'} />
        <ListRow title="Department" subtitle={profile.department || 'Not set'} />
        {profile.regNumber ? <ListRow title="Registration number" meta={profile.regNumber} /> : null}
        {profile.staffId ? <ListRow title="Staff ID" meta={profile.staffId} /> : null}
        {profile.level ? <ListRow title="Academic level" meta={profile.level} /> : null}
        {profile.semester ? <ListRow title="Semester" meta={profile.semester} /> : null}
      </Card>
      {profile.role === 'student' ? <Card><ListRow title="Replace enrolled face" subtitle="Runs atomic duplicate-face verification before saving" onPress={() => router.push('/(student)/enroll-face')} /></Card> : null}
      <NotificationCard />
      <Button variant="secondary" onPress={() => void signOut().then(() => router.replace('/'))}>Sign out</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({ identity: { flexDirection: 'row', alignItems: 'center' }, avatar: { width: 66, height: 66, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' }, identityCopy: { flex: 1, gap: Spacing.xs } });
