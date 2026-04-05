import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { teacherId, studentId, sessionId } = req.body;
    if (!teacherId || !studentId || !sessionId) return res.status(400).json({ error: "Missing required fields" });

    const { data: teacher } = await supabase.from("users").select("role").eq("id", teacherId).single();
    if (teacher?.role !== 'teacher') return res.status(403).json({ error: "Unauthorized" });

    const { error: insertError } = await supabase
      .from("attendance_records")
      .insert({ session_id: sessionId, student_id: studentId, lat: 0, lng: 0, manual: true });

    if (insertError) return res.status(500).json({ error: insertError.message });
    return res.status(200).json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}