/**
 * Локальные уведомления — показываются сразу, без FCM.
 * Использует expo-notifications для локальных пушей.
 */
import * as Notifications from 'expo-notifications';

export async function showLocalNotification(title: string, body: string, data?: any) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        data: data || {},
      },
      trigger: null, // мгновенно
    });
    console.log('[Notif] Local notification shown:', title);
  } catch (e: any) {
    console.log('[Notif] Error:', e?.message || e);
  }
}
