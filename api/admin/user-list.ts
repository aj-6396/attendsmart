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

    // SECURITY: Authenticate from JWT, NOT from query params
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return res.status(401).json({ error: "Unauthorized. Please log in." });
    }

    const { role, page = '0', pageSize = '10', searchQuery = '' } = req.query;
    
    if (!role) {
      return res.status(400).json({ error: "Missing required parameter: role" });
    }

    // Validate role parameter to prevent arbitrary table scanning
    const allowedRoles = ['student', 'teacher', 'admin'];
    if (!allowedRoles.includes(role as string)) {
      return res.status(400).json({ error: "Invalid role parameter" });
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

    // 2. Pagination Logic — cap pageSize to prevent data dumps
    const safePage = Math.max(0, Number(page) || 0);
    const safePageSize = Math.min(Math.max(1, Number(pageSize) || 10), 50);
    const start = safePage * safePageSize;
    const end = start + safePageSize - 1;

    // 3. Query Construction
    let query = supabase
      .from('users')
      .select('*, student_profiles(*), teacher_profiles(*)', { count: 'exact' })
      .eq('role', role as string)
      .order('name', { ascending: true })
      .range(start, end);

    if (searchQuery) {
      // Sanitize LIKE wildcards to prevent unintended pattern matching
      const sanitized = (searchQuery as string).replace(/[%_\\]/g, '\\$&');
      query = query.ilike('name', `%${sanitized}%`);
    }

    const { data, count, error } = await query;

    if (error) throw error;

    return res.status(200).json({
      users: data || [],
      total: count || 0,
      page: safePage,
      pageSize: safePageSize
    });
  } catch (err: any) {
    console.error("User List API Error:", err);
    return res.status(500).json({ 
      error: "An internal error occurred.", 
      details: err.message,
      path: req.url
    });
  }
}
