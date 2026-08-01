/**
 * Copyright © 2026 Ambuj Singh & Aniket Verma. All Rights Reserved.
 * ClassMark Offline Attendance Queue System
 */

import { Preferences } from '@capacitor/preferences';
import { triggerNotification } from './notifications';

export interface QueuedAttendancePayload {
  classId: string;
  otp: string;
  lat: number;
  lng: number;
  accuracy: number;
  deviceId: string;
  localFallback?: string | null;
  gpsSamples?: any[];
}

export interface QueuedAttendanceItem {
  id: string;
  className: string;
  payload: QueuedAttendancePayload;
  timestamp: string;
}

const STORAGE_KEY = 'classmark_offline_attendance_queue_v1';

/**
 * Gets all currently queued offline attendance items.
 */
export async function getOfflineQueue(): Promise<QueuedAttendanceItem[]> {
  try {
    const { value } = await Preferences.get({ key: STORAGE_KEY });
    if (!value) return [];
    return JSON.parse(value);
  } catch (e) {
    try {
      const fallback = localStorage.getItem(STORAGE_KEY);
      return fallback ? JSON.parse(fallback) : [];
    } catch {
      return [];
    }
  }
}

/**
 * Saves the offline attendance queue list to storage.
 */
async function saveOfflineQueue(items: QueuedAttendanceItem[]): Promise<void> {
  const jsonStr = JSON.stringify(items);
  try {
    await Preferences.set({ key: STORAGE_KEY, value: jsonStr });
  } catch (e) {
    // Ignore
  }
  try {
    localStorage.setItem(STORAGE_KEY, jsonStr);
  } catch (e) {
    // Ignore
  }
}

/**
 * Adds an attendance payload to the offline queue when internet is unavailable.
 */
export async function queueOfflineAttendance(className: string, payload: QueuedAttendancePayload): Promise<QueuedAttendanceItem> {
  const queue = await getOfflineQueue();
  const newItem: QueuedAttendanceItem = {
    id: Math.random().toString(36).substring(2, 9),
    className,
    payload,
    timestamp: new Date().toISOString(),
  };

  // Prevent duplicate queues for the exact same class and OTP
  const filtered = queue.filter(item => !(item.payload.classId === payload.classId && item.payload.otp === payload.otp));
  filtered.push(newItem);

  await saveOfflineQueue(filtered);

  triggerNotification(
    '📶 Saved Offline',
    `Attendance for ${className} queued locally. It will auto-sync when internet returns!`,
    'warning'
  );

  return newItem;
}

/**
 * Synchronizes queued offline attendance items to the server when connection is restored.
 */
export async function syncOfflineQueue(authFetch: (url: string, init?: RequestInit) => Promise<Response>): Promise<{ synced: number; failed: number }> {
  const queue = await getOfflineQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  const remaining: QueuedAttendanceItem[] = [];
  let synced = 0;

  for (const item of queue) {
    try {
      const res = await authFetch('/api/attendance/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload),
      });

      if (res.ok) {
        synced++;
        triggerNotification(
          '✅ Synced Offline Attendance',
          `Your offline attendance for ${item.className} was successfully recorded on the server!`,
          'success'
        );
      } else {
        // If server explicitly rejects (e.g. invalid OTP or expired session), remove or retry
        const data = await res.json().catch(() => ({}));
        console.warn('Sync failed for item:', item.id, data);
        if (data.error && (data.error.includes('expired') || data.error.includes('Invalid OTP'))) {
          triggerNotification(
            '⚠️ Offline Sync Failed',
            `Could not sync attendance for ${item.className}: ${data.error}`,
            'error'
          );
        } else {
          remaining.push(item);
        }
      }
    } catch (err) {
      console.warn('Network error while syncing item:', item.id, err);
      remaining.push(item);
    }
  }

  await saveOfflineQueue(remaining);
  return { synced, failed: remaining.length };
}

/**
 * Returns the current pending offline queue count.
 */
export async function getOfflineQueueCount(): Promise<number> {
  const queue = await getOfflineQueue();
  return queue.length;
}
