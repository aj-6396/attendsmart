/**
 * Calculates the distance between two points on the Earth's surface using the Haversine formula.
 * Returns distance in meters.
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function getCurrentPosition(options?: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
    } else {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 6000,   // Reduced from 10s — fail fast on weak GPS
        maximumAge: 0,
        ...options
      });
    }
  });
}

/**
 * Captures multiple GPS readings and returns the averaged result
 * along with raw samples for server-side spoof detection.
 * 
 * Designed to be resilient:
 * - Reduced timeout per sample (6s instead of 10s)
 * - Proceeds with whatever samples it collected (min 1)
 * - Total operation has a hard 20-second ceiling
 * - Only throws if ZERO readings were captured
 */
export async function getAveragedPosition(
  samples: number = 3,
  onProgress?: (current: number, total: number) => void
): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number;
  rawSamples: Array<{ lat: number; lng: number; accuracy: number; timestamp: number }>;
}> {
  const readings: GeolocationPosition[] = [];
  const startTime = Date.now();
  const HARD_TIMEOUT_MS = 20000; // 20-second hard ceiling for the entire operation

  for (let i = 0; i < samples; i++) {
    // Hard timeout check — don't start a new sample if we're past the ceiling
    if (i > 0 && Date.now() - startTime > HARD_TIMEOUT_MS) {
      console.warn(`GPS sampling hit ${HARD_TIMEOUT_MS / 1000}s ceiling after ${readings.length} samples. Proceeding.`);
      break;
    }

    if (onProgress) onProgress(i + 1, samples);
    try {
      const pos = await getCurrentPosition();
      readings.push(pos);
      // Small delay between readings to allow GPS to settle (only 500ms, not 1s)
      if (i < samples - 1) await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      console.error(`GPS sample ${i + 1}/${samples} failed:`, err);
      // If we already have at least 1 reading, don't block — proceed with what we have
      if (readings.length > 0) {
        console.warn(`Proceeding with ${readings.length} successful sample(s) out of ${samples}.`);
        break;
      }
      // If this is the last attempt and we still have nothing, throw
      if (i === samples - 1) throw err;
    }
  }

  // Safety check — should never happen given the logic above, but just in case
  if (readings.length === 0) {
    throw new Error('Failed to obtain any GPS readings. Please check your location settings.');
  }

  const avgLat = readings.reduce((sum, r) => sum + r.coords.latitude, 0) / readings.length;
  const avgLng = readings.reduce((sum, r) => sum + r.coords.longitude, 0) / readings.length;
  const avgAcc = readings.reduce((sum, r) => sum + r.coords.accuracy, 0) / readings.length;

  // Build raw samples array for server-side GPS spoof detection
  const rawSamples = readings.map(r => ({
    lat: r.coords.latitude,
    lng: r.coords.longitude,
    accuracy: r.coords.accuracy,
    timestamp: r.timestamp
  }));

  return {
    latitude: avgLat,
    longitude: avgLng,
    accuracy: avgAcc,
    rawSamples
  };
}
