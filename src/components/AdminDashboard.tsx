import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { authFetch } from '../lib/authFetch';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  GraduationCap, 
  Folder, 
  UserPlus, 
  Trash2, 
  Smartphone, 
  Key, 
  Download, 
  Search, 
  Plus, 
  RefreshCw, 
  LogOut, 
  CheckCircle2, 
  AlertCircle, 
  X,
  FileText,
  Loader2,
  TrendingDown,
  Clock,
  ShieldCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ThemeToggle from './ThemeToggle';
import { downloadFile } from '../lib/fileDownload';
import { useBackButton } from '../lib/backButton';

type ActiveTab = 'overview' | 'teachers' | 'students' | 'classes';

export default function AdminDashboard({ user, profile, onLogout, darkMode, toggleDarkMode }: { user: any; profile: any; onLogout: () => void; darkMode: boolean; toggleDarkMode: () => void }) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Data States
  const [stats, setStats] = useState<any>(null);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [lowAttendanceStudents, setLowAttendanceStudents] = useState<any[]>([]);
  
  // Search & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 15;

  // Modals/Forms
  const [showCreateTeacher, setShowCreateTeacher] = useState(false);
  const [teacherName, setTeacherName] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [teacherId, setTeacherId] = useState('');
  
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Android Back Button Navigation
  useBackButton(() => {
    if (resettingUserId !== null) {
      setResettingUserId(null);
      setNewPassword('');
      return true;
    }
    return false;
  }, resettingUserId !== null, 60);

  useBackButton(() => {
    if (showCreateTeacher) {
      setShowCreateTeacher(false);
      return true;
    }
    return false;
  }, showCreateTeacher, 50);

  useBackButton(() => {
    if (activeTab !== 'overview') {
      setActiveTab('overview');
      setSearchQuery('');
      setPage(0);
      return true;
    }
    return false;
  }, activeTab !== 'overview' && !showCreateTeacher && resettingUserId === null, 30);

  // Export Executive PDF Report
  const exportExecutivePDF = async () => {
    if (!stats) return;
    try {
      setLoading(true);
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      // Title & Header
      doc.setFontSize(22);
      doc.setTextColor(0, 33, 71);
      doc.text('Institutional Attendance Audit', 14, 20);

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated on: ${format(new Date(), 'PPPP')}`, 14, 28);
      doc.text(`Authorized by: System Administration`, 14, 33);

      // Summary Table
      autoTable(doc, {
        startY: 40,
        head: [['Metric', 'Institutional Value', 'Status / Target']],
        body: [
          ['Total Teaching Faculty', `${stats.total_teachers}`, 'Active'],
          ['Total Enrolled Students', `${stats.total_students}`, 'Active'],
          ['Active Academic Classes', `${stats.total_classes}`, 'Operational'],
          ['Overall Institution Attendance', `${stats.avg_attendance_rate}%`, stats.avg_attendance_rate >= 75 ? 'Meets UGC / Mandatory Standard' : 'Requires Review (<75%)'],
          ['Critical Short-Attendance Students', `${lowAttendanceStudents.length}`, lowAttendanceStudents.length > 0 ? 'Action Recommended' : 'Optimal']
        ],
        theme: 'grid',
        headStyles: { fillColor: [0, 33, 71], textColor: [255, 255, 255], fontStyle: 'bold' }
      });

      // Critical Roster Table if any
      const lastY = (doc as any).lastAutoTable.finalY + 10;
      if (lowAttendanceStudents.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(185, 28, 28);
        doc.text('Critical Attendance Roster (< 75%)', 14, lastY);

        autoTable(doc, {
          startY: lastY + 5,
          head: [['Student Name', 'Enrollment No', 'Attendance Rate']],
          body: lowAttendanceStudents.map(s => [
            s.name,
            s.enrollment_no,
            `${s.attendance_percentage}%`
          ]),
          theme: 'striped',
          headStyles: { fillColor: [185, 28, 28], textColor: [255, 255, 255] }
        });
      }

      const pdfBlob = doc.output('blob');
      await downloadFile(`ClassMark_Executive_Audit_${format(new Date(), 'yyyy-MM-dd')}.pdf`, pdfBlob, 'application/pdf');
      setSuccess('Executive PDF Audit exported successfully!');
    } catch (err: any) {
      console.error('PDF Export Error:', err);
      setError('Failed to generate PDF: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Export Current Tab as CSV
  const exportActiveTabCSV = async () => {
    try {
      setLoading(true);
      let csvContent = '';
      let filename = `ClassMark_${activeTab}_${format(new Date(), 'yyyy-MM-dd')}.csv`;

      if (activeTab === 'teachers') {
        csvContent = [
          ['Name', 'Email', 'Personnel ID', 'Joined Date'],
          ...teachers.map(t => [t.name, t.email, t.teacher_profiles?.employee_id || 'N/A', format(new Date(t.created_at), 'yyyy-MM-dd')])
        ].map(e => e.join(',')).join('\n');
      } else if (activeTab === 'students') {
        csvContent = [
          ['Name', 'Enrollment No', 'Exam Roll No', 'Course', 'Semester', 'Section', 'Batch'],
          ...students.map(s => {
            const prof = Array.isArray(s.student_profiles) ? s.student_profiles[0] : s.student_profiles;
            return [
              s.name,
              prof?.enrollment_no || 'N/A',
              prof?.exam_roll_no || 'N/A',
              prof?.course || 'N/A',
              prof?.semester || 'N/A',
              prof?.section || 'N/A',
              prof?.batch || 'N/A'
            ];
          })
        ].map(e => e.join(',')).join('\n');
      } else if (activeTab === 'classes') {
        csvContent = [
          ['Class Name', 'Join Code', 'Faculty Owner', 'Created Date'],
          ...classes.map(c => [
            c.name,
            c.join_code,
            c.users?.name || 'System',
            format(new Date(c.created_at), 'yyyy-MM-dd')
          ])
        ].map(e => e.join(',')).join('\n');
      } else {
        csvContent = [
          ['Metric', 'Value'],
          ['Total Teachers', stats?.total_teachers || 0],
          ['Total Students', stats?.total_students || 0],
          ['Total Classes', stats?.total_classes || 0],
          ['Avg Attendance Rate', `${stats?.avg_attendance_rate || 0}%`]
        ].map(e => e.join(',')).join('\n');
        filename = `ClassMark_Overview_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      }

      await downloadFile(filename, csvContent, 'text/csv;charset=utf-8;');
      setSuccess(`${activeTab.toUpperCase()} CSV downloaded successfully!`);
    } catch (err: any) {
      console.error('CSV Export Error:', err);
      setError('Failed to export CSV: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/admin/metrics');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load metrics');
      setStats(data.metrics);
      setLowAttendanceStudents(data.lowAttendanceStudents || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeachers = async (pageIndex = 0, query = '') => {
    try {
      setLoading(true);
      const res = await authFetch(`/api/admin/teachers?page=${pageIndex}&pageSize=${pageSize}&search=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load teachers');
      setTeachers(data.teachers || []);
      setTotalCount(data.total || 0);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async (pageIndex = 0, query = '') => {
    try {
      setLoading(true);
      const res = await authFetch(`/api/admin/students?page=${pageIndex}&pageSize=${pageSize}&search=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load students');
      setStudents(data.students || []);
      setTotalCount(data.total || 0);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('classes')
        .select('*, users:created_by(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setClasses(data || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherName || !teacherEmail || !teacherPassword || !teacherId) {
      setError('Please fill in all fields.');
      return;
    }
    if (!/^\d{6}$/.test(teacherPassword)) {
      setError('Password must be exactly 6 digits.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await authFetch('/api/admin/create-teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: teacherName.trim(),
          email: teacherEmail.trim(),
          password: teacherPassword,
          employeeId: teacherId.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create teacher');

      setSuccess('Faculty member created successfully!');
      setShowCreateTeacher(false);
      setTeacherName('');
      setTeacherEmail('');
      setTeacherPassword('');
      setTeacherId('');
      fetchTeachers(0);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (!/^\d{6}$/.test(newPassword)) {
      setError('PIN must be exactly 6 digits.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await authFetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: userId,
          newPassword
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset PIN');

      setSuccess('PIN reset successfully!');
      setResettingUserId(null);
      setNewPassword('');
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetDevice = async (userId: string) => {
    if (!confirm('Are you sure you want to reset this student\'s device link?')) return;
    try {
      setLoading(true);
      setError(null);
      const res = await authFetch('/api/admin/reset-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset device link');

      setSuccess('Device link reset successfully!');
      if (activeTab === 'students') fetchStudents(page, searchQuery);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteClass = async (classId: string) => {
    if (!confirm('Are you sure you want to delete this class? All attendance records will be removed.')) return;
    try {
      setLoading(true);
      const { error } = await supabase.from('classes').delete().eq('id', classId);
      if (error) throw error;
      setSuccess('Class deleted successfully.');
      fetchClasses();
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'overview') fetchOverview();
    if (activeTab === 'teachers') fetchTeachers(page, searchQuery);
    if (activeTab === 'students') fetchStudents(page, searchQuery);
    if (activeTab === 'classes') fetchClasses();
  }, [activeTab, page]);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (activeTab === 'teachers') fetchTeachers(0, searchQuery);
      if (activeTab === 'students') fetchStudents(0, searchQuery);
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const activeItems = activeTab === 'classes' ? classes : (activeTab === 'teachers' ? teachers : students);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Global Alerts */}
      <AnimatePresence>
        {(error || success) && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-3 right-3 left-3 sm:left-auto sm:right-6 sm:max-w-md z-[100] safe-area-pt pointer-events-auto"
          >
            {error && (
              <div className="alert alert--error shadow-2xl flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-xs sm:text-sm truncate">{error}</p>
                </div>
                <button onClick={() => setError(null)} className="p-1 touch-target">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {success && (
              <div className="alert alert--success shadow-2xl flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <p className="text-xs sm:text-sm truncate">{success}</p>
                </div>
                <button onClick={() => setSuccess(null)} className="p-1 touch-target">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#002147] dark:bg-blue-600 flex items-center justify-center text-white shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Institutional Admin</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">ClassMark Control & Audit Console</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
          <button 
            onClick={exportExecutivePDF} 
            className="btn-outlined text-xs font-bold flex items-center gap-1.5 px-3 py-2"
            title="Export Institutional PDF"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden xs:inline">Audit PDF</span>
          </button>
          <ThemeToggle darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
          <button 
            onClick={onLogout}
            className="p-2.5 bg-slate-100 dark:bg-slate-700/60 rounded-xl hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 text-slate-600 dark:text-slate-300 transition-colors touch-target"
            title="Logout"
            aria-label="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Scrollable Tab Navigation Pills */}
      <div className="flex flex-nowrap overflow-x-auto no-scrollbar gap-2 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl touch-scroll">
        {[
          { id: 'overview', label: 'Overview', icon: Clock },
          { id: 'teachers', label: 'Faculty', icon: Users },
          { id: 'students', label: 'Students', icon: GraduationCap },
          { id: 'classes', label: 'Classes', icon: Folder }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id as any); setSearchQuery(''); setPage(0); }}
            className={cn(
              "py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all min-h-[44px] shrink-0 whitespace-nowrap",
              activeTab === tab.id 
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" 
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
            )}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' ? (
          <motion.div
            key="tab-overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
              <div className="glass-card p-4 sm:p-5">
                <span className="text-[10px] sm:text-xs font-bold uppercase text-slate-400 block tracking-wider">Faculty</span>
                <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">{stats?.total_teachers || 0}</p>
                <span className="text-[11px] text-slate-500 mt-1 block">Active Instructors</span>
              </div>
              <div className="glass-card p-4 sm:p-5">
                <span className="text-[10px] sm:text-xs font-bold uppercase text-slate-400 block tracking-wider">Students</span>
                <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">{stats?.total_students || 0}</p>
                <span className="text-[11px] text-slate-500 mt-1 block">Enrolled Candidates</span>
              </div>
              <div className="glass-card p-4 sm:p-5">
                <span className="text-[10px] sm:text-xs font-bold uppercase text-slate-400 block tracking-wider">Classes</span>
                <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">{stats?.total_classes || 0}</p>
                <span className="text-[11px] text-slate-500 mt-1 block">Active Modules</span>
              </div>
              <div className="glass-card p-4 sm:p-5">
                <span className="text-[10px] sm:text-xs font-bold uppercase text-slate-400 block tracking-wider">Overall Rate</span>
                <p className={cn("text-2xl sm:text-3xl font-black mt-1", (stats?.avg_attendance_rate || 0) >= 75 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                  {stats?.avg_attendance_rate || 0}%
                </p>
                <span className="text-[11px] text-slate-500 mt-1 block">Institution Average</span>
              </div>
            </div>

            {/* Low Attendance Roster */}
            {lowAttendanceStudents.length > 0 && (
              <div className="glass-card border-rose-200 dark:border-rose-900/50 p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown className="w-5 h-5 text-rose-600" />
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">Critical Short Attendance (&lt;75%)</h3>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto touch-scroll">
                  {lowAttendanceStudents.map((s, idx) => (
                    <div key={idx} className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">{s.name}</p>
                        <p className="text-[11px] text-slate-500 font-mono">{s.enrollment_no}</p>
                      </div>
                      <span className="badge badge--error text-xs">{s.attendance_percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key={`tab-${activeTab}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4 sm:space-y-6"
          >
            {/* Controls Row */}
            <div className="glass-card p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={`Search ${activeTab}...`}
                    className="field-input pl-9"
                  />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button 
                    onClick={exportActiveTabCSV}
                    className="btn-outlined text-xs font-bold flex items-center gap-1.5 px-3 py-2 flex-1 sm:flex-none"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                  {activeTab === 'teachers' && (
                    <button
                      onClick={() => setShowCreateTeacher(true)}
                      className="btn-gradient text-xs font-bold flex items-center gap-1.5 px-3 py-2 flex-1 sm:flex-none"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Add Faculty</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Data Table with Smooth Touch Scrolling */}
              <div className="overflow-x-auto touch-scroll mt-4">
                <table className="w-full text-left min-w-[340px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                      <th className="py-3 px-3 sm:px-5">Name & Details</th>
                      <th className="py-3 px-3 sm:px-5 text-center">Identifier</th>
                      <th className="py-3 px-3 sm:px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-xs sm:text-sm">
                    {activeTab === 'teachers' && teachers.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                        <td className="py-3 px-3 sm:px-5">
                          <div className="font-bold text-slate-900 dark:text-white">{t.name}</div>
                          <div className="text-[11px] text-slate-500">{t.email}</div>
                        </td>
                        <td className="py-3 px-3 sm:px-5 text-center font-mono text-xs text-slate-600 dark:text-slate-400">
                          {t.teacher_profiles?.employee_id || 'FACULTY'}
                        </td>
                        <td className="py-3 px-3 sm:px-5 text-right">
                          <button 
                            onClick={() => setResettingUserId(t.id)} 
                            className="p-2 text-slate-400 hover:text-blue-600 rounded-lg touch-target"
                            title="Reset PIN"
                          >
                            <Key className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}

                    {activeTab === 'students' && students.map(s => {
                      const prof = Array.isArray(s.student_profiles) ? s.student_profiles[0] : s.student_profiles;
                      return (
                        <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                          <td className="py-3 px-3 sm:px-5">
                            <div className="font-bold text-slate-900 dark:text-white">{s.name}</div>
                            <div className="text-[11px] text-slate-500">{prof?.course || 'General'} • Sem {prof?.semester || 'I'}</div>
                          </td>
                          <td className="py-3 px-3 sm:px-5 text-center font-mono text-xs text-slate-600 dark:text-slate-400">
                            {prof?.enrollment_no || 'N/A'}
                          </td>
                          <td className="py-3 px-3 sm:px-5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button 
                                onClick={() => handleResetDevice(s.id)} 
                                className="p-2 text-slate-400 hover:text-amber-600 rounded-lg touch-target"
                                title="Reset Device Link"
                              >
                                <Smartphone className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => setResettingUserId(s.id)} 
                                className="p-2 text-slate-400 hover:text-blue-600 rounded-lg touch-target"
                                title="Reset PIN"
                              >
                                <Key className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {activeTab === 'classes' && classes.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                        <td className="py-3 px-3 sm:px-5">
                          <div className="font-bold text-slate-900 dark:text-white">{c.name}</div>
                          <div className="text-[11px] text-slate-500">Instructor: {c.users?.name || 'Faculty'}</div>
                        </td>
                        <td className="py-3 px-3 sm:px-5 text-center font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                          {c.join_code}
                        </td>
                        <td className="py-3 px-3 sm:px-5 text-right">
                          <button 
                            onClick={() => deleteClass(c.id)} 
                            className="p-2 text-slate-400 hover:text-rose-600 rounded-lg touch-target"
                            title="Delete Class"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}

                    {activeItems.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-slate-400 italic">
                          No records found for {activeTab}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {activeTab !== 'classes' && totalCount > pageSize && (
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <span className="text-slate-500">Page {page + 1} of {Math.ceil(totalCount / pageSize)}</span>
                  <div className="flex gap-2">
                    <button 
                      disabled={page === 0} 
                      onClick={() => setPage(p => p - 1)}
                      className="btn-outlined px-3 py-1.5 text-xs disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button 
                      disabled={(page + 1) * pageSize >= totalCount} 
                      onClick={() => setPage(p => p + 1)}
                      className="btn-outlined px-3 py-1.5 text-xs disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Faculty Modal */}
      {showCreateTeacher && (
        <div className="modal-overlay" onClick={() => setShowCreateTeacher(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="sheet-drag-handle sm:hidden" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[--color-text-primary]">Add Faculty Member</h3>
              <button onClick={() => setShowCreateTeacher(false)} className="p-1 text-slate-400 hover:text-slate-600 touch-target">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTeacher} className="space-y-3.5">
              <div className="field-group">
                <label className="field-label">Full Name</label>
                <input 
                  type="text" 
                  value={teacherName} 
                  onChange={e => setTeacherName(e.target.value)} 
                  placeholder="Dr. Rajesh Kumar" 
                  className="field-input" 
                  required 
                />
              </div>
              <div className="field-group">
                <label className="field-label">Employee / Faculty ID</label>
                <input 
                  type="text" 
                  value={teacherId} 
                  onChange={e => setTeacherId(e.target.value)} 
                  placeholder="FAC-2026" 
                  className="field-input" 
                  required 
                />
              </div>
              <div className="field-group">
                <label className="field-label">Institutional Email</label>
                <input 
                  type="email" 
                  value={teacherEmail} 
                  onChange={e => setTeacherEmail(e.target.value)} 
                  placeholder="faculty@college.com" 
                  className="field-input" 
                  required 
                />
              </div>
              <div className="field-group">
                <label className="field-label">6-Digit PIN</label>
                <input 
                  type="password" 
                  value={teacherPassword} 
                  onChange={e => setTeacherPassword(e.target.value.replace(/\D/g, '').slice(0, 6))} 
                  placeholder="••••••" 
                  maxLength={6}
                  inputMode="numeric"
                  className="field-input font-mono text-center tracking-[0.3em]" 
                  required 
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button disabled={loading} type="submit" className="btn-gradient flex-1 font-bold">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto"/> : 'Add Faculty'}
                </button>
                <button type="button" onClick={() => setShowCreateTeacher(false)} className="btn-outlined px-4">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset PIN Modal */}
      {resettingUserId && (
        <div className="modal-overlay" onClick={() => setResettingUserId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="sheet-drag-handle sm:hidden" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[--color-text-primary]">Reset Security PIN</h3>
              <button onClick={() => setResettingUserId(null)} className="p-1 text-slate-400 hover:text-slate-600 touch-target">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-[--color-text-secondary] mb-4">
              Assign a new 6-digit numeric security PIN for this account.
            </p>
            <div className="space-y-4">
              <input 
                type="password" 
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value.replace(/\D/g, '').slice(0, 6))} 
                className="field-input text-center text-2xl font-mono tracking-[0.3em]" 
                placeholder="••••••" 
                maxLength={6} 
                inputMode="numeric"
                autoFocus
              />
              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => handleResetPassword(resettingUserId)} 
                  disabled={loading || !/^\d{6}$/.test(newPassword)} 
                  className="btn-gradient flex-1 font-bold"
                >
                  Confirm PIN
                </button>
                <button onClick={() => setResettingUserId(null)} className="btn-outlined px-4">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
