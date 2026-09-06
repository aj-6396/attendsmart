import { getAuthenticatedUser, getSupabase } from '../lib/auth.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ error: "Database configuration missing on server." });
  }

  try {
    // 1. Authenticate caller from JWT token
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return res.status(401).json({ error: "Unauthorized. Please log in." });
    }

    // 2. Check if caller has admin role
    const { data: callerProfile, error: roleError } = await supabase
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .single();

    if (roleError || !callerProfile || callerProfile.role !== 'admin') {
      return res.status(403).json({ error: "Unauthorized. Admin privileges required." });
    }

    // 3. Extract parameters
    const { title, body, targetRole = 'all' } = req.body;

    if (!title || !title.trim() || !body || !body.trim()) {
      return res.status(400).json({ error: "Title and Body are required" });
    }

    const trimmedTitle = title.trim().slice(0, 100);
    const trimmedBody = body.trim().slice(0, 500);

    // 4. Insert into announcements table
    const { data: announcement, error: insertErr } = await supabase
      .from('announcements')
      .insert({
        title: trimmedTitle,
        message: trimmedBody,
        target_role: targetRole,
        created_by: authUser.id,
      })
      .select()
      .single();

    if (insertErr) {
      return res.status(500).json({ error: insertErr.message });
    }

    // 5. If FCM server key is configured in env, trigger Firebase REST API topic push
    const fcmServerKey = process.env.FCM_SERVER_KEY;
    if (fcmServerKey) {
      try {
        const topic = targetRole === 'all' ? 'all_users' : targetRole;
        await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `key=${fcmServerKey}`,
          },
          body: JSON.stringify({
            to: `/topics/${topic}`,
            notification: {
              title: trimmedTitle,
              body: trimmedBody,
              sound: 'default',
            },
            data: {
              title: trimmedTitle,
              body: trimmedBody,
              announcementId: announcement?.id,
            },
          }),
        });
      } catch (fcmErr) {
        console.error("FCM Push Trigger Warning:", fcmErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Broadcast notification dispatched successfully",
      announcement,
    });

  } catch (error: any) {
    console.error("Broadcast Notification Error:", error);
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
