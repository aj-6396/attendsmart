const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: enrollmentData } = await supabase
    .from('class_enrollments')
    .select(`
      student_id,
      users:users(
        id,
        name,
        student_profiles(
          enrollment_no,
          exam_roll_no
        )
      )
    `)
    .limit(2);

  console.log("Raw enrollmentData:");
  console.log(JSON.stringify(enrollmentData, null, 2));

  if (!enrollmentData) return;

  const rows = enrollmentData.map((e) => {
    const student = Array.isArray(e.users) ? e.users[0] : e.users;
    const profile = Array.isArray(student?.student_profiles) 
      ? student?.student_profiles[0] 
      : student?.student_profiles;

    return {
      student_name: student?.name || 'Unknown',
      enrollment_no: profile?.enrollment_no || 'N/A',
      exam_roll_no: profile?.exam_roll_no || 'N/A'
    };
  });

  console.log("Mapped Rows:");
  console.log(JSON.stringify(rows, null, 2));
}

test();
