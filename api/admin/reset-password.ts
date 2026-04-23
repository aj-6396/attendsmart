import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "../lib/auth";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

  try {
    // SECURITY: Authenticate from JWT, NOT from request body
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return res.status(401).json({ error: "Unauthorized. Please log in." });
    }

    const { targetUserId, newPassword } = req.body;
    if (!targetUserId || !newPassword) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Server-side password validation (CRITICAL: never trust client-only validation)
    if (!/^\d{6}$/.test(newPassword)) {
      return res.status(400).json({ error: "Password must be exactly 6 digits" });
    }

    // Validate UUID format to prevent injection
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(targetUserId)) {
      return res.status(400).json({ error: "Invalid user ID format" });
    }

    // 1. Verify the AUTHENTICATED user is admin or teacher
    const { data: profile, error: profileErr } = await supabase.from("users").select("role").eq("id", authUser.id).single();
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
    return res.status(500).json({ error: "An internal error occurred." });
  }
}
