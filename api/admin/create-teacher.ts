import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { adminId, teacherEmail, teacherPassword, teacherName, teacherEnrollmentNo } = req.body;
    if (!adminId || !teacherEmail || !teacherPassword || !teacherName || !teacherEnrollmentNo) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const { data: adminProfile, error: adminError } = await supabase.from("users").select("role").eq("id", adminId).single();
    if (adminError || adminProfile?.role !== 'admin') return res.status(403).json({ error: "Unauthorized" });

    if (!/^\d{6}$/.test(teacherPassword)) return res.status(400).json({ error: "Password must be exactly 6 digits" });

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: teacherEmail, password: teacherPassword, email_confirm: true
    });
    if (authError || !authData.user) return res.status(500).json({ error: authError?.message || "Failed to create user" });

    await supabase.from('users').insert({ id: authData.user.id, name: teacherName, role: 'teacher' });
    await supabase.from('teacher_profiles').insert({ id: authData.user.id, employee_id: teacherEnrollmentNo, department: 'Faculty' });

    return res.status(200).json({ success: true, teacherId: authData.user.id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}