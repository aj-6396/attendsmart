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
            <div className="bg-white dark:bg-slate-900 border-l-4 border-red-500 shadow-xl p-4 rounded-r-xl flex items-center gap-3 border border-slate-100 dark:border-slate-800">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <p className="text-sm text-slate-700 dark:text-slate-300">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {success && (
            <div className="bg-white dark:bg-slate-900 border-l-4 border-green-500 shadow-xl p-4 rounded-r-xl flex items-center gap-3 mt-2 border border-slate-100 dark:border-slate-800">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <p className="text-sm text-slate-700 dark:text-slate-300">{success}</p>
              <button onClick={() => setSuccess(null)} className="ml-auto text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Students', value: stats?.students || 0, icon: Users, color: 'bg-blue-500', trend: '+12%' },
          { label: 'Total Teachers', value: stats?.teachers || 0, icon: ShieldCheck, color: 'bg-indigo-500', trend: '+2' },
          { label: 'Total Sessions', value: stats?.sessions || 0, icon: Calendar, color: 'bg-emerald-500', trend: '+45' },
          { label: 'Overall Attendance', value: `${stats?.overallAttendance || 0}%`, icon: TrendingUp, color: 'bg-amber-500', trend: '-2%' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-3 rounded-xl text-white shadow-lg", stat.color)}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div className={cn(
                "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full",
                stat.trend.startsWith('+') ? "bg-green-50 text-green-600 dark:bg-green-900/20" : "bg-red-50 text-red-600 dark:bg-red-900/20"
              )}>
                {stat.trend.startsWith('+') ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {stat.trend}
              </div>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{stat.label}</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Attendance Trends</h2>
              <p className="text-slate-500 text-sm">Daily attendance count for the last 7 days</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Live Updates</span>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.trends || []}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickFormatter={(str) => format(new Date(str), 'MMM d')}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#4f46e5" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorCount)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Critical Alerts</h2>
            <span className="px-2 py-1 bg-red-50 dark:bg-red-900/20 text-red-600 text-[10px] font-bold rounded-full uppercase">Low Attendance</span>
          </div>
          <div className="space-y-4 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
            {lowAttendanceStudents.length > 0 ? (
              lowAttendanceStudents.map((s, i) => (
                <div key={i} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center justify-between group hover:border-red-200 dark:hover:border-red-900/30 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 font-bold text-xs">
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white leading-none">{s.name}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{s.student_profiles?.[0]?.enrollment_no}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-red-600">{s.attendance_percentage}%</p>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Attendance</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <div className="w-12 h-12 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                </div>
                <p className="text-sm text-slate-500">All students are above 75%!</p>
              </div>
            )}
          </div>
          <button className="w-full mt-6 py-3 text-xs font-bold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all border border-indigo-100 dark:border-indigo-900/30">
            View All Reports
          </button>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Create Teacher Form */}
        <section className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-800 p-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
              <UserPlus className="w-5 h-5 text-indigo-600" />
              Add New Teacher
            </h2>

            <form onSubmit={handleCreateTeacher} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white"
                  placeholder="Prof. John Doe"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Teacher Email</label>
                <input
                  type="email"
                  value={teacherEmail}
                  onChange={(e) => setTeacherEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white"
                  placeholder="teacher@college.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Teacher ID / Enrollment No</label>
                <input
                  type="text"
                  value={teacherEnrollmentNo}
                  onChange={(e) => setTeacherEnrollmentNo(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white"
                  placeholder="TCH001"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
                <input
                  type="password"
                  value={teacherPassword}
                  onChange={(e) => setTeacherPassword(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white"
                  placeholder="6-digit PIN"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
                Create Teacher Account
              </button>
            </form>
          </div>
        </section>

        {/* Teachers List */}
        <section className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-800 p-6 h-full">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
              <Users className="w-5 h-5 text-indigo-600" />
              Existing Teachers
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-400 text-xs uppercase font-bold border-b border-slate-100 dark:border-slate-800">
                    <th className="pb-3 pl-2">Name</th>
                    <th className="pb-3">Teacher ID</th>
                    <th className="pb-3 text-right pr-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {teachers.length > 0 ? (
                    teachers.map((t) => (
                      <tr key={t.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-4 pl-2">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                              {t.name.charAt(0)}
                            </div>
                            <span className="font-medium text-slate-900 dark:text-white">{t.name}</span>
                          </div>
                        </td>
                        <td className="py-4 text-slate-500 dark:text-slate-400 font-mono text-sm">
                          {t.teacher_profiles?.[0]?.employee_id || 'N/A'}
                        </td>
                        <td className="py-4 text-right pr-2">
                          <button 
                            onClick={() => setResettingUserId(t.id)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"
                            title="Reset Password"
                          >
                            <Key className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-slate-400 italic">
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
      <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-800 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Manage Students
          </h2>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or enrollment..."
              className="pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-full sm:w-64 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-400 text-xs uppercase font-bold border-b border-slate-100 dark:border-slate-800">
                <th className="pb-3 pl-2">Name</th>
                <th className="pb-3">Enrollment No</th>
                <th className="pb-3">Course</th>
                <th className="pb-3">Semester</th>
                <th className="pb-3">Major</th>
                <th className="pb-3">Section</th>
                <th className="pb-3 text-right pr-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((s) => (
                  <tr key={s.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-4 pl-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold text-xs">
                          {s.name.charAt(0)}
                        </div>
                        <span className="font-medium text-slate-900 dark:text-white">{s.name}</span>
                      </div>
                    </td>
                    <td className="py-4 text-slate-500 dark:text-slate-400 font-mono text-sm">
                      {s.student_profiles?.[0]?.enrollment_no || 'N/A'}
                    </td>
                    <td className="py-4 text-slate-500 dark:text-slate-400 text-sm">
                      {s.student_profiles?.[0]?.course || 'N/A'}
                    </td>
                    <td className="py-4 text-slate-500 dark:text-slate-400 text-sm">
                      {s.student_profiles?.[0]?.semester || 'N/A'}
                    </td>
                    <td className="py-4 text-slate-500 dark:text-slate-400 text-sm">
                      {s.student_profiles?.[0]?.major_subject || 'N/A'}
                    </td>
                    <td className="py-4 text-slate-500 dark:text-slate-400 text-sm">
                      {s.student_profiles?.[0]?.section || 'N/A'}
                    </td>
                    <td className="py-4 text-right pr-2">
                      <button 
                        onClick={() => setResettingUserId(s.id)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"
                        title="Reset Password"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 italic">
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
              className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-8 border border-slate-100 dark:border-slate-800"
            >
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center mb-6">
                <Key className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Reset User Password</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
                Enter a new password for this user. They will be able to sign in with this password immediately.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">New Password (6-digit PIN)</label>
                  <input 
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white"
                    placeholder="e.g. 123456"
                    pattern="\d{6}"
                    maxLength={6}
                    autoFocus
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setResettingUserId(null)}
                    className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
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

      {/* Admin Info */}
      <section className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-6 border border-indigo-100 dark:border-indigo-900/30">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center shadow-sm border border-slate-100 dark:border-slate-800">
            <ShieldCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-100 mb-1">Secure Admin Panel</h3>
            <p className="text-indigo-700 dark:text-indigo-300 text-sm">
              As an administrator, you can manage teacher and student accounts. 
              If a user forgets their password, you can reset it here and provide them with the new credentials.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
