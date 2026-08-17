import { createClient } from "@supabase/supabase-js";
import { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../lib/auth.js";

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  return createClient(url, key);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ error: "Database configuration missing" });

    // SECURITY: Authenticate from JWT
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return res.status(401).json({ error: "Unauthorized. Please log in." });
    }

    // 1. Authorization Check — verify the AUTHENTICATED user is admin
    const { data: adminProfile, error: adminError } = await supabase
      .from("users")
      .select("role")
      .eq("id", authUser.id)
      .single();

    if (adminError || adminProfile?.role !== 'admin') {
      return res.status(403).json({ error: "Unauthorized. Admin access required." });
    }

    // 2. Fetch Classes with teacher names
    const { data, error } = await supabase
      .from('classes')
      .select('*, users:created_by(name)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.status(200).json({ classes: data || [] });
  } catch (err: any) {
    console.error("Class List API Error:", err);
    return res.status(500).json({ 
      error: "An internal error occurred.", 
      details: err.message 
    });
  }
}
