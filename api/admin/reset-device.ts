import { createClient } from '@supabase/supabase-js';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthenticatedUser } from '../lib/auth.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // SECURITY: Authenticate from JWT, NOT from request body
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return res.status(401).json({ error: "Unauthorized. Please log in." });
    }

    const { targetUserId } = req.body;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!targetUserId || !uuidRegex.test(targetUserId)) {
      return res.status(400).json({ error: "Invalid target user ID" });
    }

    // 1. Verify the AUTHENTICATED user is an admin or teacher
    const { data: requester, error: requesterErr } = await supabase
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .single();

    if (requesterErr || !['admin', 'teacher'].includes(requester?.role)) {
      return res.status(403).json({ error: 'Unauthorized. Proper access rights required.' });
    }

    // 2. Clear student device link
    const { error: resetErr } = await supabase
      .from('student_profiles')
      .update({ device_id: null })
      .eq('id', targetUserId);

    if (resetErr) throw resetErr;

    return res.status(200).json({ message: 'Device link reset successfully' });
  } catch (error: any) {
    console.error('Device reset error:', error);
    return res.status(500).json({ error: "An internal error occurred." });
  }
}
