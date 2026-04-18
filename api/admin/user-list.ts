import { createClient } from "@supabase/supabase-js";
import { VercelRequest, VercelResponse } from "@vercel/node";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { adminId, role, page = '0', pageSize = '10', searchQuery = '' } = req.query;
    
    if (!adminId || !role) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // 1. Authorization Check
    const { data: adminProfile, error: adminError } = await supabase
      .from("users")
      .select("role")
      .eq("id", adminId as string)
      .single();

    if (adminError || adminProfile?.role !== 'admin') {
      return res.status(403).json({ error: "Unauthorized. Admin access required." });
    }

    // 2. Pagination Logic
    const start = Number(page) * Number(pageSize);
    const end = start + Number(pageSize) - 1;

    // 3. Query Construction
    let query = supabase
      .from('users')
      .select('*, student_profiles(*), teacher_profiles(*)', { count: 'exact' })
      .eq('role', role as string)
      .order('name', { ascending: true })
      .range(start, end);

    if (searchQuery) {
      query = query.ilike('name', `%${searchQuery}%`);
    }

    const { data, count, error } = await query;

    if (error) throw error;

    return res.status(200).json({
      users: data || [],
      total: count || 0,
      page: Number(page),
      pageSize: Number(pageSize)
    });
  } catch (err: any) {
    console.error("User List API Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
