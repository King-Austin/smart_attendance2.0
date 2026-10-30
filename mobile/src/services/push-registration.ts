import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

export async function registerPushNotifications() {
  if (!supabase) throw new Error('Supabase is not configured.');
  if (!Device.isDevice) throw new Error('Push notifications require a physical device.');
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('attendance', { name: 'Attendance', importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 250, 150, 250], lightColor: '#33456F' });
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!projectId) throw new Error('EAS project ID is not configured.');
  const permission = await Notifications.getPermissionsAsync();
  const final = permission.status === 'granted' ? permission : await Notifications.requestPermissionsAsync();
  if (final.status !== 'granted') throw new Error('Notification permission was not granted.');
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const { error } = await supabase.rpc('register_device_push_token', { target_token: token, target_platform: Platform.OS, target_device_name: Device.deviceName ?? null });
  if (error) throw error;
  return token;
}
