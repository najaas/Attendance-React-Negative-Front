import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

export const ANDROID_SCHEDULE_CHANNEL_ID = 'schedule-alerts-v1';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function getExpoPushTokenSafe() {
  try {
    const permission = await Notifications.getPermissionsAsync();
    let status = permission.status;
    if (status !== 'granted') {
      const request = await Notifications.requestPermissionsAsync();
      status = request.status;
    }
    if (status !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_SCHEDULE_CHANNEL_ID, {
        name: 'Schedule Alerts',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        enableVibrate: true,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#fbbf24',
      });
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return tokenData?.data || null;
  } catch {
    return null;
  }
}

