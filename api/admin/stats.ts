import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: any, res: any) {
  // Allow GET requests for fetching stats
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { count: studentCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student');
    const { count: teacherCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'teacher');
    const { count: sessionCount } = await supabase.from('attendance_sessions').select('*', { count: 'exact', head: true });
    const { count: attendanceCount } = await supabase.from('attendance').select('*', { count: 'exact', head: true });

    const overallAttendance = sessionCount && studentCount ? (attendanceCount || 0) / (sessionCount * studentCount) * 100 : 0;

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

    return res.status(200).json({
      students: studentCount || 0,
      teachers: teacherCount || 0,
      sessions: sessionCount || 0,
      overallAttendance: Math.round(overallAttendance),
      trends
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch stats" });
  }
}