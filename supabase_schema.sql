-- ===============================================================
-- CLASS MARK: UNIFIED INSTITUTIONAL SCHEMA (v2.0)
-- Optimized for high-volume attendance at BHU scale
-- ===============================================================

-- 1. Core Identity & User Management
CREATE TABLE IF NOT EXISTS users (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT CHECK (role IN ('teacher', 'student', 'admin')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. Student Profiles (Extended Identity)
CREATE TABLE IF NOT EXISTS student_profiles (
  id UUID REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
  enrollment_no TEXT UNIQUE NOT NULL,
  exam_roll_no TEXT UNIQUE,
  course TEXT NOT NULL,
  semester TEXT NOT NULL,
  major_subject TEXT NOT NULL,
  batch TEXT NOT NULL,
  section TEXT,
  device_id TEXT, -- For Hardware Locking
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_student_profiles_enrollment ON student_profiles(enrollment_no);

-- 3. Teacher Profiles
CREATE TABLE IF NOT EXISTS teacher_profiles (
  id UUID REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
  employee_id TEXT UNIQUE NOT NULL,
  department TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Institutional Structure (Classes & Management)
CREATE TABLE IF NOT EXISTS classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  join_code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_classes_join_code ON classes(join_code);
CREATE INDEX IF NOT EXISTS idx_classes_created_by ON classes(created_by);

-- Co-teachers junction
CREATE TABLE IF NOT EXISTS class_teachers (
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (class_id, teacher_id)
);
CREATE INDEX IF NOT EXISTS idx_class_teachers_teacher ON class_teachers(teacher_id);

-- Student enrollments junction
CREATE TABLE IF NOT EXISTS class_enrollments (
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (class_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_student ON class_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_class ON class_enrollments(class_id);

-- 5. Attendance Architecture
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE, -- Linked to the specific subject/cohort
  otp TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION DEFAULT 20,
  section TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_class_id ON attendance_sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_sessions_teacher_id ON attendance_sessions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON attendance_sessions(active) WHERE active = true;

CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES attendance_sessions(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  manual BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student ON attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_session ON attendance_records(session_id);

-- 6. Row Level Security (RLS) Configuration
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- 7. Security Helpers
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_teacher() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'teacher');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Policies
-- (Simplified for readability, unified from existing logic)

-- Users/Profiles
CREATE POLICY "Profiles viewable by authenticated" ON users FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can edit own" ON users FOR UPDATE USING (auth.uid() = id OR is_admin());

CREATE POLICY "Student profiles readable" ON student_profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Teachers readable" ON teacher_profiles FOR SELECT USING (auth.role() = 'authenticated');

-- Classes
CREATE POLICY "Classes viewable by all students/teachers" ON classes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Teachers can create classes" ON classes FOR INSERT WITH CHECK (is_teacher() OR is_admin());
CREATE POLICY "Admins/Creators can delete" ON classes FOR DELETE USING (auth.uid() = created_by OR is_admin());

-- Enrollments
CREATE POLICY "Enrollments readable by all" ON class_enrollments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Students can self-enroll" ON class_enrollments FOR INSERT WITH CHECK (auth.uid() = student_id OR is_admin());

-- Attendance
CREATE POLICY "Sessions viewable" ON attendance_sessions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Teachers manage sessions" ON attendance_sessions FOR ALL USING (teacher_id = auth.uid() OR is_admin());

CREATE POLICY "Attendance viewable by teacher/owner" ON attendance_records FOR SELECT USING (
  student_id = auth.uid() OR is_teacher() OR is_admin()
);
CREATE POLICY "Students can mark attendance" ON attendance_records FOR INSERT WITH CHECK (
  auth.uid() = student_id OR is_admin()
);

-- 9. Realtime WAL Subscriptions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'attendance_sessions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE attendance_sessions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'attendance_records') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE attendance_records;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'classes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE classes;
  END IF;
END $$;
