import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { teacherId, lat, lng, accuracy, classId, section } = req.body;
    
    if (!teacherId || lat === undefined || lng === undefined || !classId) {
      return res.status(400).json({ error: "Missing required fields, including classId" });
    }

    const { data: userProfile, error: profileError } = await supabase
      .from("users")
      .select("role")
      .eq("id", teacherId)
      .single();

    if (profileError || userProfile?.role !== 'teacher') {
      return res.status(403).json({ error: "Unauthorized: Only teachers can create sessions" });
    }
    
    // Verify teacher is part of the class or owns it
    const { data: classCheck } = await supabase
      .from("classes")
      .select("id, created_by")
      .eq("id", classId)
      .single();
    
    const { data: coTeacher } = await supabase
      .from("class_teachers")
      .select("class_id")
      .eq("class_id", classId)
      .eq("teacher_id", teacherId)
      .single();
      
    if (!classCheck) {
       return res.status(404).json({ error: "Class not found" });
    }
    
    // Allows the original creator OR any co-teacher to create a session
    if (classCheck.created_by !== teacherId && !coTeacher) {
       return res.status(403).json({ error: "You are not authorized to create sessions for this class" });
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("attendance_sessions")
      .insert({
        teacher_id: teacherId,
        class_id: classId,
        otp,
        expires_at: expiresAt,
        lat,
        lng,
        accuracy: accuracy || 20,
        section: section || null,
        active: true
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}