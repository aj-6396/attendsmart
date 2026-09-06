import { getAuthenticatedUser, getSupabase } from '../lib/auth.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ error: "Supabase configuration missing on server." });
  }

  try {
    // 1. Authenticate caller from JWT token
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return res.status(401).json({ error: "Unauthorized. Please log in." });
    }

    // 2. Check if caller has teacher or admin role
    const { data: callerProfile, error: roleError } = await supabase
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .single();

    if (roleError || !callerProfile || !['teacher', 'admin'].includes(callerProfile.role)) {
      return res.status(403).json({ error: "Unauthorized. Only teachers and admins can update student profiles." });
    }

    // 3. Extract and validate parameters
    const {
      studentId,
      fullName,
      enrollmentNo,
      examRollNo,
      course,
      semester,
      majorSubject,
      batch,
      section,
    } = req.body;

    if (!studentId) {
      return res.status(400).json({ error: "Missing required parameter: studentId" });
    }

    // UUID format check
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(studentId)) {
      return res.status(400).json({ error: "Invalid studentId format" });
    }

    // Sanitize string inputs if provided
    const MAX_LEN = 100;
    const fieldsToValidate = [fullName, enrollmentNo, examRollNo, course, semester, majorSubject, batch, section];
    for (const val of fieldsToValidate) {
      if (val !== undefined && val !== null && (typeof val !== 'string' || val.length > MAX_LEN)) {
        return res.status(400).json({ error: "Invalid input: one or more fields exceed maximum length" });
      }
    }

    // Input format validations if updated
    if (enrollmentNo && !/^\d{6}$/.test(enrollmentNo.trim())) {
      return res.status(400).json({ error: "Enrollment Number must be exactly 6 digits" });
    }
    if (examRollNo && examRollNo.trim() !== '' && !/^[a-zA-Z0-9]{11}$/.test(examRollNo.trim())) {
      return res.status(400).json({ error: "Examination Roll Number must be exactly 11 characters" });
    }

    // 4. Update users table if fullName is provided
    if (fullName) {
      const { error: userUpdateErr } = await supabase
        .from('users')
        .update({ name: fullName.trim() })
        .eq('id', studentId);

      if (userUpdateErr) {
        return res.status(500).json({ error: userUpdateErr.message });
      }
    }

    // 5. Update student_profiles table
    const profileUpdates: Record<string, any> = {};
    if (enrollmentNo !== undefined) profileUpdates.enrollment_no = enrollmentNo.trim();
    if (examRollNo !== undefined) profileUpdates.exam_roll_no = examRollNo.trim().toUpperCase() || null;
    if (course !== undefined) profileUpdates.course = course.trim();
    if (semester !== undefined) profileUpdates.semester = semester.trim();
    if (majorSubject !== undefined) profileUpdates.major_subject = majorSubject.trim();
    if (batch !== undefined) profileUpdates.batch = batch.trim();
    if (section !== undefined) profileUpdates.section = section.trim() || null;

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileUpdateErr } = await supabase
        .from('student_profiles')
        .update(profileUpdates)
        .eq('id', studentId);

      if (profileUpdateErr) {
        return res.status(500).json({ error: profileUpdateErr.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Student profile updated successfully"
    });

  } catch (error: any) {
    console.error("Update Student Profile Error:", error);
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
