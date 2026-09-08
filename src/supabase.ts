import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jxsalktxlzbzxuwmripk.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4c2Fsa3R4bHpienh1d21yaXBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjU1NTQsImV4cCI6MjA5MDQ0MTU1NH0.h9UT3YJxinTm7uerPhAc3Ud7JoChruK2iVsX18fPHCQ';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase environment variables are missing. Please check your .env file and ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
