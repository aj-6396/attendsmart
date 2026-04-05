import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Supabase environment variables are missing in server.ts. Please check your .env file and ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API: Generate OTP (Edge Function Simulation)
  app.post("/api/sessions/create", async (req, res) => {
    const { teacherId, lat, lng, accuracy, section } = req.body;
    
    if (!teacherId || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Verify user role is teacher
    const { data: userProfile, error: profileError } = await supabase
      .from("users")
      .select("role")
      .eq("id", teacherId)
      .single();

    if (profileError || userProfile?.role !== 'teacher') {
      return res.status(403).json({ error: "Unauthorized: Only teachers can create sessions" });
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes expiry

    const { data, error } = await supabase
      .from("attendance_sessions")
      .insert({
        teacher_id: teacherId,
        otp,
        expires_at: expiresAt,
        lat,
        lng,
        accuracy: accuracy || 20,
        section: section || null,
        active: true
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // API: Admin Create Teacher
  app.post("/api/admin/create-teacher", async (req, res) => {
    const { adminId, teacherEmail, teacherPassword, teacherName, teacherEnrollmentNo } = req.body;

    if (!adminId || !teacherEmail || !teacherPassword || !teacherName || !teacherEnrollmentNo) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Verify user role is admin
    const { data: adminProfile, error: adminError } = await supabase
      .from("users")
      .select("role")
      .eq("id", adminId)
      .single();

    if (adminError || adminProfile?.role !== 'admin') {
      return res.status(403).json({ error: "Unauthorized: Only admins can create teachers" });
    }

    // Validate 6-digit numeric password
    if (!/^\d{6}$/.test(teacherPassword)) {
      return res.status(400).json({ error: "Password must be exactly 6 digits (numeric only)" });
    }

    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: teacherEmail,
      password: teacherPassword,
      email_confirm: true
    });

    if (authError) return res.status(500).json({ error: authError.message });
    if (!authData.user) return res.status(500).json({ error: "Failed to create auth user" });

    // 2. Create profile in users table
    const { error: userError } = await supabase.from('users').insert({
      id: authData.user.id,
      name: teacherName,
      role: 'teacher',
    });

    if (userError) return res.status(500).json({ error: userError.message });

    // 3. Create teacher profile
    const { error: profileError } = await supabase.from('teacher_profiles').insert({
      id: authData.user.id,
      employee_id: teacherEnrollmentNo,
      department: 'Faculty'
    });

    if (profileError) return res.status(500).json({ error: profileError.message });

    res.json({ success: true, teacherId: authData.user.id });
  });

  // API: Reset Password (Admins can reset anyone, Teachers can reset students)
  app.post("/api/admin/reset-password", async (req, res) => {
    const { requesterId, targetUserId, newPassword } = req.body;

    if (!requesterId || !targetUserId || !newPassword) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // 1. Get requester role
    const { data: requester, error: requesterError } = await supabase
      .from("users")
      .select("role")
      .eq("id", requesterId)
      .single();

    if (requesterError || !requester) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // 2. Get target user role
    const { data: target, error: targetError } = await supabase
      .from("users")
      .select("role")
      .eq("id", targetUserId)
      .single();

    if (targetError || !target) {
      return res.status(404).json({ error: "Target user not found" });
    }

    // 3. Permission Check:
    // - Admins can reset anyone
    // - Teachers can only reset students
    const canReset = requester.role === 'admin' || (requester.role === 'teacher' && target.role === 'student');

    if (!canReset) {
      return res.status(403).json({ error: "You do not have permission to reset this user's password" });
    }

    // Validate 6-digit numeric password
    if (!/^\d{6}$/.test(newPassword)) {
      return res.status(400).json({ error: "Password must be exactly 6 digits (numeric only)" });
    }

    // 4. Update user password in Supabase Auth
    const { error: authError } = await supabase.auth.admin.updateUserById(targetUserId, {
      password: newPassword
    });

    if (authError) return res.status(500).json({ error: authError.message });

    res.json({ success: true });
  });

  // API: Public Student Registration (Bypasses rate limits using admin key)
  app.post("/api/auth/register-student", async (req, res) => {
    const { enrollmentNo, examRollNo, fullName, course, semester, majorSubject, batch, section, password } = req.body;

    if (!enrollmentNo || !examRollNo || !fullName || !course || !semester || !majorSubject || !batch || !section || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const trimmedEnrollment = enrollmentNo.trim();
    const trimmedExamRoll = examRollNo?.trim().toUpperCase();
    const email = trimmedEnrollment.includes('@') ? trimmedEnrollment.toLowerCase() : `${trimmedEnrollment.toLowerCase()}@college.com`;
    const isOwner = email === 'ambuj02103@gmail.com';

    // Validate 6-digit numeric enrollment
    if (!/^\d{6}$/.test(trimmedEnrollment)) {
      return res.status(400).json({ error: "Enrollment Number must be exactly 6 digits" });
    }

    // Validate 10-digit alphanumeric exam roll
    if (!/^[a-zA-Z0-9]{10}$/.test(trimmedExamRoll)) {
      return res.status(400).json({ error: "Examination Roll Number must be exactly 10 alphanumeric characters" });
    }

    // Validate 6-digit numeric password
    if (!/^\d{6}$/.test(password)) {
      return res.status(400).json({ error: "Password must be exactly 6 digits (numeric only)" });
    }

    // 1. Create user in Supabase Auth using Admin API (bypasses rate limits/confirmation)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: isOwner ? 'admin' : 'student' }
    });

    if (authError) return res.status(500).json({ error: authError.message });
    if (!authData.user) return res.status(500).json({ error: "Failed to create auth user" });

    // 2. Create user in users table
    const { error: userError } = await supabase.from('users').insert({
      id: authData.user.id,
      name: fullName.trim(),
      role: isOwner ? 'admin' : 'student',
    });

    if (userError) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({ error: userError.message });
    }

    // 3. Create profile if student
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
      });

      if (profileError) {
        await supabase.from('users').delete().eq('id', authData.user.id);
        await supabase.auth.admin.deleteUser(authData.user.id);
        return res.status(500).json({ error: profileError.message });
      }
    }

    res.json({ success: true, userId: authData.user.id });
  });

  // API: Mark Attendance (Edge Function Simulation with Adaptive Geo-validation)
  app.post("/api/attendance/mark", async (req, res) => {
    const { studentId, otp, lat, lng, accuracy, deviceId } = req.body;

    if (!studentId || !otp || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // 1. Find active session with this OTP
    const { data: session, error: sessionError } = await supabase
      .from("attendance_sessions")
      .select("*")
      .eq("otp", otp)
      .eq("active", true)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: "Invalid or expired OTP" });
    }

    // 2. Check if already marked
    const { data: existing } = await supabase
      .from("attendance_records")
      .select("id")
      .eq("session_id", session.id)
      .eq("student_id", studentId)
      .single();

    if (existing) {
      return res.status(400).json({ error: "Attendance already marked" });
    }

    // 3. Geo-validation (10m radius)
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371e3;
      const φ1 = (lat1 * Math.PI) / 180;
      const φ2 = (lat2 * Math.PI) / 180;
      const Δφ = ((lat2 - lat1) * Math.PI) / 180;
      const Δλ = ((lon2 - lon1) * Math.PI) / 180;
      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const distance = calculateDistance(lat, lng, session.lat, session.lng);
    
    // 3. Adaptive Radius Logic
    // If accuracy <= 20m -> allow radius = 40m
    // If accuracy <= 40m -> allow radius = 60m
    // If accuracy <= 60m -> allow radius = 80m
    // If accuracy > 60m -> show retry message (handled on frontend)
    let allowedRadius = 40;
    if (accuracy <= 20) allowedRadius = 40;
    else if (accuracy <= 40) allowedRadius = 60;
    else if (accuracy <= 60) allowedRadius = 80;
    else allowedRadius = 100; // Fallback for edge cases

    if (distance > allowedRadius) {
      return res.status(403).json({ 
        error: `You are not within the allowed range (${Math.round(distance)}m away, allowed: ${Math.round(allowedRadius)}m)`,
        distance: Math.round(distance),
        allowedRadius
      });
    }

    // 4. Device Verification (Optional: if deviceId is provided)
    if (deviceId) {
      const { data: profile } = await supabase
        .from("student_profiles")
        .select("device_id")
        .eq("id", studentId)
        .single();
      
      if (profile?.device_id && profile.device_id !== deviceId) {
        return res.status(403).json({ error: "Device mismatch: This account is registered to another device." });
      }
    }

    // 4. Record attendance
    const { error: insertError } = await supabase
      .from("attendance_records")
      .insert({
        session_id: session.id,
        student_id: studentId,
        lat,
        lng
      });

    if (insertError) return res.status(500).json({ error: insertError.message });
    res.json({ success: true });
  });

  // API: Manual Override (Teacher marks student attendance)
  app.post("/api/attendance/manual", async (req, res) => {
    const { teacherId, studentId, sessionId } = req.body;

    if (!teacherId || !studentId || !sessionId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // 1. Verify teacher
    const { data: teacher } = await supabase
      .from("users")
      .select("role")
      .eq("id", teacherId)
      .single();
    
    if (teacher?.role !== 'teacher') {
      return res.status(403).json({ error: "Unauthorized: Only teachers can manually mark attendance" });
    }

    // 2. Mark attendance
    const { error: insertError } = await supabase
      .from("attendance_records")
      .insert({
        session_id: sessionId,
        student_id: studentId,
        lat: 0, // Manual override
        lng: 0,
        manual: true
      });

    if (insertError) return res.status(500).json({ error: insertError.message });
    res.json({ success: true });
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // API: Admin Stats
  app.get("/api/admin/stats", async (req, res) => {
    try {
      const { data: students, count: studentCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'student');

      const { data: teachers, count: teacherCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'teacher');

      const { data: sessions, count: sessionCount } = await supabase
        .from('attendance_sessions')
        .select('*', { count: 'exact', head: true });

      const { data: attendance, count: attendanceCount } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true });

      // Calculate overall attendance %
      // This is a simplified calculation: total attendance / (total sessions * total students)
      // In a real app, you'd want to be more precise based on active students per session
      const overallAttendance = sessionCount && studentCount ? (attendanceCount || 0) / (sessionCount * studentCount) * 100 : 0;

      // Fetch attendance trends (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data: trendsData } = await supabase
        .from('attendance')
        .select('created_at')
        .gte('created_at', sevenDaysAgo.toISOString());

      const trends = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const count = trendsData?.filter(a => a.created_at.startsWith(dateStr)).length || 0;
        return { date: dateStr, count };
      }).reverse();

      res.json({
        students: studentCount || 0,
        teachers: teacherCount || 0,
        sessions: sessionCount || 0,
        overallAttendance: Math.round(overallAttendance),
        trends
      });
    } catch (err: any) {
      console.error('Error fetching admin stats:', err);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // API: Student Leaderboard
  app.get("/api/student/leaderboard", async (req, res) => {
    try {
      const { data: students, error: studentError } = await supabase
        .from('users')
        .select('id, name')
        .eq('role', 'student');

      if (studentError) throw studentError;

      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('student_id');

      if (attendanceError) throw attendanceError;

      const leaderboard = (students || []).map(s => {
        const count = attendanceData?.filter(a => a.student_id === s.id).length || 0;
        return { id: s.id, name: s.name, count };
      }).sort((a, b) => b.count - a.count)
        .slice(0, 10);

      res.json(leaderboard);
    } catch (err: any) {
      console.error('Error fetching leaderboard:', err);
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
