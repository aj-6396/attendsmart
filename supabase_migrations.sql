-- 1. Helper functions for RLS (Required for the policies below)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_teacher()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'teacher'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Add Security Column for Device Locking
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS device_id TEXT;
CREATE INDEX IF NOT EXISTS idx_attendance_records_device_id ON attendance_records(device_id);

-- 3. Clear old test data (ONLY Attendance, NOT Users)
-- TRUNCATE TABLE attendance_records CASCADE;
-- TRUNCATE TABLE attendance_sessions CASCADE;

-- 1. Create Classes Table
CREATE TABLE IF NOT EXISTS classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  join_code TEXT UNIQUE NOT NULL,
  created_by UUID DEFAULT auth.uid() REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Class Teachers (Co-teachers) Table
CREATE TABLE IF NOT EXISTS class_teachers (
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (class_id, teacher_id)
);

-- 3. Create Class Enrollments Table (Students)
CREATE TABLE IF NOT EXISTS class_enrollments (
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (class_id, student_id)
);

-- 4. Update attendance_sessions to link to a class
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE CASCADE;

-- Default all existing sessions to allow them to be orphaned or link them to a dummy class later
-- But the schema now requires class_id for NEW sessions to be logical. We won't make it NOT NULL to preserve backward compatibility during transition.

-- 5. Enable Row Level Security (RLS)
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;

-- 6. Define Policies

DROP POLICY IF EXISTS "Classes viewable by related users" ON classes;
CREATE POLICY "Classes viewable by related users" ON classes FOR SELECT USING (
  auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Teachers can create classes" ON classes;
CREATE POLICY "Teachers can create classes" ON classes FOR INSERT WITH CHECK (is_teacher() OR is_admin());

DROP POLICY IF EXISTS "Classes managed by related creators" ON classes;
CREATE POLICY "Classes managed by related creators" ON classes FOR DELETE USING (
  (auth.uid() = created_by) OR is_admin()
);

-- Class Teachers:
DROP POLICY IF EXISTS "Class teachers viewable by related" ON class_teachers;
DROP POLICY IF EXISTS "Class teachers viewable by all" ON class_teachers;
CREATE POLICY "Class teachers viewable by all" ON class_teachers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Class teachers managed by creators" ON class_teachers;
DROP POLICY IF EXISTS "Class teachers managed by creators - insert" ON class_teachers;
DROP POLICY IF EXISTS "Class teachers managed by creators - update" ON class_teachers;
DROP POLICY IF EXISTS "Class teachers managed by creators - delete" ON class_teachers;

CREATE POLICY "Class teachers managed by creators - insert" ON class_teachers FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM classes WHERE id = class_id AND created_by = auth.uid()) OR is_admin()
);
CREATE POLICY "Class teachers managed by creators - update" ON class_teachers FOR UPDATE USING (
  EXISTS (SELECT 1 FROM classes WHERE id = class_id AND created_by = auth.uid()) OR is_admin()
);
CREATE POLICY "Class teachers managed by creators - delete" ON class_teachers FOR DELETE USING (
  EXISTS (SELECT 1 FROM classes WHERE id = class_id AND created_by = auth.uid()) OR is_admin()
);

-- Class Enrollments:
DROP POLICY IF EXISTS "Enrollments viewable by specific" ON class_enrollments;
CREATE POLICY "Enrollments viewable by specific" ON class_enrollments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Students can enroll themselves" ON class_enrollments;
CREATE POLICY "Students can enroll themselves" ON class_enrollments FOR INSERT WITH CHECK (
  auth.uid() = student_id OR is_admin()
);

-- Add class_id to realtime publication if needed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'classes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE classes;
  END IF;
END $$;
