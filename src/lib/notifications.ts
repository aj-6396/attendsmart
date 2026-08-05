/**
 * Copyright © 2026 Ambuj Singh. All Rights Reserved.
 * ClassMark Notification System (Android Local Notifications & In-App Toast Banners)
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Geolocation } from '@capacitor/geolocation';

export interface AppToast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
}

type ToastListener = (toast: AppToast) => void;
const toastListeners: Set<ToastListener> = new Set();

export function subscribeToToasts(listener: ToastListener) {
  toastListeners.add(listener);
  return () => {
    toastListeners.delete(listener);
  };
}

export function emitToast(toast: Omit<AppToast, 'id' | 'timestamp'>) {
  const fullToast: AppToast = {
    ...toast,
    id: Math.random().toString(36).substring(2, 9),
    timestamp: new Date(),
  };
  toastListeners.forEach(fn => fn(fullToast));
}

/**
 * Requests permission for both Android Local Notifications AND Device Location on launch.
 */
export async function requestAllAppPermissions() {
  if (Capacitor.isNativePlatform()) {
    try {
      // 1. Request Notification Permission
      const notifStatus = await LocalNotifications.checkPermissions();
      if (notifStatus.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }

      // 2. Request Device Location Permission
      const geoStatus = await Geolocation.checkPermissions();
      if (geoStatus.location !== 'granted') {
        await Geolocation.requestPermissions();
      }
    } catch (e) {
      console.warn('Failed to request app permissions:', e);
    }
  } else {
    // Web fallback prompt
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(() => {}, () => {}, { timeout: 5000 });
    }
  }
}

/**
 * Triggers a notification (both Native Android notification and In-App Toast)
 */
export async function triggerNotification(title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
  // 1. In-App Toast
  emitToast({ type, title, message });

  // 2. Native Android Local Notification
  if (Capacitor.isNativePlatform()) {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body: message,
            id: Math.floor(Math.random() * 1000000),
            schedule: { at: new Date(Date.now() + 100) },
            sound: undefined,
            attachments: undefined,
            actionTypeId: '',
            extra: null,
          },
        ],
      });
    } catch (e) {
      console.warn('Native notification error:', e);
    }
  }
}

/**
 * Helper: Notify that an attendance session has started
 */
export function notifySessionStarted(className: string) {
  triggerNotification(
    '🟢 Attendance Session Started',
    `Attendance session has started for ${className}. Open app to mark present!`,
    'info'
  );
}

/**
 * Helper: Notify that attendance was marked successfully
 */
export function notifyAttendanceMarked(className: string) {
  triggerNotification(
    '✅ Attendance Marked Successfully',
    `Your attendance for ${className} has been recorded successfully.`,
    'success'
  );
}

/**
 * Helper: Notify that the student is absent in today's class (scheduled/checked at 5 PM)
 */
export function notifyAbsentInClass(className: string) {
  triggerNotification(
    '⚠️ Absence Recorded Today',
    `You are absent today in ${className}.`,
    'warning'
  );
}

/**
 * Schedules a local notification at 5:00 PM today with the daily attendance status.
 */
export async function schedule5PMAttendanceNotification(className: string, status: 'present' | 'absent') {
  if (!Capacitor.isNativePlatform()) return;

  const now = new Date();
  const target = new Date();
  target.setHours(17, 0, 0, 0); // 5:00 PM today

  // If it's already past 5 PM, don't schedule for today
  if (now.getTime() > target.getTime()) return;

  const title = status === 'present' ? '✅ Daily Attendance Summary' : '⚠️ Absence Alert';
  const body = status === 'present' 
    ? `Your attendance for ${className} was successfully recorded today.` 
    : `You missed the attendance session for ${className} today.`;

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          title,
          body,
          id: Math.floor(Math.random() * 1000000), // Random ID
          schedule: { at: target },
          sound: undefined,
          attachments: undefined,
          actionTypeId: '',
          extra: null,
        }
      ]
    });
  } catch (e) {
    console.warn('Failed to schedule 5 PM notification', e);
  }
}
