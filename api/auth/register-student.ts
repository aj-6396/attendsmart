// api/auth/register-student.ts
import { getSupabase } from "../_lib/auth.js";

export default async function handler(req: any, res: any) {
  // 1. Ensure it only accepts POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ error: "Database configuration missing on server." });
  }

  try {
    const { enrollmentNo, examRollNo, fullName, course, semester, majorSubject, batch, section, password, deviceId } = req.body;

    if (!enrollmentNo || !examRollNo || !fullName || !course || !semester || !majorSubject || !batch || !section || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Security: Reject excessively long inputs to prevent abuse
    const MAX_LEN = 100;
    if ([enrollmentNo, examRollNo, fullName, course, semester, majorSubject, batch, section, password].some(
      (v: string) => typeof v !== 'string' || v.length > MAX_LEN
    )) {
      return res.status(400).json({ error: "Invalid input: one or more fields exceed maximum length" });
    }

    const trimmedEnrollment = enrollmentNo.trim();
    const trimmedExamRoll = examRollNo?.trim().toUpperCase();
    const email = trimmedEnrollment.includes('@') ? trimmedEnrollment.toLowerCase() : `${trimmedEnrollment.toLowerCase()}@college.com`;

    // Validate inputs
    if (!/^\d{6}$/.test(trimmedEnrollment)) return res.status(400).json({ error: "Enrollment Number must be exactly 6 digits" });
    if (!/^[a-zA-Z0-9]{11}$/.test(trimmedExamRoll)) return res.status(400).json({ error: "Examination Roll Number must be exactly 11 characters" });
    if (!/^\d{6}$/.test(password)) return res.status(400).json({ error: "Password must be exactly 6 digits" });

    // Create Auth User
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'student' }
    });

    if (authError) return res.status(500).json({ error: authError.message });
    if (!authData.user) return res.status(500).json({ error: "Failed to create auth user" });

    // Create User Record
    const { error: userError } = await supabase.from('users').insert({
      id: authData.user.id,
      name: fullName.trim().slice(0, 100),
      role: 'student',
    });

    if (userError) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({ error: userError.message });
    }

    // Create Student Profile
    const { error: profileError } = await supabase.from('student_profiles').insert({
      id: authData.user.id,
      enrollment_no: trimmedEnrollment,
      exam_roll_no: trimmedExamRoll,
      course: course.trim().slice(0, 50),
      semester: semester.trim().slice(0, 10),
      major_subject: majorSubject.trim().slice(0, 50),
      batch: batch.trim().slice(0, 20),
      section: section.trim().slice(0, 10),
      device_id: deviceId || null,
    });

    if (profileError) {
      await supabase.from('users').delete().eq('id', authData.user.id);
      await supabase.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({ error: profileError.message });
    }

    // Success!
    return res.status(200).json({ success: true, userId: authData.user.id });

  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
