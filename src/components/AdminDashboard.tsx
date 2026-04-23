import React, { useState, useEffect } from 'react';
import { authFetch } from '../lib/authFetch';
import { supabase } from '../supabase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UserPlus, Users, ShieldCheck, Loader2, AlertCircle, CheckCircle2, 
  Key, Search, X, BarChart3, TrendingUp, Calendar, 
  ArrowUpRight, ArrowDownRight, Folder, Trash2, 
  RefreshCw, LayoutDashboard, UserCog, GraduationCap, Download, LogOut, Smartphone
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import ThemeToggle from './ThemeToggle';

type ActiveTab = 'overview' | 'teachers' | 'students' | 'classes';

export default function AdminDashboard({ user, onLogout, darkMode, toggleDarkMode }: { user: any; profile: any; onLogout: () => void; darkMode: boolean; toggleDarkMode: () => void }) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Data State
  const [stats, setStats] = useState<any>(null);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [lowAttendanceStudents, setLowAttendanceStudents] = useState<any[]>([]);
  
  // Search/Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;
  
  // Modals/Forms
  const [showCreateTeacher, setShowCreateTeacher] = useState(false);
  const [teacherName, setTeacherName] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [teacherId, setTeacherId] = useState('');
  
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    await Promise.all([
      fetchStats(),
      fetchTeachers(0, searchQuery),
      fetchStudents(0, searchQuery),
      fetchClasses()
    ]);
    setLoading(false);
  };

  const fetchStats = async () => {
    try {
      const response = await authFetch(`/api/admin/stats`);
      const text = await response.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch (_parseErr) {
        console.error('Stats API returned non-JSON:', text.substring(0, 200));
        setError('Server returned an invalid response. Please try refreshing.');
        return;
      }
      
      if (!response.ok) throw new Error(data.error || 'Failed to fetch stats');

      setStats({
        students: data.counts.students,
        teachers: data.counts.teachers,
        classes: data.counts.classes,
        sessions: data.counts.sessions,
        trends: data.trends,
        growth: data.growth,
        totalWeeklyAttendance: data.totalWeeklyAttendance
      });
      setLowAttendanceStudents(data.criticalRoster || []);
    } catch (err: any) {
      console.error('Stats fetch error:', err);
      setError(err.message || 'Failed to load dashboard stats.');
    }
  };

  const fetchTeachers = async (p = 0, q = '') => {
    try {
      setLoading(true);
      const res = await authFetch(`/api/admin/user-list?role=teacher&page=${p}&pageSize=${pageSize}&searchQuery=${encodeURIComponent(q)}`);
      const text = await res.text();
      const data = JSON.parse(text);
      if (!res.ok) throw new Error(data.error);
      setTeachers(data.users);
      if (activeTab === 'teachers') setTotalCount(data.total);
    } catch (err: any) {
      console.error('Fetch teachers error:', err);
      setError(err.message || 'Failed to load teachers.');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async (p = 0, q = '') => {
    try {
      setLoading(true);
      const res = await authFetch(`/api/admin/user-list?role=student&page=${p}&pageSize=${pageSize}&searchQuery=${encodeURIComponent(q)}`);
      const text = await res.text();
      const data = JSON.parse(text);
      if (!res.ok) throw new Error(data.error);
      setStudents(data.users);
      if (activeTab === 'students') setTotalCount(data.total);
    } catch (err: any) {
      console.error('Fetch students error:', err);
      setError(err.message || 'Failed to load students.');
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('*, users(name)').order('created_at', { ascending: false });
    setClasses(data || []);
  };

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await authFetch('/api/admin/create-teacher', {
        method: 'POST',
        body: JSON.stringify({
          teacherName,
          teacherEmail,
          teacherPassword,
          teacherEnrollmentNo: teacherId
        })
      });

      if (response.status === 404) {
        throw new Error("Backend API not found. Please run with 'vercel dev' to enable server features.");
      }

      const data = await response.json().catch(() => ({ error: "Server returned an invalid response." }));
      if (!response.ok) throw new Error(data.error || "Failed to create teacher account.");
      
      setSuccess(`Teacher ${teacherName} created successfully!`);
      setShowCreateTeacher(false);
      resetTeacherForm();
      fetchTeachers(page, searchQuery);
    } catch (err: any) {
      console.error("Admin Error:", err);
      setError(err.message || "A connection error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const resetTeacherForm = () => {
    setTeacherName('');
    setTeacherEmail('');
    setTeacherPassword('');
    setTeacherId('');
  };

  const deleteClass = async (id: string) => {
    if (!confirm('Are you sure you want to delete this class? All attendance data will be lost.')) return;
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (error) setError(error.message);
    else {
      setSuccess('Class deleted successfully');
      fetchClasses();
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (!/^\d{6}$/.test(newPassword)) return setError('PIN must be 6 digits');
    setLoading(true);
    try {
      const response = await authFetch('/api/admin/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          targetUserId: userId,
          newPassword
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      setSuccess('Password reset successfully');
      setResettingUserId(null);
      setNewPassword('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetDevice = async (studentId: string) => {
    if (!confirm('Are you sure you want to reset this student\'s device link? They will be able to register a new device on their next login.')) return;
    setLoading(true);
    try {
      const response = await authFetch('/api/admin/reset-device', {
        method: 'POST',
        body: JSON.stringify({
          targetUserId: studentId
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to reset device');
      
      setSuccess('Device link reset successfully. Student can now register a new device.');
      if (activeTab === 'students') fetchStudents(page, searchQuery);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'teachers') fetchTeachers(page, searchQuery);
    if (activeTab === 'students') fetchStudents(page, searchQuery);
    if (activeTab === 'classes') fetchClasses();
  }, [activeTab, page]);

  useEffect(() => {
    setPage(0);
    const timer = setTimeout(() => {
      if (activeTab === 'teachers') fetchTeachers(0, searchQuery);
      if (activeTab === 'students') fetchStudents(0, searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredItems = () => {
    if (activeTab === 'classes') {
      const q = searchQuery.toLowerCase();
      return classes.filter(c => c.name.toLowerCase().includes(q) || c.join_code.toLowerCase().includes(q));
    }
    return activeTab === 'teachers' ? teachers : students;
  };

  return (
    <div className="space-y-8 page-container">
      {/* Global Status Popups */}
      <AnimatePresence>
        {(error || success) && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed top-24 right-6 z-[500] w-full max-w-sm"
          >
            {error && (
              <div className="alert alert--error shadow-2xl backdrop-blur-md border-l-4 border-red-500">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm font-bold">{error}</p>
                <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-100 rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {success && (
              <div className="glass-card--success border-l-4 p-4 flex items-center gap-3 shadow-2xl">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <p className="text-sm font-bold text-emerald-800">{success}</p>
                <button onClick={() => setSuccess(null)} className="ml-auto p-1 hover:bg-emerald-100 rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-xl shadow-slate-200">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            Admin Command Center
          </h1>
          <p className="text-slate-500 font-medium mt-1">System-wide monitoring & resource management</p>
        </div>
        <div className="flex items-center gap-3">
           <ThemeToggle darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
           <button onClick={fetchInitialData} className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all text-slate-500 hover:text-indigo-600 shadow-sm">
              <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
           </button>
           <button className="btn-gradient px-6 py-3 flex items-center gap-2 shadow-xl shadow-indigo-100">
              <Download className="w-5 h-5" />
              System Report
           </button>
           <button onClick={onLogout} className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-red-50 transition-all text-slate-500 hover:text-red-600 shadow-sm" title="Logout">
              <LogOut className="w-5 h-5" />
           </button>
        </div>
      </div>

      <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit">
        {[
          { id: 'overview', label: 'Overview', icon: LayoutDashboard },
          { id: 'teachers', label: 'Teachers', icon: UserCog },
          { id: 'students', label: 'Students', icon: GraduationCap },
          { id: 'classes', label: 'Classes', icon: Folder },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id as any); setSearchQuery(''); setPage(0); }}
            className={cn(
              "px-5 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2",
              activeTab === tab.id 
                ? "bg-white text-indigo-600 shadow-sm" 
                : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' ? (
          <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Total Students', value: stats?.students, icon: Users, color: 'indigo', trend: '+5' },
                { label: 'Total Teachers', value: stats?.teachers, icon: ShieldCheck, color: 'emerald', trend: '+1' },
                { label: 'Classes', value: stats?.classes, icon: Folder, color: 'amber', trend: '+2' },
                { label: 'Total Sessions', value: stats?.sessions, icon: Calendar, color: 'rose', trend: '+53' },
              ].map((s, i) => (
                <div key={i} className="glass-card p-6 border-white bg-white/40 shadow-xl shadow-slate-200/50">
                   <div className="flex justify-between items-start mb-4">
                     <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center bg-slate-50")}>
                        <s.icon className="w-6 h-6 text-slate-600" />
                     </div>
                     <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-2 py-1 rounded-md">{s.trend}</span>
                   </div>
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
                   <h3 className="text-3xl font-black text-slate-900 leading-none">{s.value ?? <Loader2 className="w-6 h-6 animate-spin"/>}</h3>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               <div className="lg:col-span-2 glass-card p-8 bg-white/50 backdrop-blur-md">
                  <div className="flex items-center justify-between mb-8">
                     <div>
                        <h3 className="text-lg font-black text-slate-900">System Activity</h3>
                        <p className="text-xs text-slate-500 italic">Attendance check-ins past 7 days</p>
                     </div>
                     <div className="flex items-center gap-2">
                        <TrendingUp className={cn("w-4 h-4", (stats?.growth || 0) >= 0 ? "text-emerald-500" : "text-rose-500")} />
                        <span className={cn("text-xs font-black", (stats?.growth || 0) >= 0 ? "text-emerald-500" : "text-rose-500")}>
                           {stats?.growth > 0 ? '+' : ''}{stats?.growth || 0}% Growth
                        </span>
                     </div>
                  </div>
                  <div className="h-[300px] w-full">
                     <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats?.trends || []}>
                           <defs>
                             <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor={darkMode ? "#39ff14" : "#6366f1"} stopOpacity={darkMode ? 0.3 : 0.1}/>
                               <stop offset="95%" stopColor={darkMode ? "#39ff14" : "#6366f1"} stopOpacity={0}/>
                             </linearGradient>
                           </defs>
                           <XAxis dataKey="date" hide />
                           <Tooltip contentStyle={{ 
                              borderRadius: '16px', 
                              border: darkMode ? '1px solid rgba(57, 255, 20, 0.2)' : 'none', 
                              boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
                              backgroundColor: darkMode ? '#121212' : '#ffffff',
                              color: darkMode ? '#39ff14' : '#000000'
                            }} labelStyle={{ fontWeight: 'bold' }} />
                           <Area type="monotone" dataKey="count" stroke={darkMode ? "#39ff14" : "#6366f1"} strokeWidth={4} fillOpacity={1} fill="url(#colorCount)" />
                        </AreaChart>
                     </ResponsiveContainer>
                  </div>
               </div>

               <div className="glass-card p-8 bg-slate-900 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                     <AlertCircle className="w-32 h-32" />
                  </div>
                  <h3 className="text-lg font-black mb-1 text-white">Critical Roster</h3>
                  <p className="text-xs text-slate-400 mb-8 font-medium">Students below 75% attendance</p>
                  
                  <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2">
                     {lowAttendanceStudents.length > 0 ? lowAttendanceStudents.map((s, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                           <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center font-black text-xs">{s.name.charAt(0)}</div>
                              <span className="text-sm font-bold truncate max-w-[100px]">{s.name}</span>
                           </div>
                           <span className="text-red-400 font-black text-sm">{s.attendance_percentage}%</span>
                        </div>
                     )) : (
                        <div className="text-center py-12">
                           <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-4 opacity-40" />
                           <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">All Clear</p>
                        </div>
                     )}
                  </div>
               </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="management" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
               <div className="relative group w-full max-w-md">
                 <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-600 transition-all" />
                 <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-12 pr-6 py-3.5 bg-white border border-slate-100 rounded-[1.25rem] shadow-sm outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all font-medium text-slate-700" placeholder={`Search ${activeTab}...`} />
               </div>
               {activeTab === 'teachers' && (
                  <button onClick={() => setShowCreateTeacher(true)} className="btn-gradient px-7 py-3.5 flex items-center gap-2 shadow-lg shadow-indigo-100"><UserPlus className="w-5 h-5" />New Teacher</button>
               )}
            </div>

            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead className="bg-slate-50/50 border-b border-slate-50">
                     <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                       {activeTab === 'teachers' && (<><th className="px-8 py-5">Personnel info</th><th className="px-8 py-5 text-center">Designation</th><th className="px-8 py-5 text-right">Access Controls</th></>)}
                       {activeTab === 'students' && (<><th className="px-8 py-5">Academic info</th><th className="px-8 py-5">Enrollment</th><th className="px-8 py-5 text-right">Security</th></>)}
                       {activeTab === 'classes' && (<><th className="px-8 py-5">Class details</th><th className="px-8 py-5 text-center">Join Code</th><th className="px-8 py-5 text-right">Data Management</th></>)}
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                     {filteredItems().map((item: any) => (
                       <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                         {activeTab === 'teachers' && (
                           <><td className="px-8 py-5"><div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">{item.name.charAt(0)}</div><div><div className="text-slate-900 font-bold">{item.name}</div><div className="text-xs text-slate-400">{item.email}</div></div></div></td><td className="px-8 py-5 text-center"><span className="text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 px-3 py-1 rounded-md">Faculty</span></td><td className="px-8 py-5 text-right"><button onClick={() => setResettingUserId(item.id)} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><Key className="w-5 h-5" /></button></td></>
                         )}
                         {activeTab === 'students' && (
                           <><td className="px-8 py-5"><div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">{item.name.charAt(0)}</div><div><div className="text-slate-900 font-bold">{item.name}</div><div className="text-[10px] text-slate-400 font-black uppercase tracking-wider">{item.student_profiles?.[0]?.course} • Sem {item.student_profiles?.[0]?.semester}</div></div></div></td><td className="px-8 py-5 font-mono text-xs text-slate-500">{item.student_profiles?.[0]?.enrollment_no}</td><td className="px-8 py-5 text-right flex items-center justify-end gap-2"><button onClick={() => handleResetDevice(item.id)} className="p-2.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all" title="Reset Device Link"><Smartphone className="w-5 h-5" /></button><button onClick={() => setResettingUserId(item.id)} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Access Recovery"><Key className="w-5 h-5" /></button></td></>
                         )}
                         {activeTab === 'classes' && (
                           <><td className="px-8 py-5"><div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><Folder className="w-5 h-5" /></div><div><div className="text-slate-900 font-bold">{item.name}</div><div className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Owner: {item.users?.name || 'System'}</div></div></div></td><td className="px-8 py-5 text-center"><span className="font-mono text-xs font-black bg-slate-100 text-slate-600 px-3 py-1 rounded-lg border border-slate-200">{item.join_code}</span></td><td className="px-8 py-5 text-right"><button onClick={() => deleteClass(item.id)} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 className="w-5 h-5" /></button></td></>
                         )}
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>

            {activeTab !== 'classes' && totalCount > pageSize && (
               <div className="flex items-center justify-between px-8 py-4 bg-white rounded-2xl border border-slate-100 shadow-sm mt-4">
                 <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                   Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, totalCount)} of {totalCount}
                 </p>
                 <div className="flex gap-2">
                   <button 
                     type="button"
                     disabled={page === 0 || loading}
                     onClick={() => setPage(p => p - 1)}
                     className="px-4 py-2 text-xs font-black uppercase text-slate-500 hover:text-indigo-600 disabled:opacity-50 transition-colors"
                   >
                     Previous
                   </button>
                   <div className="flex items-center gap-1">
                     {Array.from({ length: Math.ceil(totalCount / pageSize) }).map((_, i) => (
                       <button
                         key={i}
                         type="button"
                         onClick={() => setPage(i)}
                         className={cn(
                           "w-8 h-8 rounded-lg text-[10px] font-black transition-all",
                           page === i ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:bg-slate-50"
                         )}
                       >
                         {i + 1}
                       </button>
                     )).slice(Math.max(0, page - 2), Math.min(Math.ceil(totalCount / pageSize), page + 3))}
                   </div>
                   <button 
                     type="button"
                     disabled={(page + 1) * pageSize >= totalCount || loading}
                     onClick={() => setPage(p => p + 1)}
                     className="px-4 py-2 text-xs font-black uppercase text-slate-500 hover:text-indigo-600 disabled:opacity-50 transition-colors"
                   >
                     Next
                   </button>
                 </div>
               </div>
             )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hire Teacher Modal */}
      <AnimatePresence>
        {showCreateTeacher && (
           <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-xl">
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 10 }} className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg p-10">
                    <div className="flex justify-between items-start mb-10">
                       <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-100"><UserPlus className="w-7 h-7 text-white" /></div>
                       <button onClick={() => setShowCreateTeacher(false)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400"><X className="w-6 h-6" /></button>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 mb-2">Hire New Faculty</h3>
                    <p className="text-slate-500 text-sm mb-10 leading-relaxed font-medium">Provide registration credentials for the new teaching personnel.</p>
                    <form onSubmit={handleCreateTeacher} className="grid grid-cols-2 gap-6">
                       <div className="col-span-2"><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Full Name</label><input type="text" value={teacherName} onChange={e => setTeacherName(e.target.value)} className="field-input w-full" placeholder="e.g. Dr. Robert Fox" required /></div>
                       <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Personnel ID</label><input type="text" value={teacherId} onChange={e => setTeacherId(e.target.value)} className="field-input w-full" placeholder="TCH-2024" required /></div>
                       <div><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Password</label><input type="password" value={teacherPassword} onChange={e => setTeacherPassword(e.target.value.replace(/\D/g, '').slice(0, 6))} className="field-input w-full font-mono text-center" placeholder="******" maxLength={6} required /></div>
                       <div className="col-span-2"><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Authorized Email</label><input type="email" value={teacherEmail} onChange={e => setTeacherEmail(e.target.value)} className="field-input w-full" placeholder="faculty@college.com" required /></div>
                       <button disabled={loading} type="submit" className="col-span-2 btn-gradient mt-6 py-5 rounded-2xl shadow-xl shadow-indigo-100 font-black tracking-widest uppercase text-xs">{loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto"/> : 'Grant Access Rights'}</button>
                    </form>
              </motion.div>
           </div>
        )}

        {resettingUserId && (
           <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-xl">
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm p-10 text-center">
                 <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-8 mx-auto shadow-xl shadow-slate-200"><Key className="w-8 h-8 text-white" /></div>
                 <h3 className="text-2xl font-black text-slate-900 mb-2">Access Recovery</h3>
                 <p className="text-slate-500 text-sm mb-8 font-medium">Assign a new security PIN for this personnel.</p>
                 <div className="space-y-6">
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full text-center text-3xl font-black tracking-[0.5em] py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 rounded-2xl outline-none" placeholder="******" maxLength={6} />
                    <div className="flex gap-4">
                       <button onClick={() => setResettingUserId(null)} className="flex-1 py-4 text-xs font-black uppercase text-slate-400">Cancel</button>
                       <button onClick={() => handleResetPassword(resettingUserId!)} disabled={loading || !/^\d{6}$/.test(newPassword)} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-200 disabled:opacity-50">Confirm PIN</button>
                    </div>
                 </div>
              </motion.div>
           </div>
        )}
      </AnimatePresence>
    </div>
  );
}
