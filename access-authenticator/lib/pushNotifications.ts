import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    if (__DEV__) console.warn('[Push] Not a physical device; push token skipped');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
    if (finalStatus !== 'granted') {
      if (__DEV__) console.warn('[Push] Notification permission denied');
      return null;
    }
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    if (__DEV__) console.warn('[Push] No EAS projectId; push token unavailable');
    return null;
  }

  const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
  return tokenResult?.data ?? null;
}
