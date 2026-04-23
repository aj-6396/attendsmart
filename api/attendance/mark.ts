/**
 * Copyright © 2026 Ambuj Singh & Aniket Verma. All Rights Reserved.
 * This code is proprietary and confidential. Unauthorized copying, 
 * distribution, or use is strictly prohibited.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * GPS Spoofing Detection
 * Analyzes location samples for patterns that indicate mock GPS usage.
 * Returns { spoofed: boolean, reason: string }
 */
function detectGpsSpoofing(
  samples: Array<{ lat: number; lng: number; accuracy: number; timestamp: number }>,
  reportedAccuracy: number
): { spoofed: boolean; reason: string } {
  // Check 1: Suspiciously perfect accuracy
  // Real GPS indoors is typically 10-50m. Mock GPS apps often report exactly 1m or < 3m.
  if (reportedAccuracy < 3) {
    return { spoofed: true, reason: "GPS accuracy is suspiciously precise. This may indicate a mock location." };
  }

  // Check 2: If we have multiple samples, check consistency
  if (samples && samples.length >= 2) {
    const calculateDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371e3;
      const φ1 = (lat1 * Math.PI) / 180;
      const φ2 = (lat2 * Math.PI) / 180;
      const Δφ = ((lat2 - lat1) * Math.PI) / 180;
      const Δλ = ((lon2 - lon1) * Math.PI) / 180;
      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    // Check 3: Zero variance between samples = definitely spoofed
    // Real GPS always has micro-fluctuations between readings.
    const allSameLat = samples.every(s => s.lat === samples[0].lat);
    const allSameLng = samples.every(s => s.lng === samples[0].lng);
    if (allSameLat && allSameLng && samples.length >= 3) {
      return { spoofed: true, reason: "Location readings show zero natural variance. This indicates a spoofed location." };
    }

    // Check 4: Impossible speed between samples
    // If someone "moved" more than 100m between 1-second-apart samples, that's impossible on foot.
    for (let i = 1; i < samples.length; i++) {
      const dist = calculateDist(samples[i-1].lat, samples[i-1].lng, samples[i].lat, samples[i].lng);
      const timeDiffSec = Math.max((samples[i].timestamp - samples[i-1].timestamp) / 1000, 0.5);
      const speedMps = dist / timeDiffSec; // meters per second

      // 30 m/s = 108 km/h — impossible while walking in a classroom
      if (speedMps > 30) {
        return { spoofed: true, reason: "Location jumped impossibly fast between readings. This indicates GPS spoofing." };
      }
    }

    // Check 5: All accuracies are exactly identical across samples
    // Real GPS accuracy fluctuates between readings.
    const allSameAccuracy = samples.every(s => s.accuracy === samples[0].accuracy);
    if (allSameAccuracy && samples.length >= 3 && samples[0].accuracy < 10) {
      return { spoofed: true, reason: "GPS accuracy values are unnaturally consistent. This may indicate a mock location." };
    }
  }

  return { spoofed: false, reason: "" };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { studentId, otp, lat, lng, accuracy, deviceId, localFallback, gpsSamples, classId } = req.body;

    if (!studentId || !otp || lat === undefined || lng === undefined || !classId) {
      return res.status(400).json({ error: "Missing required fields, including class selection." });
    }

    // ============================
    // FIX #2: Mandatory Device ID
    // ============================
    if (!deviceId) {
      return res.status(400).json({ error: "Device identification is required. Please clear your browser cache and re-login." });
    }

    const { data: session, error: sessionError } = await supabase
      .from("attendance_sessions")
      .select("id, lat, lng, class_id")
      .eq("otp", otp)
      .eq("class_id", classId) // Force filter by class
      .eq("active", true)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (sessionError || !session) return res.status(404).json({ error: "Invalid or expired OTP for this class." });

    // Ensure student is enrolled in the class!
    if (session.class_id) {
       const { data: enrollment } = await supabase
         .from("class_enrollments")
         .select("class_id")
         .eq("class_id", session.class_id)
         .eq("student_id", studentId)
         .single();
         
       if (!enrollment) return res.status(403).json({ error: "You are not enrolled in this class." });
    }

    const { data: existing } = await supabase
      .from("attendance_records")
      .select("id")
      .eq("session_id", session.id)
      .eq("student_id", studentId)
      .single();

    if (existing) return res.status(400).json({ error: "Attendance already marked" });

    // ========================================
    // FIX #3: GPS Spoofing Detection
    // ========================================
    const spoofCheck = detectGpsSpoofing(gpsSamples || [], accuracy || 20);
    if (spoofCheck.spoofed) {
      return res.status(403).json({ error: spoofCheck.reason });
    }

    // Geo-validation logic
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371e3;
      const φ1 = (lat1 * Math.PI) / 180;
      const φ2 = (lat2 * Math.PI) / 180;
      const Δφ = ((lat2 - lat1) * Math.PI) / 180;
      const Δλ = ((lon2 - lon1) * Math.PI) / 180;
      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const distance = calculateDistance(lat, lng, session.lat, session.lng);
    
    let allowedRadius = 40;
    if (accuracy <= 20) allowedRadius = 40;
    else if (accuracy <= 40) allowedRadius = 60;
    else if (accuracy <= 60) allowedRadius = 80;
    else allowedRadius = 100;

    if (distance > allowedRadius) {
      return res.status(403).json({ 
        error: `You are not within the allowed range (${Math.round(distance)}m away, allowed: ${Math.round(allowedRadius)}m)`
      });
    }

    // ============================================
    // FIX #2: Mandatory Device Binding & Proxy Prevention
    // ============================================
    
    // Check if this device has already been used by someone ELSE for this specific session (Anti-Proxy)
    const { data: proxyAttempt } = await supabase
      .from("attendance_records")
      .select("student_id")
      .eq("session_id", session.id)
      .eq("device_id", deviceId) // We will start storing device_id in attendance_records for auditing
      .neq("student_id", studentId)
      .limit(1)
      .maybeSingle();

    if (proxyAttempt) {
      return res.status(403).json({ 
        error: "Proxy Detected: This device has already been used to mark attendance for another student in this session. One device per student only." 
      });
    }

    const { data: profile } = await supabase
      .from("student_profiles")
      .select("device_id")
      .eq("id", studentId)
      .single();
    
    if (!profile) {
      return res.status(404).json({ error: "Student profile not found." });
    }

    if (profile.device_id && profile.device_id !== deviceId && profile.device_id !== localFallback) {
      // Device mismatch — someone is using a different device
      return res.status(403).json({ 
        error: "Device Mismatch: Your account is registered to another device. If you have a new phone, please ask your teacher to 'Reset Your Device Link' during class." 
      });
    }

    if (!profile.device_id) {
      // First-time binding — lock this student to this device
      await supabase
        .from("student_profiles")
        .update({ device_id: deviceId })
        .eq("id", studentId);
    }

    const { error: insertError } = await supabase
      .from("attendance_records")
      .insert({ session_id: session.id, student_id: studentId, lat, lng, device_id: deviceId });

    if (insertError) return res.status(500).json({ error: insertError.message });
    return res.status(200).json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}