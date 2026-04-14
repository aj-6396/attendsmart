-- 1. Add Security Column for Device Locking
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS device_id TEXT;

-- 2. Clear old test data (ONLY Attendance, NOT Users)
-- TRUNCATE TABLE attendance_records CASCADE;
-- TRUNCATE TABLE attendance_sessions CASCADE;

-- 1. Create Classes Table
CREATE TABLE IF NOT EXISTS classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  join_code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
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

-- Classes: Viewable if you are a teacher of the class, a student enrolled, or an admin
CREATE POLICY "Classes viewable by related users" ON classes FOR SELECT USING (
  EXISTS (SELECT 1 FROM class_teachers WHERE class_id = id AND teacher_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM class_enrollments WHERE class_id = id AND student_id = auth.uid()) OR
  (auth.uid() = created_by) OR
  is_admin() OR is_teacher() -- Temporarily allow teachers to see classes to join them as co-teachers
);

CREATE POLICY "Teachers can create classes" ON classes FOR INSERT WITH CHECK (is_teacher() OR is_admin());

-- Class Teachers:
CREATE POLICY "Class teachers viewable by related" ON class_teachers FOR SELECT USING (true);
CREATE POLICY "Class teachers managed by creators" ON class_teachers FOR ALL USING (
  EXISTS (SELECT 1 FROM classes WHERE id = class_id AND created_by = auth.uid()) OR is_admin()
);

-- Class Enrollments:
CREATE POLICY "Enrollments viewable by specific" ON class_enrollments FOR SELECT USING (true);
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
