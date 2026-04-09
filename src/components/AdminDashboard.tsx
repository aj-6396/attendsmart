import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { motion, AnimatePresence } from 'motion/react';
import { UserPlus, Users, ShieldCheck, Loader2, AlertCircle, CheckCircle2, Key, Search, X, BarChart3, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

export default function AdminDashboard({ user, profile }: { user: any; profile: any }) {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [teacherName, setTeacherName] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [teacherEnrollmentNo, setTeacherEnrollmentNo] = useState('');

  const [students, setStudents] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [lowAttendanceStudents, setLowAttendanceStudents] = useState<any[]>([]);

  useEffect(() => {
    fetchTeachers();
    fetchStudents();
    fetchStats();
    fetchLowAttendance();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      if (res.ok) setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchLowAttendance = async () => {
    try {
      // Fetch all students and their attendance sessions
      const { data: studentsData, error: studentError } = await supabase
        .from('users')
        .select('*, student_profiles(*)')
        .eq('role', 'student');

      if (studentError) throw studentError;

      const { data: sessions, count: totalSessions } = await supabase
        .from('attendance_sessions')
        .select('*', { count: 'exact', head: true });

      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('student_id');

      if (!totalSessions) return;

      const lowAttendance = (studentsData || []).map(s => {
        const attendedCount = attendanceData?.filter(a => a.student_id === s.id).length || 0;
        const percentage = Math.round((attendedCount / totalSessions) * 100);
        return { ...s, attendance_percentage: percentage };
      }).filter(s => s.attendance_percentage < 75)
        .sort((a, b) => a.attendance_percentage - b.attendance_percentage);

      setLowAttendanceStudents(lowAttendance);
    } catch (err) {
      console.error('Error fetching low attendance:', err);
    }
  };

  const fetchTeachers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*, teacher_profiles(*)')
      .eq('role', 'teacher')
      .order('name');

    if (error) console.error('Error fetching teachers:', error);
    else setTeachers(data || []);
  };

  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*, student_profiles(*)')
      .eq('role', 'student')
      .order('name');

    if (error) console.error('Error fetching students:', error);
    else setStudents(data || []);
  };

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

      setSuccess('Password reset successfully!');
      setResettingUserId(null);
      setNewPassword('');
    } catch (err: any) {
      console.error('Error resetting password:', err);
      setError(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.student_profiles?.[0]?.enrollment_no.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherName || !teacherEmail || !teacherPassword || !teacherEnrollmentNo) return;

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/admin/create-teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: user.id,
          teacherName,
          teacherEmail,
          teacherPassword,
          teacherEnrollmentNo
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create teacher');

      setSuccess(`Teacher ${teacherName} created successfully!`);
      setTeacherName('');
      setTeacherEmail('');
      setTeacherPassword('');
      setTeacherEnrollmentNo('');
      fetchTeachers();
    } catch (err: any) {
      console.error('Error creating teacher:', err);
      setError(err.message || 'Failed to create teacher.');
    } finally {
      setLoading(false);
    }
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

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Students', value: stats?.students || 0, icon: Users, color: 'icon-box--primary', trend: '+12%' },
          { label: 'Total Teachers', value: stats?.teachers || 0, icon: ShieldCheck, color: 'icon-box--accent', trend: '+2' },
          { label: 'Total Sessions', value: stats?.sessions || 0, icon: Calendar, color: 'icon-box--success', trend: '+45' },
          { label: 'Overall Attendance', value: `${stats?.overallAttendance || 0}%`, icon: TrendingUp, color: 'icon-box--primary', trend: '-2%' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={cn("icon-box icon-box--md", stat.color)}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <div className={cn(
                "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full",
                stat.trend.startsWith('+') ? "bg-[rgba(0,212,170,0.15)] text-[--color-success]" : "bg-[rgba(255,77,109,0.15)] text-[--color-error]"
              )}>
                {stat.trend.startsWith('+') ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {stat.trend}
              </div>
            </div>
            <p className="text-[--color-text-secondary] text-sm font-medium">{stat.label}</p>
            <h3 className="text-2xl font-black text-[--color-text-primary] mt-1">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 glass-card">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-bold text-[--color-text-primary]">Attendance Trends</h2>
              <p className="text-[--color-text-secondary] text-sm">Daily attendance count for the last 7 days</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 glass-card rounded-lg">
              <TrendingUp className="w-4 h-4 text-[--color-primary]" />
              <span className="text-xs font-bold text-[--color-text-secondary]">Live Updates</span>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.trends || []}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4FACFE" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#4FACFE" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(25, 118, 210, 0.2)" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#3949AB' }}
                  tickFormatter={(str) => format(new Date(str), 'MMM d')}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#3949AB' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '12px', border: '1px solid rgba(25, 118, 210, 0.2)', color: '#1A237E' }}
                  labelStyle={{ fontWeight: 'bold', marginBottom: '4px', color: '#1A237E' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#4FACFE" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorCount)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="glass-card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-[--color-text-primary]">Critical Alerts</h2>
            <span className="badge badge--error">Low Attendance</span>
          </div>
          <div className="space-y-4 max-h-[320px] overflow-y-auto pr-2">
            {lowAttendanceStudents.length > 0 ? (
              lowAttendanceStudents.map((s, i) => (
                <div key={i} className="glass-card rounded-[14px] flex items-center justify-between group hover:bg-white/[0.12] transition-all">
                  <div className="flex items-center gap-3">
                    <div className="student-avatar bg-gradient-to-br from-[--color-error] to-[--color-warning]">
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[--color-text-primary] leading-none">{s.name}</p>
                      <p className="text-[10px] text-[--color-text-secondary] mt-1">{s.student_profiles?.[0]?.enrollment_no}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-[--color-error]">{s.attendance_percentage}%</p>
                    <p className="text-[10px] text-[--color-text-secondary] uppercase font-bold tracking-tighter">Attendance</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <div className="icon-box--lg icon-box--success mx-auto mb-4">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <p className="text-sm text-[--color-text-secondary]">All students are above 75%!</p>
              </div>
            )}
          </div>
          <button className="w-full mt-6 py-3 text-xs font-bold text-[--color-primary] hover:bg-white/[0.08] rounded-[12px] transition-all border border-[--color-glass-border]">
            View All Reports
          </button>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Create Teacher Form */}
        <section className="lg:col-span-1">
          <div className="glass-card">
            <h2 className="text-xl font-bold text-[--color-text-primary] flex items-center gap-2 mb-6">
              <UserPlus className="w-5 h-5 text-[--color-primary]" />
              Add New Teacher
            </h2>

            <form onSubmit={handleCreateTeacher} className="space-y-4">
              <div className="field-group">
                <label className="field-label">Full Name</label>
                <input
                  type="text"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  className="field-input"
                  placeholder="Prof. John Doe"
                  required
                />
              </div>
              <div className="field-group">
                <label className="field-label">Teacher Email</label>
                <input
                  type="email"
                  value={teacherEmail}
                  onChange={(e) => setTeacherEmail(e.target.value)}
                  className="field-input"
                  placeholder="teacher@college.com"
                  required
                />
              </div>
              <div className="field-group">
                <label className="field-label">Teacher ID / Enrollment No</label>
                <input
                  type="text"
                  value={teacherEnrollmentNo}
                  onChange={(e) => setTeacherEnrollmentNo(e.target.value)}
                  className="field-input"
                  placeholder="TCH001"
                  required
                />
              </div>
              <div className="field-group">
                <label className="field-label">Password</label>
                <input
                  type="password"
                  value={teacherPassword}
                  onChange={(e) => setTeacherPassword(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="field-input"
                  placeholder="6-digit PIN"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-gradient disabled:opacity-50 w-full"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
                Create Teacher Account
              </button>
            </form>
          </div>
        </section>

        {/* Teachers List */}
        <section className="lg:col-span-2">
          <div className="glass-card">
            <h2 className="text-xl font-bold text-[--color-text-primary] flex items-center gap-2 mb-6">
              <Users className="w-5 h-5 text-[--color-primary]" />
              Existing Teachers
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[--color-text-secondary] text-xs uppercase font-bold border-b border-[--color-glass-border]">
                    <th className="pb-3 pl-2">Name</th>
                    <th className="pb-3">Teacher ID</th>
                    <th className="pb-3 text-right pr-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[--color-glass-border]">
                  {teachers.length > 0 ? (
                    teachers.map((t) => (
                      <tr key={t.id} className="group hover:bg-white/[0.05] transition-colors">
                        <td className="py-4 pl-2">
                          <div className="flex items-center gap-3">
                            <div className="student-avatar bg-gradient-to-br from-[--color-primary] to-[--color-accent]">
                              {t.name.charAt(0)}
                            </div>
                            <span className="font-medium text-[--color-text-primary]">{t.name}</span>
                          </div>
                        </td>
                        <td className="py-4 text-[--color-text-secondary] font-mono text-sm">
                          {t.teacher_profiles?.[0]?.employee_id || 'N/A'}
                        </td>
                        <td className="py-4 text-right pr-2">
                          <button 
                            onClick={() => setResettingUserId(t.id)}
                            className="icon-btn hover:bg-white/[0.12]"
                            title="Reset Password"
                          >
                            <Key className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-[--color-text-secondary] italic">
                        No teachers found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {/* Student Management */}
      <section className="glass-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-xl font-bold text-[--color-text-primary] flex items-center gap-2">
            <Users className="w-5 h-5 text-[--color-primary]" />
            Manage Students
          </h2>
          <div className="relative">
            <Search className="w-4 h-4 text-[--color-text-secondary] absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or enrollment..."
              className="field-input pl-10"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[--color-text-secondary] text-xs uppercase font-bold border-b border-[--color-glass-border]">
                <th className="pb-3 pl-2">Name</th>
                <th className="pb-3">Enrollment No</th>
                <th className="pb-3">Course</th>
                <th className="pb-3">Semester</th>
                <th className="pb-3">Major</th>
                <th className="pb-3">Section</th>
                <th className="pb-3 text-right pr-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[--color-glass-border]">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((s) => (
                  <tr key={s.id} className="group hover:bg-white/[0.05] transition-colors">
                    <td className="py-4 pl-2">
                      <div className="flex items-center gap-3">
                        <div className="student-avatar bg-gradient-to-br from-[--color-accent] to-[--color-primary]">
                          {s.name.charAt(0)}
                        </div>
                        <span className="font-medium text-[--color-text-primary]">{s.name}</span>
                      </div>
                    </td>
                    <td className="py-4 text-[--color-text-secondary] font-mono text-sm">
                      {s.student_profiles?.[0]?.enrollment_no || 'N/A'}
                    </td>
                    <td className="py-4 text-[--color-text-secondary] text-sm">
                      {s.student_profiles?.[0]?.course || 'N/A'}
                    </td>
                    <td className="py-4 text-[--color-text-secondary] text-sm">
                      {s.student_profiles?.[0]?.semester || 'N/A'}
                    </td>
                    <td className="py-4 text-[--color-text-secondary] text-sm">
                      {s.student_profiles?.[0]?.major_subject || 'N/A'}
                    </td>
                    <td className="py-4 text-[--color-text-secondary] text-sm">
                      {s.student_profiles?.[0]?.section || 'N/A'}
                    </td>
                    <td className="py-4 text-right pr-2">
                      <button 
                        onClick={() => setResettingUserId(s.id)}
                        className="icon-btn hover:bg-white/[0.12]"
                        title="Reset Password"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[--color-text-secondary] italic">
                    No students found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

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
              className="modal"
            >
              <div className="icon-box--md icon-box--primary mb-6">
                <Key className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-[--color-text-primary] mb-2">Reset User Password</h3>
              <p className="text-[--color-text-secondary] text-sm mb-6">
                Enter a new password for this user. They will be able to sign in with this password immediately.
              </p>

              <div className="space-y-4">
                <div className="field-group">
                  <label className="field-label">New Password (6-digit PIN)</label>
                  <input 
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="field-input"
                    placeholder="e.g. 123456"
                    pattern="\d{6}"
                    maxLength={6}
                    autoFocus
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setResettingUserId(null)}
                    className="flex-1 icon-btn border border-[--color-glass-border] text-[--color-text-primary] font-semibold rounded-[12px] hover:bg-white/[0.08]"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => handleResetPassword(resettingUserId)}
                    disabled={loading || !/^\d{6}$/.test(newPassword)}
                    className="btn-gradient flex-1 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reset Password'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Info */}
      <section className="glass-card--primary border border-[--color-primary]/30">
        <div className="flex items-start gap-4">
          <div className="icon-box--md icon-box--primary">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[--color-text-primary] mb-1">Secure Admin Panel</h3>
            <p className="text-[--color-text-secondary] text-sm">
              As an administrator, you can manage teacher and student accounts. 
              If a user forgets their password, you can reset it here and provide them with the new credentials.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
