import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { requesterId, targetUserId, newPassword } = req.body;
    if (!requesterId || !targetUserId || !newPassword) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // 1. Verify requester is admin or teacher
    const { data: profile, error: profileErr } = await supabase.from("users").select("role").eq("id", requesterId).single();
    if (profileErr || !['admin', 'teacher'].includes(profile?.role)) return res.status(403).json({ error: "Unauthorized" });

    // 2. Update password via Auth Admin API
    const { error: authError } = await supabase.auth.admin.updateUserById(
      targetUserId,
      { password: newPassword }
    );
    
    if (authError) throw authError;

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("Reset Password Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
