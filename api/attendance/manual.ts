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

    const { studentId, sessionId } = req.body;
    if (!studentId || !sessionId) return res.status(400).json({ error: "Missing required fields" });

    // Validate UUID formats
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(studentId) || !uuidRegex.test(sessionId)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    // Verify the AUTHENTICATED user is a teacher
    const { data: teacher } = await supabase.from("users").select("role").eq("id", authUser.id).single();
    if (teacher?.role !== 'teacher') return res.status(403).json({ error: "Unauthorized" });

    const { error: insertError } = await supabase
      .from("attendance_records")
      .insert({ session_id: sessionId, student_id: studentId, lat: 0, lng: 0, manual: true });

    if (insertError) return res.status(500).json({ error: insertError.message });
    return res.status(200).json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: "An internal error occurred." });
  }
}