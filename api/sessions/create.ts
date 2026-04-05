import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { teacherId, lat, lng, accuracy, section } = req.body;
    
    if (!teacherId || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const { data: userProfile, error: profileError } = await supabase
      .from("users")
      .select("role")
      .eq("id", teacherId)
      .single();

    if (profileError || userProfile?.role !== 'teacher') {
      return res.status(403).json({ error: "Unauthorized: Only teachers can create sessions" });
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("attendance_sessions")
      .insert({
        teacher_id: teacherId,
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