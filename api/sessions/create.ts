import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "../lib/auth";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    // SECURITY: Authenticate from JWT, NOT from request body
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return res.status(401).json({ error: "Unauthorized. Please log in." });
    }

    const { lat, lng, accuracy, classId, section } = req.body;
    
    if (lat === undefined || lng === undefined || !classId) {
      return res.status(400).json({ error: "Missing required fields, including classId" });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(classId)) {
      return res.status(400).json({ error: "Invalid class ID format" });
    }

    // Validate coordinates are numbers
    if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: "Invalid coordinates" });
    }

    // Verify the AUTHENTICATED user is a teacher
    const { data: userProfile, error: profileError } = await supabase
      .from("users")
      .select("role")
      .eq("id", authUser.id)
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
      .eq("teacher_id", authUser.id)
      .single();
      
    if (!classCheck) {
       return res.status(404).json({ error: "Class not found" });
    }
    
    // Allows the original creator OR any co-teacher to create a session
    if (classCheck.created_by !== authUser.id && !coTeacher) {
       return res.status(403).json({ error: "You are not authorized to create sessions for this class" });
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("attendance_sessions")
      .insert({
        teacher_id: authUser.id,
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
    return res.status(500).json({ error: "An internal error occurred." });
  }
}