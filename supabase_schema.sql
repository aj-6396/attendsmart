-- 1. Create Users table (Core Identity)
-- NOTE: All passwords (PINs) are enforced as exactly 6 digits (numeric only).
CREATE TABLE users (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT CHECK (role IN ('teacher', 'student', 'admin')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Student Profiles table
CREATE TABLE student_profiles (
  id UUID REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
  enrollment_no TEXT UNIQUE NOT NULL,
  exam_roll_no TEXT UNIQUE,
  course TEXT NOT NULL,
  semester TEXT NOT NULL,
  major_subject TEXT NOT NULL,
  batch TEXT NOT NULL,
  section TEXT,
  device_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Teacher Profiles table
CREATE TABLE teacher_profiles (
  id UUID REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
  employee_id TEXT UNIQUE NOT NULL,
  department TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Attendance Sessions table
CREATE TABLE attendance_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  otp TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION DEFAULT 20,
  section TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create Attendance Records table
CREATE TABLE attendance_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES attendance_sessions(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  manual BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, student_id)
);

-- 6. Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is teacher
CREATE OR REPLACE FUNCTION is_teacher()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'teacher'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Users: Users can read all users (to see names), but only update their own. Admins can do everything.
CREATE POLICY "Public users are viewable by everyone" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id OR is_admin());
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id OR is_admin());
CREATE POLICY "Admins can delete users" ON users FOR DELETE USING (is_admin());

-- Student Profiles: Everyone can see, only owner or admin can update.
CREATE POLICY "Student profiles are viewable by everyone" ON student_profiles FOR SELECT USING (true);
CREATE POLICY "Students can update own profile" ON student_profiles FOR UPDATE USING (auth.uid() = id OR is_admin());
CREATE POLICY "Students can insert own profile" ON student_profiles FOR INSERT WITH CHECK (auth.uid() = id OR is_admin());

-- Teacher Profiles: Everyone can see, only owner or admin can update.
CREATE POLICY "Teacher profiles are viewable by everyone" ON teacher_profiles FOR SELECT USING (true);
CREATE POLICY "Teachers can update own profile" ON teacher_profiles FOR UPDATE USING (auth.uid() = id OR is_admin());
CREATE POLICY "Teachers can insert own profile" ON teacher_profiles FOR INSERT WITH CHECK (auth.uid() = id OR is_admin());

-- Sessions: Everyone can read active sessions, only teachers can create/manage. Admins can do everything.
CREATE POLICY "Sessions are viewable by everyone" ON attendance_sessions FOR SELECT USING (true);
CREATE POLICY "Teachers can create sessions" ON attendance_sessions FOR INSERT WITH CHECK (
  is_teacher() OR is_admin()
);
CREATE POLICY "Teachers can update own sessions" ON attendance_sessions FOR UPDATE USING (teacher_id = auth.uid() OR is_admin());
CREATE POLICY "Admins can delete sessions" ON attendance_sessions FOR DELETE USING (is_admin());

-- Attendance: Students can read their own, teachers can read all. Admins can do everything.
CREATE POLICY "Students can view own attendance" ON attendance_records FOR SELECT USING (student_id = auth.uid() OR is_admin());
CREATE POLICY "Teachers can view all attendance" ON attendance_records FOR SELECT USING (
  is_teacher() OR is_admin()
);
CREATE POLICY "System can insert attendance" ON attendance_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can delete attendance" ON attendance_records FOR DELETE USING (is_admin());

-- 8. Realtime
DO $$
BEGIN
  -- Add attendance_sessions if not already present
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'attendance_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE attendance_sessions;
  END IF;

  -- Add attendance_records if not already present
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'attendance_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE attendance_records;
  END IF;
END $$;

-- ===============================================================
-- ADMIN SETUP INSTRUCTIONS
-- ===============================================================
-- 
-- To create your first admin user:
-- 1. Sign up as a student or teacher in the app.
-- 2. Go to the Supabase SQL Editor.
-- 3. Run the following command (replace 'YOUR_USER_ID' with the ID from auth.users):
-- 
-- UPDATE public.users SET role = 'admin' WHERE id = 'YOUR_USER_ID';
-- 
-- This will give that user full administrative privileges.
