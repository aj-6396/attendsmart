/**
 * Copyright © 2026 Ambuj Singh & Aniket Verma. All Rights Reserved.
 * This code is proprietary and confidential. Unauthorized copying, 
 * distribution, or use is strictly prohibited.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Users, Folder, Link, LogOut, ArrowLeft as ArrowLeftIcon, Clock, MapPin, RefreshCw, CheckCircle2, XCircle, Download, BarChart3, History, Loader2, AlertCircle, Key, Search, X, Smartphone, Trash2 } from 'lucide-react';
import { getAveragedPosition } from '../lib/geo';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ThemeToggle from './ThemeToggle';

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

export default function TeacherDashboard({ user, profile, onLogout, darkMode, toggleDarkMode }: { user: any; profile: any; onLogout: () => void; darkMode: boolean; toggleDarkMode: () => void }) {
  const [classes, setClasses] = useState<any[]>([]);
  const [activeClass, setActiveClass] = useState<any | null>(null);
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [activeTab, setActiveTab] = useState<'session' | 'records'>('session');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [allStudents, setAllStudents] = useState<StudentStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [selectedPastSession, setSelectedPastSession] = useState<Session | null>(null);
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

  const handleResetDevice = async (userId: string) => {
    if (!confirm('Are you sure you want to reset this student\'s device link? They will be able to mark attendance from a new device.')) return;

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/admin/reset-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: user.id,
          targetUserId: userId
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to reset device');

      setSuccess('Student device link reset successfully!');
    } catch (err: any) {
      console.error('Error resetting device:', err);
      setError(err.message || 'Failed to reset device.');
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = allStudents.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.enrollment_no.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const fetchClasses = async () => {
      const { data: myClasses } = await supabase.from('classes').select('*').eq('created_by', user.id);
      const { data: coClasses } = await supabase.from('class_teachers').select('class_id, classes(*)').eq('teacher_id', user.id);
      const all: any[] = [...(myClasses || [])];
      if (coClasses) {
        coClasses.forEach((ct: any) => {
          if (ct.classes && !all.find(c => c.id === ct.classes.id)) all.push(ct.classes);
        });
      }
      setClasses(all);
    };
    fetchClasses();
  }, [user.id, activeClass?.id]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    console.log('Attempting to create class:', newClassName);
    
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data, error } = await supabase.from('classes').insert({
       name: newClassName,
       join_code: code,
       created_by: user.id
    }).select().single();
    
    if (error) {
       console.error('Class creation error:', error);
       setError(error.message);
    } else {
       console.log('Class created successfully:', data);
       setClasses(prev => [...prev, data]);
       setShowCreateClass(false);
       setNewClassName('');
       setSuccess('Class created successfully! Join code: ' + code);
    }
    setLoading(false);
  };

  const exportFullRegister = async () => {
    if (!activeClass) return;
    setLoading(true);
    try {
      // 1. Fetch all students in the class
      const { data: enrollmentData } = await supabase
        .from('class_enrollments')
        .select(`
          student_id,
          users:student_id(
            id,
            name,
            student_profiles(
              enrollment_no,
              exam_roll_no
            )
          )
        `)
        .eq('class_id', activeClass.id);

      // 2. Fetch all sessions for this class
      const { data: sessions } = await supabase
        .from('attendance_sessions')
        .select('id, created_at')
        .eq('class_id', activeClass.id)
        .order('created_at', { ascending: true });

      // 3. Fetch all attendance records for this class
      const { data: attendanceRecords } = await supabase
        .from('attendance_records')
        .select('student_id, session_id')
        .in('session_id', sessions?.map(s => s.id) || []);

      if (!enrollmentData || !sessions) throw new Error('No data found for export');

      // Create CSV
      const sessionDates = sessions.map(s => format(new Date(s.created_at), 'MMM dd HH:mm'));
      const headers = ['Student Name', 'Enrollment No', 'Exam Roll No', ...sessionDates, 'Total Present', '%'];
      
      const rows = enrollmentData.map((e: any) => {
        const student = Array.isArray(e.users) ? e.users[0] : e.users;
        const profile = Array.isArray(student?.student_profiles) 
          ? student?.student_profiles[0] 
          : student?.student_profiles;

        const studentAttendance = sessions.map(s => {
          const isPresent = attendanceRecords?.some(r => r.student_id === e.student_id && r.session_id === s.id);
          return isPresent ? 'P' : 'A';
        });
        
        const attendedCount = studentAttendance.filter(v => v === 'P').length;
        const percentage = sessions.length > 0 ? Math.round((attendedCount / sessions.length) * 100) : 0;
        
        return [
          student?.name || 'Unknown',
          profile?.enrollment_no || 'N/A',
          profile?.exam_roll_no || 'N/A',
          ...studentAttendance,
          attendedCount,
          `${percentage}%`
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(r => r.join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      // Sanitize filename for Windows
      const safeClassName = activeClass.name.replace(/[^a-zA-Z0-9 -]/g, '').trim();
      link.setAttribute('download', `Attendance_${safeClassName}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      
      // Cleanup to prevent memory leaks and permission errors
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
      
      setSuccess('Register exported successfully!');
    } catch (err: any) {
      console.error('Export error:', err);
      setError('Failed to export register: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportRegisterPDF = async () => {
    if (!activeClass) return;
    setLoading(true);
    try {
      // 1. Fetch data with explicit aliases and defensive selection
      const { data: enrollmentData } = await supabase
        .from('class_enrollments')
        .select(`
          student_id,
          users:student_id(
            id,
            name,
            student_profiles(
              enrollment_no,
              exam_roll_no,
              course,
              semester
            )
          )
        `)
        .eq('class_id', activeClass.id);

      const { data: sessions } = await supabase
        .from('attendance_sessions')
        .select('id, created_at')
        .eq('class_id', activeClass.id)
        .order('created_at', { ascending: true });

      const { data: attendanceRecords } = await supabase
        .from('attendance_records')
        .select('student_id, session_id')
        .in('session_id', sessions?.map(s => s.id) || ['00000000-0000-0000-0000-000000000000']);

      if (!enrollmentData || !sessions) throw new Error('Insufficient data for PDF generation');

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      
      // Header Section
      doc.setFontSize(22);
      doc.setTextColor(79, 70, 229); // indigo-600
      doc.text('Attendance Register Report', 14, 20);
      
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(`Class: ${activeClass.name}`, 14, 28);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(`Generated on: ${format(new Date(), 'PPPP p')}`, 14, 34);
      doc.text(`Join Code: ${activeClass.join_code}`, 14, 38);

      // Table Generation
      const sessionDates = sessions.map(s => format(new Date(s.created_at), 'MMM dd\nHH:mm'));
      const head = [['S.No', 'Student Information', 'Enrollment', 'Roll No', ...sessionDates, 'Score']];
      
      const body = enrollmentData.map((e: any, index: number) => {
        const student = Array.isArray(e.users) ? e.users[0] : e.users;
        const profile = Array.isArray(student?.student_profiles) 
          ? student?.student_profiles[0] 
          : student?.student_profiles;

        const sessionAttendance = sessions.map(s => {
          const present = attendanceRecords?.some(r => r.student_id === e.student_id && r.session_id === s.id);
          return present ? 'P' : 'A';
        });

        const presentCount = sessionAttendance.filter(v => v === 'P').length;
        const perc = sessions.length > 0 ? Math.round((presentCount / sessions.length) * 100) : 0;

        return [
          index + 1,
          { content: student?.name || 'Unknown', styles: { fontStyle: 'bold' } },
          profile?.enrollment_no || 'N/A',
          profile?.exam_roll_no || 'N/A',
          ...sessionAttendance,
          `${perc}%`
        ];
      });

      autoTable(doc, {
        head,
        body,
        startY: 45,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontSize: 8, halign: 'center' },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 'auto', halign: 'left' },
          2: { cellWidth: 25, halign: 'center' },
          3: { cellWidth: 25, halign: 'center' },
          [head[0].length - 1]: { halign: 'center', fontStyle: 'bold' }
        },
        styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak', halign: 'center' },
        didParseCell: (data) => {
          if (data.section === 'body' && data.cell.text[0] === 'P') data.cell.styles.textColor = [16, 185, 129];
          if (data.section === 'body' && data.cell.text[0] === 'A') data.cell.styles.textColor = [239, 68, 68];
        }
      });

      doc.save(`Attendance_${activeClass.name.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      setSuccess('PDF Report generated successfully!');
    } catch (err: any) {
      console.error('PDF Export Error:', err);
      setError('Failed to generate PDF: ' + err.message);
    } finally {
      setLoading(false);
    }
  };


  const fetchSessions = useCallback(async () => {
    if (!activeClass) return;
    const { data, error } = await supabase
      .from('attendance_sessions')
      .select('*')
      .eq('class_id', activeClass.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching sessions:', error);
    } else {
      setSessions(data || []);
      const active = data?.find(s => s.active && new Date(s.expires_at) > new Date());
      setActiveSession(active || null);
    }
  }, [activeClass?.id]);

  useEffect(() => {
    fetchSessions();

    // Realtime subscription
    const channel = supabase
      .channel('sessions_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_sessions', filter: `class_id=eq.${activeClass?.id}` }, (payload) => {
        fetchSessions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id, activeClass?.id]);

  const fetchAttendance = useCallback(async () => {
    const sessionToFetch = selectedPastSession || activeSession;
    if (!sessionToFetch) return;
    const { data, error } = await supabase
      .from('attendance_records')
      .select(`
        *, 
        users:student_id(
          id,
          name, 
          student_profiles(
            enrollment_no, 
            exam_roll_no
          )
        )
      `)
      .eq('session_id', sessionToFetch.id);

    if (error) console.error('Error fetching attendance:', error);
    else setAttendance(data as any || []);
  }, [activeSession, selectedPastSession]);

  useEffect(() => {
    if (selectedPastSession) {
      fetchAttendance();
    } else if (activeSession) {
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
  }, [activeSession, selectedPastSession, fetchAttendance]);

  useEffect(() => {
    if (activeTab === 'records') {
      fetchAllStudentStats();
    }
  }, [activeTab, activeClass?.id]);

  useEffect(() => {
    // Clear student stats when switching classes to prevent ghost data
    setAllStudents([]);
  }, [activeClass?.id]);


  const fetchAllStudentStats = async () => {
    try {
      setLoading(true);
      if (!activeClass) return;

      const { data: enrollments, error: enrollError } = await supabase
        .from('class_enrollments')
        .select(`
          student_id,
          users:student_id(
            id,
            name,
            student_profiles(
              enrollment_no,
              exam_roll_no,
              semester,
              major_subject,
              course
            )
          )
        `)
        .eq('class_id', activeClass.id);

      if (enrollError) throw enrollError;
      
      console.log('DEBUG: Enrollments fetched:', enrollments);

      const enrolledStudents = (enrollments || []).map((e: any) => {
        // Handle cases where users might be returned as an array or a single object
        const userData = Array.isArray(e.users) ? e.users[0] : e.users;
        // student_profiles is a 1-to-1 relation, so it's usually returned as an object, not an array
        const profileData = Array.isArray(userData?.student_profiles) 
          ? userData?.student_profiles[0] 
          : userData?.student_profiles;
          
        return {
          id: userData?.id,
          name: userData?.name,
          profile: profileData
        };
      }).filter((s: any) => s.id);

      console.log('DEBUG: Enrolled Students Mapped:', enrolledStudents);

      const { data: classSessions, error: sessionError } = await supabase
        .from('attendance_sessions')
        .select('id')
        .eq('class_id', activeClass.id);

      if (sessionError) throw sessionError;
      const sessionIds = (classSessions || []).map((s: any) => s.id);

      const { data: records, error: recordError } = await supabase
        .from('attendance_records')
        .select('student_id, session_id')
        .in('session_id', sessionIds.length > 0 ? sessionIds : ['00000000-0000-0000-0000-000000000000']);

      if (recordError) throw recordError;

      const stats: StudentStats[] = enrolledStudents.map((student: any) => {
        const studentRecords = (records || []).filter((r: any) => r.student_id === student.id);
        const attendedCount = studentRecords.length;
        const totalCount = sessionIds.length;
        return {
          id: student.id,
          name: student.name || 'Unknown',
          enrollment_no: student.profile?.enrollment_no || 'N/A',
          exam_roll_no: student.profile?.exam_roll_no,
          semester: student.profile?.semester,
          major_subject: student.profile?.major_subject,
          total_sessions: totalCount,
          attended_sessions: attendedCount,
          attendance_percentage: totalCount > 0 ? (attendedCount / totalCount) * 100 : 0
        };
      });

      setAllStudents(stats.sort((a: any, b: any) => b.attendance_percentage - a.attendance_percentage));
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
        body: JSON.stringify({ teacherId: user.id, classId: activeClass?.id, lat: pos.latitude, lng: pos.longitude, accuracy: pos.accuracy })
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
    if (!confirm('Are you sure you want to terminate this live session? Students will no longer be able to mark attendance.')) return;
    
    // Optimistic UI Update: Close the UI immediately
    const previousActiveSession = activeSession;
    setActiveSession(null);
    
    try {
      setLoading(true);
      // Deactivate ALL active sessions for this class to ensure a clean slate
      const { error } = await supabase
        .from('attendance_sessions')
        .update({ active: false })
        .eq('class_id', activeClass.id)
        .eq('active', true);
      
      if (error) throw error;
      setSuccess('All active sessions for this class have been terminated.');
      await fetchSessions(); // Final sync with DB
    } catch (err: any) {
      console.error('Error ending session:', err);
      // Rollback optimistic update on error
      setActiveSession(previousActiveSession);
      setError('Failed to terminate session: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm('CRITICAL ACTION: Are you sure you want to permanently delete this session? All attendance records tied to it will also be deleted. This cannot be undone.')) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('attendance_sessions')
        .delete()
        .eq('id', sessionId)
        .select();
        
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Unable to delete. You may not have permission (you must be the creator).");
      }
      
      setSuccess('Session deleted successfully.');
      if (activeSession?.id === sessionId) setActiveSession(null);
      if (selectedPastSession?.id === sessionId) setSelectedPastSession(null);
      await fetchSessions();
      await fetchAllStudentStats();
    } catch (err: any) {
      console.error('Error deleting session:', err);
      setError('Failed to delete session: ' + err.message);
    } finally {
      setLoading(false);
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
        const studentProfileData = a.users.student_profiles;
        const studentProfile = Array.isArray(studentProfileData) ? studentProfileData[0] : studentProfileData;
        return [
          a.users.name || 'Unknown',
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
    
    // Cleanup to prevent memory leaks and permission errors
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  };

  return (
    <div className="space-y-8 page-container">
      {/* Global Status Messages */}
      <AnimatePresence>
        {(error || success) && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-4 z-[100] max-w-sm w-full"
          >
            {error && (
              <div className="alert alert--error shadow-2xl">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">{error}</p>
                <button onClick={() => setError(null)} className="ml-auto">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {success && (
              <div className="glass-card--success border-l-4 p-4 flex items-center gap-3 shadow-2xl">
                <CheckCircle2 className="w-5 h-5 text-[--color-success] flex-shrink-0" />
                <p className="text-sm text-[--color-success]">{success}</p>
                <button onClick={() => setSuccess(null)} className="ml-auto">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!activeClass ? (
        <motion.div 
          key="class-list"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black flex items-center gap-3 text-slate-900">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
                <Folder className="w-6 h-6 text-white" />
              </div>
              My Classes
            </h2>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowCreateClass(true)} 
                className="btn-gradient px-6 py-2.5 flex items-center gap-2 shadow-lg shadow-indigo-200"
              >
                <Plus className="w-5 h-5" />
                Create Class
              </button>
              <ThemeToggle darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
              <button 
                onClick={onLogout}
                className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-red-50 transition-all text-slate-500 hover:text-red-600 shadow-sm"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>

          {showCreateClass && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-6 border-indigo-100 bg-white/50 backdrop-blur-md"
            >
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-4">Create New Class</h3>
              <form onSubmit={handleCreateClass} className="flex flex-col sm:flex-row gap-4">
                <input 
                  type="text" 
                  value={newClassName} 
                  onChange={e => setNewClassName(e.target.value)} 
                  placeholder="e.g. Mathematics Sem-2" 
                  className="field-input flex-1" 
                  required 
                />
                <div className="flex gap-2">
                  <button disabled={loading} type="submit" className="btn-gradient px-8">
                    {loading ? <Loader2 className="animate-spin mx-auto w-5 h-5"/> : 'Create'}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowCreateClass(false)} 
                    className="px-6 py-2.5 border border-slate-200 rounded-xl font-bold text-slate-500 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map(c => (
               <motion.div 
                 key={c.id} 
                 whileHover={{ y: -5 }}
                 onClick={() => setActiveClass(c)} 
                 className="glass-card p-6 cursor-pointer hover:border-indigo-400 transition-all hover:shadow-2xl group border-2 border-transparent"
               >
                 <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Folder className="w-6 h-6 text-indigo-600" />
                 </div>
                 <h3 className="text-xl font-black text-slate-900 mb-2 truncate">{c.name}</h3>
                 <div className="flex items-center gap-2">
                   <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-500 px-2 py-1 rounded-md tracking-widest">Code: {c.join_code}</span>
                   {c.created_by !== user.id && <span className="text-[10px] font-black uppercase bg-indigo-100 text-indigo-600 px-2 py-1 rounded-md tracking-widest">Co-Teacher</span>}
                 </div>
               </motion.div>
            ))}
            {classes.length === 0 && !showCreateClass && (
               <div className="col-span-full py-20 text-center glass-card border-dashed border-2">
                 <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Folder className="w-8 h-8 text-slate-300" />
                 </div>
                 <h3 className="text-slate-900 font-bold">No Classes Yet</h3>
                 <p className="text-slate-500 text-sm mt-1">Start by creating your first academic class.</p>
               </div>
            )}
          </div>
        </motion.div>
      ) : (
        <motion.div 
          key="dashboard-view"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-8"
        >
          {/* Class Header */}
          <div className="flex items-center justify-between bg-white px-6 py-5 rounded-3xl shadow-sm border border-slate-100">
             <div className="flex items-center gap-4">
               <button 
                 onClick={() => setActiveClass(null)} 
                 className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 rounded-xl text-slate-400 hover:text-indigo-600 transition-colors"
               >
                  <ArrowLeftIcon className="w-6 h-6" />
               </button>
               <div>
                 <h2 className="text-2xl font-black text-slate-900 leading-none mb-1">{activeClass.name}</h2>
                 <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Class Access Code:</span>
                    <span className="text-[11px] font-black text-indigo-600 font-mono bg-indigo-50 px-2 py-0.5 rounded">{activeClass.join_code}</span>
                 </div>
               </div>
             </div>
             <div className="flex items-center gap-2">
                 <div className="hidden sm:flex flex-col items-end">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Status</span>
                    <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded mt-1">Authorized</span>
                 </div>
                 <ThemeToggle darkMode={darkMode} toggleDarkMode={toggleDarkMode} className="ml-2" />
                 <button 
                   onClick={onLogout}
                   className="p-2.5 bg-white border border-slate-100 rounded-xl hover:bg-red-50 transition-all text-slate-400 hover:text-red-600 shadow-sm ml-2"
                   title="Logout"
                 >
                   <LogOut className="w-5 h-5" />
                 </button>
             </div>
          </div>

          <div className="flex gap-2 p-1.5 bg-slate-100/50 rounded-2xl w-fit">
            <button
              onClick={() => setActiveTab('session')}
              className={cn(
                "px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2",
                activeTab === 'session' 
                  ? "bg-white text-indigo-600 shadow-sm" 
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              <Clock className="w-4 h-4" />
              Live Session
            </button>
            <button
              onClick={() => setActiveTab('records')}
              className={cn(
                "px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2",
                activeTab === 'records' 
                  ? "bg-white text-indigo-600 shadow-sm" 
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              <BarChart3 className="w-4 h-4" />
              Records
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
                    <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                       <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                          <Clock className="w-5 h-5 text-indigo-600" />
                       </div>
                       Current Session
                    </h2>
                    {!activeSession && (
                      <button
                        onClick={createSession}
                        disabled={loading}
                        className="btn-gradient disabled:opacity-50 px-6 py-2.5 flex items-center gap-2 shadow-lg shadow-indigo-100"
                      >
                        {loading ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="text-sm font-bold">{samplingProgress ? `${samplingProgress.current}/${samplingProgress.total}` : 'Starting...'}</span>
                          </div>
                        ) : (
                          <>
                            <Plus className="w-5 h-5" />
                            Start Session
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {(activeSession || selectedPastSession) ? (
                    <div className="glass-card overflow-hidden">
                      <div className="bg-[#0f172a] dark:bg-black p-8 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                           <Clock className="w-32 h-32" />
                        </div>
                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                          {selectedPastSession ? (
                            <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div>
                                <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em] mb-3">Historical View</p>
                                <h3 className="text-4xl sm:text-5xl font-black tracking-tighter text-white">Record for {format(new Date(selectedPastSession.created_at), 'MMM dd, yyyy')}</h3>
                              </div>
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => deleteSession(selectedPastSession.id)}
                                  className="px-6 py-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl font-bold transition-all text-sm uppercase tracking-widest whitespace-nowrap"
                                >
                                  {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Delete Record'}
                                </button>
                                <button 
                                  onClick={() => setSelectedPastSession(null)}
                                  className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-bold transition-all text-sm uppercase tracking-widest whitespace-nowrap"
                                >
                                  Close View
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div>
                                <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em] mb-3">Entrance Code</p>
                                <h3 className="text-7xl font-black tracking-tighter text-white font-mono">{activeSession?.otp}</h3>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
                                  <MapPin className="w-4 h-4 text-emerald-400 mb-2" />
                                  <p className="text-[10px] text-white/40 uppercase font-black tracking-widest">Precision</p>
                                  <p className="text-lg font-black">{locationAccuracy ? `${Math.round(locationAccuracy)}m` : '--'}</p>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
                                  <Clock className="w-4 h-4 text-amber-400 mb-2" />
                                  <p className="text-[10px] text-white/40 uppercase font-black tracking-widest">Ends In</p>
                                  <p className="text-lg font-black font-mono">{activeSession ? format(new Date(activeSession.expires_at), 'HH:mm') : '--'}</p>
                                </div>
                                <div className="bg-indigo-500 rounded-2xl p-4 shadow-xl shadow-indigo-900/20 col-span-2 sm:col-span-1">
                                  <Users className="w-4 h-4 text-white/80 mb-2" />
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-black">{attendance.length}</span>
                                    <span className="text-[10px] text-white/60 font-black uppercase">Present</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-4">
                                <button
                                  onClick={() => endSession(activeSession!.id)}
                                  disabled={loading}
                                  className={cn(
                                    "flex-1 px-8 py-4 rounded-2xl font-black transition-all text-xs uppercase tracking-widest border-2",
                                    "bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500 hover:text-white",
                                    "dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/40 dark:hover:bg-amber-600 dark:hover:text-white dark:hover:shadow-[0_0_20px_rgba(245,158,11,0.4)]"
                                  )}
                                >
                                  {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Terminate'}
                                </button>
                                <button
                                  onClick={() => deleteSession(activeSession!.id)}
                                  disabled={loading}
                                  className={cn(
                                    "flex-1 px-8 py-4 rounded-2xl font-black transition-all text-xs uppercase tracking-widest border-2",
                                    "bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500 hover:text-white",
                                    "dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/40 dark:hover:bg-red-600 dark:hover:text-white dark:hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                                  )}
                                >
                                  {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Delete Error'}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="p-8">
                        <div className="flex items-center justify-between mb-6">
                           <h4 className="text-sm font-black uppercase tracking-widest text-slate-400">Presence Log</h4>
                           <button onClick={exportAttendance} disabled={attendance.length === 0} className="text-xs font-black uppercase text-indigo-600 flex items-center gap-2 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-colors">
                              <Download className="w-4 h-4" /> Export CSV
                           </button>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                                <th className="pb-4 text-left">Student Name</th>
                                <th className="pb-4 text-left">Enrollment</th>
                                <th className="pb-4 text-left">Log Time</th>
                              </tr>
                            </thead>
                            <tbody>
                              {attendance.map((record) => (
                                <tr key={record.id} className="border-b border-slate-50/50 hover:bg-slate-50/50 transition-colors">
                                  <td className="py-4 font-bold text-slate-900">{record.users.name}</td>
                                  <td className="py-4 text-slate-500 font-mono text-xs">{(record.users.student_profiles as any)?.[0]?.enrollment_no}</td>
                                  <td className="py-4 text-right text-slate-400 text-xs font-mono">{format(new Date(record.created_at), 'HH:mm:ss')}</td>
                                </tr>
                              ))}
                              {attendance.length === 0 && (
                                <tr>
                                  <td colSpan={3} className="py-12 text-center text-slate-400 italic text-sm">Awaiting first check-in...</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white/50 border-2 border-dashed border-slate-200 rounded-[2rem] p-16 text-center">
                       <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                          <Users className="w-10 h-10 text-slate-300" />
                       </div>
                       <h3 className="text-xl font-black text-slate-900 mb-2">Ready to Start</h3>
                       <p className="text-slate-500 text-sm max-w-sm mx-auto mb-8">Click start to generate a time-locked entrance code for this specific classroom.</p>
                       <button onClick={createSession} className="btn-gradient px-10 py-3 shadow-xl shadow-indigo-200">Start Session Now</button>
                    </div>
                  )}
                </section>
                
                {/* Secondary History Section in Session Tab */}
                <section>
                   <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                       <History className="w-4 h-4" /> Past Sessions
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                     {sessions.filter(s => !s.active || new Date(s.expires_at) <= new Date()).map(s => (
                        <button 
                          key={s.id} 
                          onClick={() => setSelectedPastSession(s)}
                          className={cn(
                            "glass-card p-4 border text-left transition-all group",
                            selectedPastSession?.id === s.id ? "border-[--color-primary] shadow-lg shadow-[--color-primary]/20 ring-1 ring-[--color-primary]" : "border-slate-100 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"
                          )}
                        >
                           <div className="flex items-center justify-between mb-2">
                              <span className={cn(
                                "text-[10px] font-black transition-colors",
                                selectedPastSession?.id === s.id ? "text-[--color-primary]" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                              )}>
                                {format(new Date(s.created_at), 'MMM dd, yyyy')}
                              </span>
                              <span className="text-xs font-black text-slate-900 font-mono dark:text-white">{s.otp}</span>
                           </div>
                           <p className="text-[10px] text-slate-500 uppercase tracking-widest flex justify-between items-center">
                             <span>Legacy Record</span>
                             <span className={cn(
                               "opacity-0 text-[10px] font-bold group-hover:opacity-100 transition-opacity",
                               selectedPastSession?.id === s.id ? "opacity-100 text-[--color-primary]" : "text-indigo-500"
                             )}>
                               View →
                             </span>
                           </p>
                        </button>
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
                <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
                  <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
                     <div>
                        <h3 className="text-xl font-black text-slate-900">Attendance Register</h3>
                        <p className="text-xs text-slate-500 mt-1 font-medium">Tracking {filteredStudents.length} enrolled students</p>
                     </div>
                     <div className="flex items-center gap-4">
                        <div className="relative group">
                           <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-600 transition-colors" />
                           <input 
                             type="text" 
                             value={searchQuery}
                             onChange={e => setSearchQuery(e.target.value)}
                             placeholder="Search roster..." 
                             className="pl-11 pr-6 py-3 bg-slate-50 border-transparent focus:bg-white focus:border-indigo-200 rounded-2xl text-sm outline-none w-full sm:w-64 transition-all"
                           />
                        </div>
                        <button 
                         onClick={exportRegisterPDF} 
                         disabled={loading || filteredStudents.length === 0}
                         className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl hover:bg-black transition-all font-black text-sm shadow-xl shadow-slate-200 disabled:opacity-50"
                        >
                           <Download className="w-5 h-5" />
                           Download PDF
                        </button>
                        <button 
                         onClick={exportFullRegister} 
                         disabled={loading || filteredStudents.length === 0}
                         className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 transition-all font-bold text-sm"
                         title="Export CSV"
                        >
                           <Folder className="w-5 h-5" />
                           CSV
                        </button>
                        <button onClick={fetchAllStudentStats} className={cn("p-3 bg-slate-50 rounded-2xl hover:bg-indigo-50 transition-colors", loading && "animate-spin")}>
                           <RefreshCw className="w-5 h-5 text-indigo-600" />
                        </button>
                        <button 
                         onClick={onLogout}
                         className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-red-50 transition-all text-slate-500 hover:text-red-600 shadow-sm"
                         title="Logout"
                        >
                           <LogOut className="w-5 h-5" />
                        </button>
                     </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50/50">
                          <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-left">Student Information</th>
                          <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-left">Enrollment</th>
                          <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Score</th>
                          <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredStudents.map(student => (
                          <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-8 py-6">
                               <div className="text-slate-900 font-bold">{student.name}</div>
                               <div className="text-[10px] text-slate-400 uppercase font-black mt-1">Sem {student.semester || 'N/A'} • {student.major_subject || 'General'}</div>
                            </td>
                            <td className="px-8 py-6 font-mono text-[13px] text-slate-500">{student.enrollment_no}</td>
                            <td className="px-8 py-6">
                               <div className="flex flex-col items-center">
                                  <span className={cn(
                                    "text-lg font-black",
                                    student.attendance_percentage >= 75 ? "text-emerald-500" : 
                                    student.attendance_percentage >= 50 ? "text-amber-500" : "text-red-500"
                                  )}>
                                     {Math.round(student.attendance_percentage)}%
                                  </span>
                                  <div className="w-16 h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                                     <div className={cn("h-full rounded-full transition-all duration-1000", student.attendance_percentage >= 75 ? "bg-emerald-500" : "bg-red-500")} style={{ width: `${student.attendance_percentage}%` }} />
                                  </div>
                               </div>
                            </td>
                            <td className="px-8 py-6 text-right">
                               <div className="flex items-center justify-end gap-2">
                                  {activeSession && !attendance.find(a => a.student_id === student.id) && (
                                     <button 
                                       onClick={() => manualMarkAttendance(student.id)}
                                       className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-200"
                                     >
                                        Mark Present
                                     </button>
                                  )}
                                  <button onClick={() => handleResetDevice(student.id)} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors" title="Reset Device Link">
                                     <Smartphone className="w-5 h-5" />
                                  </button>
                                  <button onClick={() => setResettingUserId(student.id)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors" title="Access Recovery">
                                     <Key className="w-5 h-5" />
                                  </button>
                               </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Password Reset Modal (Redesigned) */}
                <AnimatePresence>
                  {resettingUserId && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
                       <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setResettingUserId(null)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-xl" />
                       <motion.div initial={{ opacity: 0, scale: 0.9, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 30 }} className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm p-10">
                          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mb-8 shadow-xl shadow-indigo-200">
                             <Key className="w-8 h-8 text-white" />
                          </div>
                          <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Access Recovery</h3>
                          <p className="text-slate-500 text-sm mb-8 leading-relaxed">Enter a new 6-digit security PIN for this student's account.</p>
                          <div className="space-y-6">
                             <input 
                               type="password" 
                               value={newPassword}
                               onChange={e => setNewPassword(e.target.value.replace(/\D/g, '').slice(0, 6))}
                               className="w-full text-center text-3xl font-black tracking-[0.5em] py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-600 rounded-2xl outline-none"
                               placeholder="******"
                               maxLength={6}
                             />
                             <div className="flex gap-4">
                                <button onClick={() => setResettingUserId(null)} className="flex-1 py-4 text-xs font-black uppercase text-slate-400 hover:text-slate-600">Cancel</button>
                                <button onClick={() => handleResetPassword(resettingUserId)} disabled={loading || !/^\d{6}$/.test(newPassword)} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-200 disabled:opacity-50">Confirm</button>
                             </div>
                          </div>
                       </motion.div>
                    </div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

