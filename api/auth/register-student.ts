// api/auth/register-student.ts
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase (Vercel will read these from your Environment Variables)
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: any, res: any) {
  // 1. Ensure it only accepts POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  try {
    const { enrollmentNo, examRollNo, fullName, course, semester, majorSubject, batch, section, password, deviceId } = req.body;

    if (!enrollmentNo || !examRollNo || !fullName || !course || !semester || !majorSubject || !batch || !section || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const trimmedEnrollment = enrollmentNo.trim();
    const trimmedExamRoll = examRollNo?.trim().toUpperCase();
    const email = trimmedEnrollment.includes('@') ? trimmedEnrollment.toLowerCase() : `${trimmedEnrollment.toLowerCase()}@college.com`;
    const isOwner = email === 'ambuj02103@gmail.com';

    // Validate inputs
    if (!/^\d{6}$/.test(trimmedEnrollment)) return res.status(400).json({ error: "Enrollment Number must be exactly 6 digits" });
    if (!/^[a-zA-Z0-9]{11}$/.test(trimmedExamRoll)) return res.status(400).json({ error: "Examination Roll Number must be exactly 11 characters" });
    if (!/^\d{6}$/.test(password)) return res.status(400).json({ error: "Password must be exactly 6 digits" });

    // Create Auth User
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: isOwner ? 'admin' : 'student' }
    });

    if (authError) return res.status(500).json({ error: authError.message });
    if (!authData.user) return res.status(500).json({ error: "Failed to create auth user" });

    // Create User Record
    const { error: userError } = await supabase.from('users').insert({
      id: authData.user.id,
      name: fullName.trim(),
      role: isOwner ? 'admin' : 'student',
    });

    if (userError) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({ error: userError.message });
    }

    // Create Student Profile
    if (!isOwner) {
      const { error: profileError } = await supabase.from('student_profiles').insert({
        id: authData.user.id,
        enrollment_no: trimmedEnrollment,
        exam_roll_no: trimmedExamRoll,
        course: course.trim(),
        semester: semester.trim(),
        major_subject: majorSubject.trim(),
        batch: batch.trim(),
        section: section.trim(),
        device_id: deviceId || null,
      });

      if (profileError) {
        await supabase.from('users').delete().eq('id', authData.user.id);
        await supabase.auth.admin.deleteUser(authData.user.id);
        return res.status(500).json({ error: profileError.message });
      }
    }

    // Success!
    return res.status(200).json({ success: true, userId: authData.user.id });

  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
