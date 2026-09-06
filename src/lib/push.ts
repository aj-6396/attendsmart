import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

/**
 * Initializes Push Notifications for native Capacitor APK devices.
 */
export async function initPushNotifications(onNotificationReceived?: (notification: any) => void) {
  if (!Capacitor.isNativePlatform()) {
    console.log('[Push] Not a native platform. Push Notifications skipped.');
    return;
  }

  try {
    // 1. Request permission
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('[Push] User denied push notification permissions.');
      return;
    }

    // 2. Register with Apple / Google APNs/FCM
    await PushNotifications.register();

    // 3. Listen for token registration
    await PushNotifications.addListener('registration', (token) => {
      console.log('[Push] FCM Registration Token:', token.value);
      // Save FCM token in localStorage for local reference
      localStorage.setItem('fcm_device_token', token.value);
    });

    // Handle registration errors
    await PushNotifications.addListener('registrationError', (err) => {
      console.error('[Push] FCM Registration Error:', err.error);
    });

    // 4. Listen for push notifications received in foreground
    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] Notification Received:', notification);
      if (onNotificationReceived) {
        onNotificationReceived(notification);
      }
    });

    // 5. Listen for push notification action perform (click)
    await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('[Push] Notification Action Performed:', notification);
    });

  } catch (err) {
    console.error('[Push] Error initializing push notifications:', err);
  }
}
