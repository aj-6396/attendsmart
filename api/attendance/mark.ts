import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { studentId, otp, lat, lng, accuracy, deviceId } = req.body;

    if (!studentId || !otp || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const { data: session, error: sessionError } = await supabase
      .from("attendance_sessions")
      .select("id, lat, lng, class_id")
      .eq("otp", otp)
      .eq("active", true)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (sessionError || !session) return res.status(404).json({ error: "Invalid or expired OTP" });

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

    if (deviceId) {
      const { data: profile } = await supabase
        .from("student_profiles")
        .select("device_id")
        .eq("id", studentId)
        .single();
      
      if (profile?.device_id && profile.device_id !== deviceId) {
        return res.status(403).json({ error: "Device mismatch: This account is registered to another device." });
      }
    }

    const { error: insertError } = await supabase
      .from("attendance_records")
      .insert({ session_id: session.id, student_id: studentId, lat, lng });

    if (insertError) return res.status(500).json({ error: insertError.message });
    return res.status(200).json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}