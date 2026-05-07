import { Platform } from 'react-native';
import Constants from 'expo-constants';

// expo-notifications remote push token registration was removed from Expo Go in SDK 53.
// The package's internal .fx.js effect module fires at IMPORT time and crashes.
// Solution: never statically import expo-notifications — use dynamic require() only
// inside functions and only when NOT running in Expo Go.
const isExpoGo =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === 'storeClient';

export function setupNotificationHandler() {
  if (isExpoGo) return;
  try {
    const Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // silently ignore if unavailable
  }
}

export async function getExpoPushTokenSafe() {
  // Push tokens are not supported in Expo Go with SDK 53+
  if (isExpoGo) return null;

  try {
    const Notifications = require('expo-notifications');

    const permission = await Notifications.getPermissionsAsync();
    let status = permission.status;
    if (status !== 'granted') {
      const request = await Notifications.requestPermissionsAsync();
      status = request.status;
    }
    if (status !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
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
