const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function resetAllDevices() {
  console.log('Resetting all student device IDs...');
  
  // First check how many students have device IDs
  const { data: before, error: countErr } = await supabase
    .from('student_profiles')
    .select('id, device_id')
    .not('device_id', 'is', null);

  if (countErr) {
    console.error('Error checking profiles:', countErr.message);
    return;
  }

  console.log(`Found ${before.length} students with device IDs bound.`);

  // Reset all device IDs to NULL
  const { data, error } = await supabase
    .from('student_profiles')
    .update({ device_id: null })
    .not('device_id', 'is', null)
    .select('id');

  if (error) {
    console.error('Error resetting devices:', error.message);
    return;
  }

  console.log(`✅ Successfully reset ${data.length} student device IDs to NULL.`);
  console.log('All students will get new fingerprint-based device IDs on their next attendance mark.');
}

resetAllDevices();
