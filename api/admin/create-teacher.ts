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

    const { teacherEmail, teacherPassword, teacherName, teacherEnrollmentNo } = req.body;
    if (!teacherEmail || !teacherPassword || !teacherName || !teacherEnrollmentNo) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Verify the AUTHENTICATED user is admin
    const { data: adminProfile, error: adminError } = await supabase.from("users").select("role").eq("id", authUser.id).single();
    if (adminError || adminProfile?.role !== 'admin') return res.status(403).json({ error: "Unauthorized" });

    if (!/^\d{6}$/.test(teacherPassword)) return res.status(400).json({ error: "Password must be exactly 6 digits" });

    // Validate and sanitize inputs
    if (typeof teacherName !== 'string' || teacherName.length > 100) return res.status(400).json({ error: "Invalid teacher name" });
    if (typeof teacherEmail !== 'string' || teacherEmail.length > 100) return res.status(400).json({ error: "Invalid email" });
    if (typeof teacherEnrollmentNo !== 'string' || teacherEnrollmentNo.length > 50) return res.status(400).json({ error: "Invalid ID" });

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: teacherEmail.trim(), password: teacherPassword, email_confirm: true
    });
    if (authError || !authData.user) return res.status(500).json({ error: authError?.message || "Failed to create user" });

    await supabase.from('users').insert({ id: authData.user.id, name: teacherName.trim().slice(0, 100), role: 'teacher' });
    await supabase.from('teacher_profiles').insert({ id: authData.user.id, employee_id: teacherEnrollmentNo.trim().slice(0, 50), department: 'Faculty' });

    return res.status(200).json({ success: true, teacherId: authData.user.id });
  } catch (err: any) {
    return res.status(500).json({ error: "An internal error occurred." });
  }
}