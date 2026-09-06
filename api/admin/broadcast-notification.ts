import { getAuthenticatedUser, getSupabase } from '../_lib/auth.js';
import { createSign } from 'crypto';

// Helper to get Google OAuth2 Access Token from Service Account Key
async function getGoogleAccessToken(clientEmail: string, privateKey: string): Promise<string | null> {
  try {
    const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(JSON.stringify({
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    })).toString('base64url');

    const sign = createSign('RSA-SHA256');

    sign.update(`${header}.${payload}`);
    const signature = sign.sign(formattedPrivateKey, 'base64url');
    const jwt = `${header}.${payload}.${signature}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    const data = await res.json();
    return data.access_token || null;
  } catch (err) {
    console.error("Failed to generate Google Access Token:", err);
    return null;
  }
}

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

    const topic = targetRole === 'all' ? 'all_users' : targetRole;

    // 5. Try FCM HTTP v1 (Service Account) first
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const projectId = process.env.FIREBASE_PROJECT_ID || 'classmark';

    if (clientEmail && privateKey) {
      try {
        const accessToken = await getGoogleAccessToken(clientEmail, privateKey);
        if (accessToken) {
          await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              message: {
                topic: topic,
                notification: {
                  title: trimmedTitle,
                  body: trimmedBody,
                },
                data: {
                  announcementId: String(announcement?.id || ''),
                },
              },
            }),
          });
        }
      } catch (fcmV1Err) {
        console.error("FCM v1 Push Warning:", fcmV1Err);
      }
    } else {
      // Fallback: FCM Legacy Server Key
      const fcmServerKey = process.env.FCM_SERVER_KEY;
      if (fcmServerKey) {
        try {
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
          console.error("FCM Legacy Push Warning:", fcmErr);
        }
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

