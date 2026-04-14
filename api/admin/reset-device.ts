import { createClient } from '@supabase/supabase-js';
import { VercelRequest, VercelResponse } from '@vercel/node';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { adminId, targetUserId } = req.body;

  try {
    // 1. Verify requester is an admin or teacher
    const { data: requester, error: requesterErr } = await supabase
      .from('users')
      .select('role')
      .eq('id', adminId)
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
    return res.status(500).json({ error: error.message });
  }
}
