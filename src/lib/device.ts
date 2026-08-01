/**
 * Device Fingerprinting Utility
 * 
 * Uses FingerprintJS to generate a hardware-based device identifier
 * that survives cache clearing, incognito mode, and browser data wipes.
 * 
 * The fingerprint is derived from: canvas rendering, WebGL, audio context,
 * screen resolution, installed fonts, timezone, platform, etc.
 */
/**
 * Copyright © 2026 Ambuj Singh & Aniket Verma. All Rights Reserved.
 * This code is proprietary and confidential. Unauthorized copying, 
 * distribution, or use is strictly prohibited.
 */

import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { Device } from '@capacitor/device';
import { Capacitor } from '@capacitor/core';

let cachedFingerprint: string | null = null;

/**
 * Returns a stable device fingerprint.
 * For native Android/iOS, it returns the true Hardware Device ID.
 * For Web, it falls back to FingerprintJS.
 */
export async function getDeviceFingerprint(): Promise<string> {
  if (cachedFingerprint) return cachedFingerprint;

  try {
    // If running natively as an Android/iOS app, get the real hardware ID
    if (Capacitor.isNativePlatform()) {
      const deviceId = await Device.getId();
      cachedFingerprint = deviceId.identifier;
      return cachedFingerprint;
    }

    // Otherwise (web/PWA), fallback to FingerprintJS
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    cachedFingerprint = result.visitorId;

    // Also store in localStorage as a fallback identifier
    localStorage.setItem('device_id', cachedFingerprint);
    
    return cachedFingerprint;
  } catch (err) {
    console.error('Device ID generation failed, falling back to localStorage:', err);
    
    // Fallback: use localStorage UUID if fingerprinting fails
    let fallback = localStorage.getItem('device_id');
    if (!fallback) {
      fallback = crypto.randomUUID();
      localStorage.setItem('device_id', fallback);
    }
    cachedFingerprint = fallback;
    return fallback;
  }
}
