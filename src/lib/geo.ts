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
        timeout: 10000,
        maximumAge: 0,
        ...options
      });
    }
  });
}

/**
 * Captures multiple GPS readings and returns the averaged result
 * along with raw samples for server-side spoof detection.
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
  
  for (let i = 0; i < samples; i++) {
    if (onProgress) onProgress(i + 1, samples);
    try {
      const pos = await getCurrentPosition();
      readings.push(pos);
      // Small delay between readings to allow GPS to settle
      if (i < samples - 1) await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      console.error(`Sample ${i + 1} failed:`, err);
      if (readings.length === 0 && i === samples - 1) throw err;
    }
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
