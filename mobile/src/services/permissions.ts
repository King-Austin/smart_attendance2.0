import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';

export type PermissionKind = 'camera' | 'location' | 'notifications';
export type PermissionState = 'undetermined' | 'granted' | 'denied' | 'blocked';

export interface PermissionResult {
  state: PermissionState;
  canAskAgain: boolean;
}

function normalize(status: string, canAskAgain: boolean): PermissionResult {
  if (status === 'granted') return { state: 'granted', canAskAgain };
  return { state: canAskAgain ? 'denied' : 'blocked', canAskAgain };
}

export const permissionsService = {
  async check(kind: PermissionKind): Promise<PermissionResult> {
    if (kind === 'camera') {
      const result = await Camera.getCameraPermissionsAsync();
      return result.status === 'undetermined' ? { state: 'undetermined', canAskAgain: true } : normalize(result.status, result.canAskAgain);
    }
    if (kind === 'location') {
      const result = await Location.getForegroundPermissionsAsync();
      return result.status === 'undetermined' ? { state: 'undetermined', canAskAgain: true } : normalize(result.status, result.canAskAgain);
    }
    const result = await Notifications.getPermissionsAsync();
    return result.status === 'undetermined' ? { state: 'undetermined', canAskAgain: true } : normalize(result.status, result.canAskAgain);
  },

  async request(kind: PermissionKind): Promise<PermissionResult> {
    if (kind === 'camera') {
      const result = await Camera.requestCameraPermissionsAsync();
      return normalize(result.status, result.canAskAgain);
    }
    if (kind === 'location') {
      const result = await Location.requestForegroundPermissionsAsync();
      return normalize(result.status, result.canAskAgain);
    }
    const result = await Notifications.requestPermissionsAsync();
    return normalize(result.status, result.canAskAgain);
  },

  openSettings() {
    return Linking.openSettings();
  },
};
