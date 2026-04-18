import { createClient } from '@supabase/supabase-js';
import { VercelRequest, VercelResponse } from '@vercel/node';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { adminId } = req.query;

  if (!adminId) return res.status(400).json({ error: 'Admin ID required' });

  try {
    // 1. Authorization Check
    const { data: requester, error: requesterErr } = await supabase
      .from('users')
      .select('role')
      .eq('id', adminId)
      .single();

    if (requesterErr || requester?.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
    }

    // 2. Parallel Counts
    const [
      { count: studentCount },
      { count: teacherCount },
      { count: classCount },
      { count: sessionCount }
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'teacher'),
      supabase.from('classes').select('*', { count: 'exact', head: true }),
      supabase.from('attendance_sessions').select('*', { count: 'exact', head: true })
    ]);

    // 3. Attendance Trends (Last 7 days vs Previous 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setHours(0,0,0,0);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setHours(0,0,0,0);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    
    const { data: records, error: recordsErr } = await supabase
      .from('attendance_records')
      .select('created_at')
      .gte('created_at', fourteenDaysAgo.toISOString());

    if (recordsErr) throw recordsErr;

    // Process current week and previous week for growth calculation
    const currentWeekCount = records.filter(r => new Date(r.created_at) >= sevenDaysAgo).length;
    const previousWeekCount = records.filter(r => new Date(r.created_at) < sevenDaysAgo && new Date(r.created_at) >= fourteenDaysAgo).length;
    
    let growth = 0;
    if (previousWeekCount > 0) {
        growth = Math.round(((currentWeekCount - previousWeekCount) / previousWeekCount) * 100);
    } else if (currentWeekCount > 0) {
        growth = 100; // First week of activity
    }

    // Process trends for last 7 days only
    const trendMap = new Map();
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        trendMap.set(d.toISOString().split('T')[0], 0);
    }

    records.filter(r => new Date(r.created_at) >= sevenDaysAgo).forEach(r => {
        const date = r.created_at.split('T')[0];
        if (trendMap.has(date)) {
            trendMap.set(date, trendMap.get(date) + 1);
        }
    });

    const trends = Array.from(trendMap.entries())
        .map(([date, count]) => ({ date, count }));

    // 4. Critical Roster (Students < 75% attendance)
    // We fetch sessions counts per class and records count per student
    const [
      { data: sessionsByClass },
      { data: allEnrollments },
      { data: allRecords }
    ] = await Promise.all([
      supabase.from('attendance_sessions').select('id, class_id'),
      supabase.from('class_enrollments').select('student_id, class_id, users(name)'),
      supabase.from('attendance_records').select('student_id, session_id')
    ]);

    const criticalRoster: any[] = [];
    
    if (allEnrollments && sessionsByClass) {
      // Group sessions by class
      const classSessionMap = new Map();
      sessionsByClass.forEach(s => {
        if (!classSessionMap.has(s.class_id)) classSessionMap.set(s.class_id, []);
        classSessionMap.get(s.class_id).push(s.id);
      });

      // Group records by student
      const studentRecordMap = new Map();
      allRecords?.forEach(r => {
        if (!studentRecordMap.has(r.student_id)) studentRecordMap.set(r.student_id, new Set());
        studentRecordMap.get(r.student_id).add(r.session_id);
      });

      // Map enrollment to student name
      const studentNameMap = new Map();

      // Calculate per student
      const studentStats = new Map(); // studentId -> { present: 0, total: 0 }
      
      allEnrollments.forEach((e: any) => {
        const studentId = e.student_id;
        const classId = e.class_id;
        const userName = Array.isArray(e.users) ? e.users[0]?.name : e.users?.name;
        if (userName) studentNameMap.set(studentId, userName);

        const classSessions = classSessionMap.get(classId) || [];
        const totalSessions = classSessions.length;
        if (totalSessions === 0) return;

        if (!studentStats.has(studentId)) studentStats.set(studentId, { present: 0, total: 0 });
        const stats = studentStats.get(studentId);
        
        stats.total += totalSessions;
        
        const attendedSet = studentRecordMap.get(studentId);
        classSessions.forEach((sid: string) => {
          if (attendedSet?.has(sid)) stats.present++;
        });
      });

      studentStats.forEach((stats, studentId) => {
        const percentage = Math.round((stats.present / stats.total) * 100);
        if (percentage < 75) {
          criticalRoster.push({
            id: studentId,
            name: studentNameMap.get(studentId) || 'Unknown',
            attendance_percentage: percentage
          });
        }
      });
    }

    return res.status(200).json({
      counts: {
        students: studentCount || 0,
        teachers: teacherCount || 0,
        classes: classCount || 0,
        sessions: sessionCount || 0
      },
      trends,
      growth,
      totalWeeklyAttendance: currentWeekCount,
      criticalRoster: criticalRoster.sort((a,b) => a.attendance_percentage - b.attendance_percentage).slice(0, 10) // Top 10 most critical
    });
  } catch (error: any) {
    console.error('Stats API error:', error);
    return res.status(500).json({ error: error.message });
  }
}