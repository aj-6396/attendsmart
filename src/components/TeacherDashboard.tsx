import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Users, Clock, MapPin, RefreshCw, CheckCircle2, XCircle, Download, BarChart3, History, Loader2, AlertCircle, Key, Search, X } from 'lucide-react';
import { getAveragedPosition } from '../lib/geo';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

interface Session {
  id: string;
  teacher_id: string;
  otp: string;
  expires_at: string;
  lat: number;
  lng: number;
  active: boolean;
  created_at: string;
}

interface Attendance {
  id: string;
  session_id: string;
  student_id: string;
  users: {
    name: string;
    student_profiles: {
      enrollment_no: string;
      exam_roll_no?: string;
      semester?: string;
      major_subject?: string;
    }[];
  };
  created_at: string;
}

interface StudentStats {
  id: string;
  name: string;
  enrollment_no: string;
  exam_roll_no?: string;
  semester?: string;
  major_subject?: string;
  total_sessions: number;
  attended_sessions: number;
  attendance_percentage: number;
}

export default function TeacherDashboard({ user, profile }: { user: any; profile: any }) {
  const [activeTab, setActiveTab] = useState<'session' | 'records'>('session');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [allStudents, setAllStudents] = useState<StudentStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [samplingProgress, setSamplingProgress] = useState<{ current: number; total: number } | null>(null);
  const [locationPermission, setLocationPermission] = useState<string | null>(null);

  useEffect(() => {
    // Check initial location permission status
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setLocationPermission(result.state);
        result.onchange = () => {
          setLocationPermission(result.state);
        };
      }).catch(err => console.error("Permission query error:", err));
    }
  }, []);

  const handleResetPassword = async (userId: string) => {
    if (!/^\d{6}$/.test(newPassword)) {
      setError('Password must be exactly 6 digits.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterId: user.id,
          targetUserId: userId,
          newPassword
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to reset password');

      setSuccess('Student password reset successfully!');
      setResettingUserId(null);
      setNewPassword('');
    } catch (err: any) {
      console.error('Error resetting password:', err);
      setError(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = allStudents.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.enrollment_no.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const fetchSessions = async () => {
      const { data, error } = await supabase
        .from('attendance_sessions')
        .select('*')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching sessions:', error);
      } else {
        setSessions(data || []);
        const active = data?.find(s => s.active && new Date(s.expires_at) > new Date());
        setActiveSession(active || null);
      }
    };

    fetchSessions();

    // Realtime subscription
    const channel = supabase
      .channel('sessions_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_sessions', filter: `teacher_id=eq.${user.id}` }, (payload) => {
        fetchSessions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  const fetchAttendance = useCallback(async () => {
    if (!activeSession) return;
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*, users(name, student_profiles(enrollment_no, exam_roll_no))')
      .eq('session_id', activeSession.id);

    if (error) console.error('Error fetching attendance:', error);
    else setAttendance(data as any || []);
  }, [activeSession]);

  useEffect(() => {
    if (activeSession) {
      fetchAttendance();

      const channel = supabase
        .channel('attendance_changes')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance_records', filter: `session_id=eq.${activeSession.id}` }, (payload) => {
          fetchAttendance();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setAttendance([]);
    }
  }, [activeSession, fetchAttendance]);

  useEffect(() => {
    if (activeTab === 'records') {
      fetchAllStudentStats();
    }
  }, [activeTab]);

  const fetchAllStudentStats = async () => {
    try {
      setLoading(true);
      // 1. Fetch all students with their profiles
      const { data: students, error: studentError } = await supabase
        .from('users')
        .select('id, name, student_profiles(enrollment_no, exam_roll_no)')
        .eq('role', 'student');

      if (studentError) throw studentError;

      // 2. Fetch all sessions for this teacher
      const { data: teacherSessions, error: sessionError } = await supabase
        .from('attendance_sessions')
        .select('id')
        .eq('teacher_id', user.id);

      if (sessionError) throw sessionError;
      const sessionIds = teacherSessions.map(s => s.id);

      // 3. Fetch all attendance records for these sessions
      const { data: records, error: recordError } = await supabase
        .from('attendance_records')
        .select('student_id, session_id')
        .in('session_id', sessionIds);

      if (recordError) throw recordError;

      // 4. Calculate stats
      const stats: StudentStats[] = students.map(student => {
        const studentRecords = records.filter(r => r.student_id === student.id);
        const attendedCount = studentRecords.length;
        const totalCount = sessionIds.length;
        const profile = (student.student_profiles as any)?.[0];
        return {
          id: student.id,
          name: student.name,
          enrollment_no: profile?.enrollment_no || 'N/A',
          exam_roll_no: profile?.exam_roll_no,
          semester: profile?.semester,
          major_subject: profile?.major_subject,
          total_sessions: totalCount,
          attended_sessions: attendedCount,
          attendance_percentage: totalCount > 0 ? (attendedCount / totalCount) * 100 : 0
        };
      });

      setAllStudents(stats.sort((a, b) => b.attendance_percentage - a.attendance_percentage));
    } catch (err) {
      console.error('Error fetching student stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const createSession = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const pos = await getAveragedPosition(3, (current, total) => {
        setSamplingProgress({ current, total });
      });
      setSamplingProgress(null);
      setLocationAccuracy(pos.accuracy);
      
      if (pos.accuracy > 150) {
        setError(`Your GPS accuracy is very poor (${Math.round(pos.accuracy)}m). Please try to move to a window or open area for better results.`);
      }
      
      const response = await fetch('/api/sessions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId: user.id,
          lat: pos.latitude,
          lng: pos.longitude,
          accuracy: pos.accuracy
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create session');

      setActiveSession(data);
    } catch (err: any) {
      console.error('Error creating session:', err);
      setSamplingProgress(null);
      
      if (err && err.code === 1) {
        setError('Location access denied. Please enable location services in your browser/device settings.');
      } else if (err && err.code === 2) {
        setError('Location unavailable. Please check your GPS signal.');
      } else if (err && err.code === 3) {
        setError('Location request timed out. Please try again.');
      } else {
        setError(err.message || 'Failed to create session. Please enable location services.');
      }
    } finally {
      setLoading(false);
    }
  };

  const endSession = async (sessionId: string) => {
    try {
      await supabase
        .from('attendance_sessions')
        .update({ active: false })
        .eq('id', sessionId);
    } catch (err) {
      console.error('Error ending session:', err);
    }
  };

  const manualMarkAttendance = async (studentId: string) => {
    if (!activeSession) return;
    try {
      setLoading(true);
      const response = await fetch('/api/attendance/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId: user.id,
          studentId,
          sessionId: activeSession.id
        })
      });
      if (!response.ok) throw new Error('Failed to mark manually');
      setSuccess('Student marked present manually.');
      // Refresh stats and current attendance list
      fetchAllStudentStats();
      fetchAttendance();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const exportAttendance = () => {
    if (attendance.length === 0) return;
    
    const csvContent = [
      ['Student Name', 'Enrollment No', 'Exam Roll No', 'Timestamp'],
      ...attendance.map(a => {
        const studentProfile = a.users.student_profiles?.[0];
        return [
          a.users.name,
          studentProfile?.enrollment_no || 'N/A',
          studentProfile?.exam_roll_no || 'N/A',
          format(new Date(a.created_at), 'yyyy-MM-dd HH:mm:ss')
        ];
      })
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `attendance_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      {/* Status Messages */}
      {(error || success) && (
        <div className="fixed top-20 right-4 z-[60] max-w-sm w-full animate-in slide-in-from-right">
          {error && (
            <div className="alert alert--error">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto text-[--color-text-secondary] hover:text-[--color-text-primary]">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {success && (
            <div className="glass-card--success border-l-4 p-4 flex items-center gap-3 mt-2">
              <CheckCircle2 className="w-5 h-5 text-[--color-success] flex-shrink-0" />
              <p className="text-sm text-[--color-success]">{success}</p>
              <button onClick={() => setSuccess(null)} className="ml-auto text-[--color-text-secondary] hover:text-[--color-text-primary]">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('session')}
          className={cn(
            "px-6 py-2 text-sm font-bold rounded-[12px] transition-all flex items-center gap-2",
            activeTab === 'session' 
              ? "glass-card bg-white/[0.15] text-[--color-primary]" 
              : "text-[--color-text-secondary] hover:text-[--color-text-primary]"
          )}
        >
          <Clock className="w-4 h-4" />
          Live Session
        </button>
        <button
          onClick={() => setActiveTab('records')}
          className={cn(
            "px-6 py-2 text-sm font-bold rounded-[12px] transition-all flex items-center gap-2",
            activeTab === 'records' 
              ? "glass-card bg-white/[0.15] text-[--color-primary]" 
              : "text-[--color-text-secondary] hover:text-[--color-text-primary]"
          )}
        >
          <BarChart3 className="w-4 h-4" />
          Student Records
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'session' ? (
          <motion.div
            key="session-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-[--color-text-primary] flex items-center gap-2">
                  <Clock className="w-6 h-6 text-[--color-primary]" />
                  Active Session
                </h2>
                {!activeSession && (
                  <button
                    onClick={createSession}
                    disabled={loading}
                    className="btn-gradient disabled:opacity-50 px-4 py-2 flex items-center gap-2"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {samplingProgress ? `Sampling ${samplingProgress.current}/${samplingProgress.total}...` : 'Starting...'}
                      </div>
                    ) : (
                      <>
                        <Plus className="w-5 h-5" />
                        Start New Session
                      </>
                    )}
                  </button>
                )}
              </div>

              {locationPermission === 'denied' && (
                <div className="alert alert--error mb-6">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold">Location Access Denied</h4>
                    <p className="text-xs mt-1">
                      You have denied location access. Please enable location services for this app in your device settings or browser settings to start a session.
                    </p>
                  </div>
                </div>
              )}

              {locationPermission === 'prompt' && (
                <div className="alert alert--warning mb-6">
                  <MapPin className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold">Location Access Required</h4>
                    <p className="text-xs mt-1 mb-2">
                      We need your location to set the classroom boundary for students.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.geolocation.getCurrentPosition(
                          () => setLocationPermission('granted'),
                          (err) => {
                            console.error("Geolocation error:", err);
                            if (err.code === err.PERMISSION_DENIED) {
                              setLocationPermission('denied');
                            }
                          },
                          { enableHighAccuracy: true }
                        );
                      }}
                      className="text-xs font-bold bg-[--color-warning]/30 text-[--color-warning] px-3 py-1.5 rounded-lg hover:bg-[--color-warning]/50 transition-colors"
                    >
                      Grant Permission
                    </button>
                  </div>
                </div>
              )}

              <AnimatePresence mode="wait">
                {activeSession ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="glass-card overflow-hidden"
                  >
                    <div className="bg-gradient-to-r from-[--color-primary] to-[--color-secondary] p-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div>
                        <p className="text-white/80 text-sm font-medium uppercase tracking-wider mb-1">Current OTP</p>
                        <h3 className="otp-display">{activeSession.otp}</h3>
                      </div>
                      <div className="flex flex-wrap gap-4">
                        <div className="icon-box--md icon-box--primary">
                          <MapPin className="w-5 h-5" />
                          <div>
                            <p className="text-[10px] text-white/80 uppercase font-bold">Accuracy</p>
                            <p className="font-mono font-bold text-white">{locationAccuracy ? `${Math.round(locationAccuracy)}m` : 'N/A'}</p>
                          </div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 flex items-center gap-3">
                          <Clock className="w-5 h-5 text-indigo-200" />
                          <div>
                            <p className="text-[10px] text-slate-700 uppercase font-bold">Expires At</p>
                            <p className="font-mono font-bold text-slate-700">{format(new Date(activeSession.expires_at), 'HH:mm')}</p>
                          </div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 flex items-center gap-3">
                          <Users className="w-5 h-5 text-indigo-200" />
                          <div>
                            <p className="text-[10px] text-slate-700 uppercase font-bold">Present</p>
                            <p className="font-mono font-bold text-slate-700">{attendance.length}</p>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => endSession(activeSession.id)}
                        className="bg-white text-indigo-600 hover:bg-indigo-50 px-6 py-3 rounded-xl font-bold transition-colors shadow-lg"
                      >
                        End Session
                      </button>
                    </div>

                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-bold text-slate-900">Live Attendance List</h4>
                        <button 
                          onClick={exportAttendance}
                          disabled={attendance.length === 0}
                          className="text-indigo-600 hover:text-indigo-700 flex items-center gap-2 text-sm font-semibold disabled:opacity-50"
                        >
                          <Download className="w-4 h-4" />
                          Export CSV
                        </button>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="text-slate-400 text-xs uppercase font-bold border-b border-slate-100">
                              <th className="pb-3 pl-2">Student</th>
                              <th className="pb-3">Enrollment No</th>
                              <th className="pb-3">Exam Roll No</th>
                              <th className="pb-3 text-right pr-2">Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {attendance.length > 0 ? (
                              attendance.map((record) => (
                                <motion.tr 
                                  key={record.id}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  className="group hover:bg-slate-50 transition-colors"
                                >
                                  <td className="py-3 pl-2 font-medium text-slate-900">{record.users.name}</td>
                                  <td className="py-3 text-slate-500 text-sm">{(record.users.student_profiles as any)?.[0]?.enrollment_no || 'N/A'}</td>
                                  <td className="py-3 text-slate-500 text-sm">{(record.users.student_profiles as any)?.[0]?.exam_roll_no || 'N/A'}</td>
                                  <td className="py-3 text-right pr-2 text-slate-400 text-sm font-mono">
                                    {format(new Date(record.created_at), 'HH:mm:ss')}
                                  </td>
                                </motion.tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                                  Waiting for students to join...
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Users className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">No Active Session</h3>
                    <p className="text-slate-500 mb-6 max-w-xs mx-auto">Start a new session to generate an OTP and allow students to mark their attendance.</p>
                    {error && (
                      <div className="mb-6 p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2 justify-center max-w-md mx-auto">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                      </div>
                    )}
                  </div>
                )}
              </AnimatePresence>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2 mb-6">
                <History className="w-6 h-6 text-indigo-600" />
                Recent History
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sessions.filter(s => !s.active || new Date(s.expires_at) < new Date()).slice(0, 6).map((session) => (
                  <div key={session.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {format(new Date(session.created_at), 'MMM dd, yyyy')}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-bold uppercase">
                        Expired
                      </span>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-slate-500 text-xs mb-1">OTP Used</p>
                        <p className="text-xl font-bold text-slate-900 font-mono">{session.otp}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-500 text-xs mb-1">Time</p>
                        <p className="text-sm font-medium text-slate-700">{format(new Date(session.created_at), 'HH:mm')}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </motion.div>
        ) : (
          <motion.div
            key="records-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Student Attendance Overview</h3>
                  <p className="text-slate-500 text-xs mt-1">
                    {activeSession 
                      ? `Live Session Active: ${activeSession.otp}` 
                      : "No active session. Start one to mark manual attendance."}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search students..."
                      className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-full sm:w-48"
                    />
                  </div>
                  <button 
                    onClick={fetchAllStudentStats}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Refresh Data"
                  >
                    <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
                  </button>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-slate-400 text-xs uppercase font-bold border-b border-slate-100">
                      <th className="p-6">Student Details</th>
                      <th className="p-6">Enrollment No</th>
                      <th className="p-6">Semester</th>
                      <th className="p-6">Major</th>
                      <th className="p-6">Attendance</th>
                      <th className="p-6 text-right">Percentage</th>
                      <th className="p-6 text-right">Actions {activeSession && <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full uppercase tracking-wider">Live Session Active</span>}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredStudents.map((student) => (
                      <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-6">
                          <div className="font-bold text-slate-900">{student.name}</div>
                        </td>
                        <td className="p-6 text-slate-600 font-mono text-sm">{student.enrollment_no}</td>
                        <td className="p-6 text-slate-600 text-sm">{student.semester || 'N/A'}</td>
                        <td className="p-6 text-slate-600 text-sm">{student.major_subject || 'N/A'}</td>
                        <td className="p-6">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-indigo-600">{student.attended_sessions}</span>
                            <span className="text-xs text-slate-400">/ {student.total_sessions} sessions</span>
                          </div>
                        </td>
                        <td className="p-6 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                              <div 
                                className={cn(
                                  "h-full rounded-full transition-all duration-500",
                                  student.attendance_percentage >= 75 ? "bg-emerald-500" : 
                                  student.attendance_percentage >= 50 ? "bg-amber-500" : "bg-red-500"
                                )}
                                style={{ width: `${student.attendance_percentage}%` }}
                              />
                            </div>
                            <span className={cn(
                              "text-sm font-black min-w-[3rem]",
                              student.attendance_percentage >= 75 ? "text-emerald-600" : 
                              student.attendance_percentage >= 50 ? "text-amber-600" : "text-red-600"
                            )}>
                              {Math.round(student.attendance_percentage)}%
                            </span>
                          </div>
                        </td>
                        <td className="p-6 text-right flex items-center justify-end gap-2">
                          {activeSession && !attendance.find(a => a.student_id === student.id) && (
                            <button 
                              onClick={() => manualMarkAttendance(student.id)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-all border border-emerald-200 text-xs font-bold"
                              title="Mark Present Manually"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Mark Present
                            </button>
                          )}
                          <button 
                            onClick={() => setResettingUserId(student.id)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Reset Student Password"
                          >
                            <Key className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredStudents.length === 0 && !loading && (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-slate-400 italic">
                          No student records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Password Reset Modal */}
            <AnimatePresence>
              {resettingUserId && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setResettingUserId(null)}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                  />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-8"
                  >
                    <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-6">
                      <Key className="w-6 h-6 text-indigo-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Reset Student Password</h3>
                    <p className="text-slate-600 text-sm mb-6">
                      Enter a new password for this student. They will be able to sign in with this password immediately.
                    </p>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">New Password (6-digit PIN)</label>
                        <input 
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                          placeholder="e.g. 123456"
                          pattern="\d{6}"
                          maxLength={6}
                          autoFocus
                        />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button 
                          onClick={() => setResettingUserId(null)}
                          className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={() => handleResetPassword(resettingUserId)}
                          disabled={loading || !/^\d{6}$/.test(newPassword)}
                          className="flex-1 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:bg-indigo-400 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                        >
                          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reset Password'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
