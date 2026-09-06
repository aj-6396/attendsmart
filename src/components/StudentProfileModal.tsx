import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, User, GraduationCap, BookOpen, Calendar as CalendarIcon, ShieldCheck, 
  Smartphone, Edit3, Save, CheckCircle2, AlertCircle, Loader2, Key, Hash,
  ChevronLeft, ChevronRight, XCircle, Clock
} from 'lucide-react';
import { authFetch } from '../lib/authFetch';
import { supabase } from '../supabase';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, 
  isSameDay, isToday, parseISO
} from 'date-fns';

export interface StudentProfileData {
  id: string;
  name: string;
  enrollment_no: string;
  exam_roll_no?: string;
  course?: string;
  semester?: string;
  major_subject?: string;
  batch?: string;
  section?: string;
  device_id?: string;
  created_at?: string;
  profile?: {
    enrollment_no?: string;
    exam_roll_no?: string;
    course?: string;
    semester?: string;
    major_subject?: string;
    batch?: string;
    section?: string;
    device_id?: string;
    created_at?: string;
  };
}

interface StudentProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentProfileData | null;
  onSaved?: () => void;
  isEditable?: boolean;
}

interface CalendarDayStatus {
  date: Date;
  dateStr: string;
  status: 'present' | 'absent' | 'partial' | 'none';
  sessionsCount: number;
  attendedCount: number;
  sessionsList: {
    id: string;
    created_at: string;
    className: string;
    attended: boolean;
  }[];
}

export default function StudentProfileModal({
  isOpen,
  onClose,
  student,
  onSaved,
  isEditable = false,
}: StudentProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'calendar'>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Profile Form fields
  const [name, setName] = useState('');
  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [examRollNo, setExamRollNo] = useState('');
  const [course, setCourse] = useState('');
  const [semester, setSemester] = useState('');
  const [majorSubject, setMajorSubject] = useState('');
  const [batch, setBatch] = useState('');
  const [section, setSection] = useState('');

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [dayStatusMap, setDayStatusMap] = useState<Map<string, CalendarDayStatus>>(new Map());
  const [selectedDay, setSelectedDay] = useState<CalendarDayStatus | null>(null);
  const [monthlyStats, setMonthlyStats] = useState({ present: 0, absent: 0, percentage: 0 });

  useEffect(() => {
    if (student) {
      const p = student.profile || student;
      setName(student.name || '');
      setEnrollmentNo(p.enrollment_no || '');
      setExamRollNo(p.exam_roll_no || '');
      setCourse(p.course || '');
      setSemester(p.semester || '');
      setMajorSubject(p.major_subject || '');
      setBatch(p.batch || '');
      setSection(p.section || '');
      setIsEditing(false);
      setError(null);
      setSuccess(null);
      setSelectedDay(null);
    }
  }, [student, isOpen]);

  // Fetch Attendance Calendar Data
  const fetchCalendarData = useCallback(async () => {
    if (!student?.id) return;
    try {
      setCalendarLoading(true);

      // 1. Get enrolled classes for student
      const { data: enrollments } = await supabase
        .from('class_enrollments')
        .select('class_id, classes(id, name)')
        .eq('student_id', student.id);

      const classMap = new Map<string, string>();
      const classIds: string[] = [];

      (enrollments || []).forEach((e: any) => {
        if (e.class_id) {
          classIds.push(e.class_id);
          classMap.set(e.class_id, e.classes?.name || 'Class');
        }
      });

      if (classIds.length === 0) {
        setDayStatusMap(new Map());
        setMonthlyStats({ present: 0, absent: 0, percentage: 0 });
        setCalendarLoading(false);
        return;
      }

      // 2. Fetch all sessions for student's classes
      const { data: sessions } = await supabase
        .from('attendance_sessions')
        .select('id, class_id, created_at')
        .in('class_id', classIds)
        .order('created_at', { ascending: true });

      // 3. Fetch all attendance records for this student
      const { data: records } = await supabase
        .from('attendance_records')
        .select('session_id, created_at')
        .eq('student_id', student.id);

      const attendedSessionIds = new Set((records || []).map((r: any) => r.session_id));

      // 4. Map sessions by date string YYYY-MM-DD
      const map = new Map<string, CalendarDayStatus>();

      (sessions || []).forEach((s: any) => {
        const dateObj = new Date(s.created_at);
        const dateStr = format(dateObj, 'yyyy-MM-dd');
        const attended = attendedSessionIds.has(s.id);
        const className = classMap.get(s.class_id) || 'Class';

        if (!map.has(dateStr)) {
          map.set(dateStr, {
            date: dateObj,
            dateStr,
            status: 'none',
            sessionsCount: 0,
            attendedCount: 0,
            sessionsList: []
          });
        }

        const dayItem = map.get(dateStr)!;
        dayItem.sessionsCount += 1;
        if (attended) dayItem.attendedCount += 1;
        dayItem.sessionsList.push({
          id: s.id,
          created_at: s.created_at,
          className,
          attended
        });
      });

      // Update statuses
      map.forEach((item) => {
        if (item.attendedCount === item.sessionsCount && item.sessionsCount > 0) {
          item.status = 'present';
        } else if (item.attendedCount === 0 && item.sessionsCount > 0) {
          item.status = 'absent';
        } else if (item.sessionsCount > 0) {
          item.status = 'partial';
        }
      });

      setDayStatusMap(map);
    } catch (err) {
      console.error('Error fetching calendar data:', err);
    } finally {
      setCalendarLoading(false);
    }
  }, [student?.id]);

  useEffect(() => {
    if (isOpen && activeTab === 'calendar') {
      fetchCalendarData();
    }
  }, [isOpen, activeTab, fetchCalendarData]);

  // Compute monthly stats for currentMonth view
  useEffect(() => {
    let present = 0;
    let absent = 0;

    dayStatusMap.forEach((item) => {
      if (isSameMonth(item.date, currentMonth)) {
        if (item.status === 'present') present += 1;
        else if (item.status === 'absent') absent += 1;
        else if (item.status === 'partial') {
          present += item.attendedCount;
          absent += (item.sessionsCount - item.attendedCount);
        }
      }
    });

    const total = present + absent;
    setMonthlyStats({
      present,
      absent,
      percentage: total > 0 ? Math.round((present / total) * 100) : 0
    });
  }, [dayStatusMap, currentMonth]);

  if (!isOpen || !student) return null;

  const prof = student.profile || student;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!name.trim()) {
      setError('Full Name is required.');
      return;
    }
    if (!/^\d{6}$/.test(enrollmentNo.trim())) {
      setError('Enrollment Number must be exactly 6 digits.');
      return;
    }
    if (examRollNo.trim() && !/^[a-zA-Z0-9]{11}$/.test(examRollNo.trim())) {
      setError('Examination Roll Number must be exactly 11 characters.');
      return;
    }

    try {
      setLoading(true);
      const response = await authFetch('/api/admin/update-student-profile', {
        method: 'POST',
        body: JSON.stringify({
          studentId: student.id,
          fullName: name,
          enrollmentNo,
          examRollNo,
          course,
          semester,
          majorSubject,
          batch,
          section,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update student profile');
      }

      setSuccess('Student profile updated successfully!');
      setIsEditing(false);
      if (onSaved) onSaved();
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Failed to update student profile.');
    } finally {
      setLoading(false);
    }
  };

  // Calendar Grid Dates Calculation
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const daysGrid = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl border border-slate-100 dark:border-slate-800 overflow-hidden my-8"
        >
          {/* Top Banner Header */}
          <div className="bg-gradient-to-r from-[#002147] via-blue-900 to-[#004080] dark:from-slate-900 dark:to-indigo-950 p-6 text-white relative">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm flex items-center justify-center text-white text-2xl font-bold">
                {name ? name.charAt(0).toUpperCase() : <User className="w-7 h-7" />}
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-blue-200 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10">
                  Student Profile
                </span>
                <h3 className="text-xl sm:text-2xl font-bold mt-1 text-white tracking-tight">
                  {name || 'Student Name'}
                </h3>
                <p className="text-xs text-blue-200/80 font-mono mt-0.5">
                  Enrollment: {enrollmentNo || prof.enrollment_no || 'N/A'}
                </p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 mt-5 p-1 bg-white/10 rounded-xl backdrop-blur-md w-fit">
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'profile'
                    ? 'bg-white text-indigo-950 shadow-sm'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                <User className="w-3.5 h-3.5" /> Details
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('calendar')}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'calendar'
                    ? 'bg-white text-indigo-950 shadow-sm'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" /> Attendance Calendar
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-6">
            {/* Alerts */}
            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="alert alert--error">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="text-xs font-medium">{error}</span>
              </motion.div>
            )}

            {success && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="alert alert--success bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="text-xs font-medium">{success}</span>
              </motion.div>
            )}

            {activeTab === 'profile' ? (
              isEditing ? (
                /* Edit Form */
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Edit3 className="w-4 h-4 text-indigo-600" />
                      Correct Student Profile
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="field-group sm:col-span-2">
                      <label className="field-label">Full Name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="field-input text-sm"
                        placeholder="e.g. John Doe"
                        required
                      />
                    </div>

                    <div className="field-group">
                      <label className="field-label">Enrollment Number (6 digits)</label>
                      <input
                        type="text"
                        value={enrollmentNo}
                        onChange={(e) => setEnrollmentNo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="field-input font-mono text-sm"
                        placeholder="e.g. 123456"
                        maxLength={6}
                        required
                      />
                    </div>

                    <div className="field-group">
                      <label className="field-label">Examination Roll No (11 chars)</label>
                      <input
                        type="text"
                        value={examRollNo}
                        onChange={(e) => setExamRollNo(e.target.value.toUpperCase().slice(0, 11))}
                        className="field-input font-mono text-sm"
                        placeholder="e.g. 23012345678"
                        maxLength={11}
                      />
                    </div>

                    <div className="field-group">
                      <label className="field-label">Course</label>
                      <input
                        type="text"
                        value={course}
                        onChange={(e) => setCourse(e.target.value)}
                        className="field-input text-sm"
                        placeholder="e.g. B.Sc. (Hons)"
                      />
                    </div>

                    <div className="field-group">
                      <label className="field-label">Semester</label>
                      <input
                        type="text"
                        value={semester}
                        onChange={(e) => setSemester(e.target.value)}
                        className="field-input text-sm"
                        placeholder="e.g. IV"
                      />
                    </div>

                    <div className="field-group">
                      <label className="field-label">Major Subject</label>
                      <input
                        type="text"
                        value={majorSubject}
                        onChange={(e) => setMajorSubject(e.target.value)}
                        className="field-input text-sm"
                        placeholder="e.g. Computer Science"
                      />
                    </div>

                    <div className="field-group">
                      <label className="field-label">Batch</label>
                      <input
                        type="text"
                        value={batch}
                        onChange={(e) => setBatch(e.target.value)}
                        className="field-input text-sm"
                        placeholder="e.g. 2024-2027"
                      />
                    </div>

                    <div className="field-group sm:col-span-2">
                      <label className="field-label">Section</label>
                      <input
                        type="text"
                        value={section}
                        onChange={(e) => setSection(e.target.value)}
                        className="field-input text-sm"
                        placeholder="e.g. A"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-gradient px-6 py-2.5 text-xs font-bold flex items-center gap-2"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save Corrections</>}
                    </button>
                  </div>
                </form>
              ) : (
                /* Profile Read-Only View */
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
                        <Hash className="w-3.5 h-3.5 text-indigo-500" /> Enrollment Number
                      </span>
                      <p className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                        {enrollmentNo || prof.enrollment_no || 'N/A'}
                      </p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
                        <Hash className="w-3.5 h-3.5 text-blue-500" /> Exam Roll Number
                      </span>
                      <p className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                        {examRollNo || prof.exam_roll_no || 'N/A'}
                      </p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
                        <GraduationCap className="w-3.5 h-3.5 text-emerald-500" /> Course & Semester
                      </span>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {course || prof.course || 'N/A'} {semester || prof.semester ? `(Sem ${semester || prof.semester})` : ''}
                      </p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
                        <BookOpen className="w-3.5 h-3.5 text-amber-500" /> Major Subject
                      </span>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {majorSubject || prof.major_subject || 'N/A'}
                      </p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
                        <CalendarIcon className="w-3.5 h-3.5 text-purple-500" /> Batch & Section
                      </span>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        Batch: {batch || prof.batch || 'N/A'} {section || prof.section ? `• Sec ${section || prof.section}` : ''}
                      </p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
                        <Smartphone className="w-3.5 h-3.5 text-rose-500" /> Hardware Device Status
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`w-2 h-2 rounded-full ${prof.device_id ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {prof.device_id ? 'Device Bound (Locked)' : 'Unlinked / No Device'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 flex-wrap gap-2">
                    {prof.created_at && (
                      <span className="text-[10px] text-slate-400 font-medium">
                        Registered: {format(new Date(prof.created_at), 'MMM dd, yyyy')}
                      </span>
                    )}

                    <div className="flex items-center gap-2 ml-auto flex-wrap">
                      <button
                        type="button"
                        onClick={() => setActiveTab('calendar')}
                        className="px-3.5 py-2 text-xs font-bold bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 rounded-xl transition-colors flex items-center gap-1.5"
                      >
                        <CalendarIcon className="w-3.5 h-3.5" /> Attendance Calendar
                      </button>
                      {isEditable && (
                        <button
                          type="button"
                          onClick={() => setIsEditing(true)}
                          className="btn-gradient px-4 py-2 text-xs font-bold flex items-center gap-1.5"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Edit Profile
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )
            ) : (
              /* Attendance Calendar View */
              <div className="space-y-5">
                {/* Month Navigator Header */}
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    className="p-2 rounded-xl hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors shadow-xs"
                    title="Previous Month"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div className="text-center">
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">
                      {format(currentMonth, 'MMMM yyyy')}
                    </h4>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCurrentMonth(new Date())}
                      className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg hover:bg-indigo-100 transition-colors"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                      className="p-2 rounded-xl hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors shadow-xs"
                      title="Next Month"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Summary Stats Row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 p-3 rounded-2xl text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Present
                    </span>
                    <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                      {monthlyStats.present} <span className="text-xs font-normal">days</span>
                    </p>
                  </div>

                  <div className="bg-rose-50/60 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 p-3 rounded-2xl text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> Absent
                    </span>
                    <p className="text-xl font-bold text-rose-700 dark:text-rose-300 mt-0.5">
                      {monthlyStats.absent} <span className="text-xs font-normal">days</span>
                    </p>
                  </div>

                  <div className="bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 p-3 rounded-2xl text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center justify-center gap-1">
                      Rate
                    </span>
                    <p className="text-xl font-bold text-indigo-700 dark:text-indigo-300 mt-0.5">
                      {monthlyStats.percentage}%
                    </p>
                  </div>
                </div>

                {calendarLoading ? (
                  <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin mb-2 text-indigo-600" />
                    <span className="text-xs font-medium">Loading attendance calendar...</span>
                  </div>
                ) : (
                  <>
                    {/* Days Header */}
                    <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] text-slate-400 uppercase tracking-wider">
                      <span>Sun</span>
                      <span>Mon</span>
                      <span>Tue</span>
                      <span>Wed</span>
                      <span>Thu</span>
                      <span>Fri</span>
                      <span>Sat</span>
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7 gap-1.5">
                      {daysGrid.map((dayDate) => {
                        const dateStr = format(dayDate, 'yyyy-MM-dd');
                        const isCurrentMonthDay = isSameMonth(dayDate, currentMonth);
                        const dayStatus = dayStatusMap.get(dateStr);
                        const isSelected = selectedDay && isSameDay(selectedDay.date, dayDate);
                        const isTodayDate = isToday(dayDate);

                        let badgeBg = 'bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 border-slate-100 dark:border-slate-800';
                        
                        if (dayStatus?.status === 'present') {
                          badgeBg = 'bg-emerald-500 text-white font-bold shadow-md shadow-emerald-500/20 border-emerald-600';
                        } else if (dayStatus?.status === 'absent') {
                          badgeBg = 'bg-rose-500 text-white font-bold shadow-md shadow-rose-500/20 border-rose-600';
                        } else if (dayStatus?.status === 'partial') {
                          badgeBg = 'bg-amber-500 text-white font-bold shadow-md shadow-amber-500/20 border-amber-600';
                        }

                        return (
                          <button
                            key={dateStr}
                            type="button"
                            onClick={() => {
                              if (dayStatus && dayStatus.sessionsCount > 0) {
                                setSelectedDay(dayStatus);
                              }
                            }}
                            className={`
                              h-11 sm:h-12 rounded-xl flex flex-col items-center justify-center relative transition-all text-xs font-semibold border
                              ${badgeBg}
                              ${!isCurrentMonthDay ? 'opacity-30' : 'opacity-100'}
                              ${isTodayDate ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900' : ''}
                              ${isSelected ? 'scale-105 ring-2 ring-black dark:ring-white' : ''}
                              ${dayStatus && dayStatus.sessionsCount > 0 ? 'cursor-pointer hover:scale-105' : 'cursor-default'}
                            `}
                          >
                            <span>{format(dayDate, 'd')}</span>
                            {dayStatus?.status === 'present' && (
                              <span className="text-[8px] uppercase tracking-tighter font-black opacity-90 leading-none">Present</span>
                            )}
                            {dayStatus?.status === 'absent' && (
                              <span className="text-[8px] uppercase tracking-tighter font-black opacity-90 leading-none">Absent</span>
                            )}
                            {dayStatus?.status === 'partial' && (
                              <span className="text-[8px] uppercase tracking-tighter font-black opacity-90 leading-none">Partial</span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Selected Day Session Details */}
                    {selectedDay && selectedDay.sessionsList.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-indigo-600" />
                            Sessions on {format(selectedDay.date, 'MMMM dd, yyyy')}
                          </h5>
                          <button
                            type="button"
                            onClick={() => setSelectedDay(null)}
                            className="text-[10px] text-slate-400 hover:text-slate-600 font-bold"
                          >
                            Dismiss
                          </button>
                        </div>

                        <div className="space-y-2">
                          {selectedDay.sessionsList.map((sess, idx) => (
                            <div
                              key={sess.id || idx}
                              className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 text-xs"
                            >
                              <div>
                                <span className="font-bold text-slate-900 dark:text-white">{sess.className}</span>
                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  {format(new Date(sess.created_at), 'hh:mm a')}
                                </p>
                              </div>
                              <div>
                                {sess.attended ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold text-[10px] uppercase tracking-wider rounded-lg border border-emerald-200 dark:border-emerald-800">
                                    <CheckCircle2 className="w-3 h-3" /> Present
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-bold text-[10px] uppercase tracking-wider rounded-lg border border-rose-200 dark:border-rose-800">
                                    <XCircle className="w-3 h-3" /> Absent
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
