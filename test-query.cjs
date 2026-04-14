const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
    .from('class_enrollments')
    .select(`
      student_id,
      users (
        id,
        name,
        student_profiles (
          enrollment_no,
          exam_roll_no,
          semester,
          major_subject,
          course
        )
      )
    `)
    .limit(5);
    
  console.log('Error:', error);
  console.log('Data:', JSON.stringify(data, null, 2));
}

test();
