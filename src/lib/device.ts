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
 * Copyright © 2025 Ambuj Singh & Aniket Verma. All Rights Reserved.
 * This code is proprietary and confidential. Unauthorized copying, 
 * distribution, or use is strictly prohibited.
 */

import FingerprintJS from '@fingerprintjs/fingerprintjs';

let cachedFingerprint: string | null = null;

/**
 * Returns a stable device fingerprint.
 * The result is cached in memory for the session lifetime to avoid
 * recalculating on every attendance mark.
 */
export async function getDeviceFingerprint(): Promise<string> {
  if (cachedFingerprint) return cachedFingerprint;

  try {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    cachedFingerprint = result.visitorId;

    // Also store in localStorage as a fallback identifier
    // (but the fingerprint itself doesn't depend on localStorage)
    localStorage.setItem('device_id', cachedFingerprint);
    
    return cachedFingerprint;
  } catch (err) {
    console.error('Fingerprint generation failed, falling back to localStorage:', err);
    
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
