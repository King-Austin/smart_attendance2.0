import { Tabs } from 'expo-router';

import { TabIcon } from '@/components/navigation/tab-icon';
import { useAppTheme } from '@/hooks/use-app-theme';

export default function StudentTabs() {
  const { colors } = useAppTheme();
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.text, tabBarInactiveTintColor: `${colors.background}B3`, tabBarStyle: { position: 'absolute', left: 16, right: 16, bottom: 22, height: 64, borderRadius: 999, borderTopWidth: 0, backgroundColor: `${colors.text}F2`, paddingTop: 8, paddingBottom: 8, paddingHorizontal: 10, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.18, shadowRadius: 28, elevation: 12 }, tabBarItemStyle: { borderRadius: 999 }, tabBarActiveBackgroundColor: colors.background, tabBarLabelStyle: { fontSize: 10, fontWeight: '600' } }}>
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: ({ color }) => <TabIcon symbol="⌂" color={color} /> }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: ({ color }) => <TabIcon symbol="◷" color={color} /> }} />
      <Tabs.Screen name="courses" options={{ title: 'Courses', tabBarIcon: ({ color }) => <TabIcon symbol="▤" color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <TabIcon symbol="●" color={color} /> }} />
    </Tabs>
  );
}
