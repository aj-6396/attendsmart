/**
 * Copyright © 2026 Ambuj Singh. All Rights Reserved.
 * This code is proprietary and confidential. Unauthorized copying, 
 * distribution, or use is strictly prohibited.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { authFetch } from '../lib/authFetch';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Users, Folder, Link, LogOut, ArrowLeft as ArrowLeftIcon, Clock, MapPin, RefreshCw, CheckCircle2, XCircle, Download, BarChart3, History, Loader2, AlertCircle, Key, Search, X, Smartphone, Trash2, ShieldCheck, FileText } from 'lucide-react';
import { getAveragedPosition } from '../lib/geo';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ThemeToggle from './ThemeToggle';
import { downloadFile } from '../lib/fileDownload';
import { useBackButton } from '../lib/backButton';

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
  manual?: boolean;
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

  // Android Back Button handlers
  useBackButton(() => {
    if (resettingUserId !== null) {
      setResettingUserId(null);
      setNewPassword('');
      return true;
    }
    return false;
  }, resettingUserId !== null, 60);

  useBackButton(() => {
    if (selectedPastSession !== null) {
      setSelectedPastSession(null);
      return true;
    }
    return false;
  }, selectedPastSession !== null, 55);

  useBackButton(() => {
    if (showCreateClass) {
      setShowCreateClass(false);
      setNewClassName('');
      return true;
    }
    return false;
  }, showCreateClass, 50);

  useBackButton(() => {
    if (activeClass !== null) {
      setActiveClass(null);
      setActiveSession(null);
      setSelectedPastSession(null);
      return true;
    }
    return false;
  }, activeClass !== null && !showCreateClass && selectedPastSession === null && resettingUserId === null, 30);

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

      const response = await authFetch('/api/admin/reset-password', {
        method: 'POST',
        body: JSON.stringify({
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

      const response = await authFetch('/api/admin/reset-device', {
        method: 'POST',
        body: JSON.stringify({
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
    
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data, error } = await supabase.from('classes').insert({
       name: newClassName.trim(),
       join_code: code,
       created_by: user.id
    }).select().single();
    
    if (error) {
       console.error('Class creation error:', error);
       setError(error.message);
    } else {
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
      const sessionDates = sessions.map(s => format(new Date(s.created_at), 'yyyy-MM-dd'));
      const headers = ['Student Name', 'Enrollment No', 'Exam Roll No', ...sessionDates, 'Total Present', '%'];
      
      const sortedEnrollmentData = [...enrollmentData].sort((a: any, b: any) => {
        const studentA = Array.isArray(a.users) ? a.users[0] : a.users;
        const profileA = Array.isArray(studentA?.student_profiles) 
          ? studentA?.student_profiles[0] 
          : studentA?.student_profiles;

        const studentB = Array.isArray(b.users) ? b.users[0] : b.users;
        const profileB = Array.isArray(studentB?.student_profiles) 
          ? studentB?.student_profiles[0] 
          : studentB?.student_profiles;

        const rollA = (profileA?.exam_roll_no ?? '').trim();
        const rollB = (profileB?.exam_roll_no ?? '').trim();

        if (!rollA && !rollB) return 0;
        if (!rollA) return 1;
        if (!rollB) return -1;

        return rollA.localeCompare(rollB, undefined, { numeric: true, sensitivity: 'base' });
      });

      const rows = sortedEnrollmentData.map((e: any) => {
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

      const safeClassName = activeClass.name.replace(/[^a-zA-Z0-9 -]/g, '').trim();
      await downloadFile(`Attendance_${safeClassName}_${format(new Date(), 'yyyy-MM-dd')}.csv`, csvContent, 'text/csv;charset=utf-8;');
      
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
      doc.setTextColor(0, 33, 71);
      doc.text('Attendance Register Report', 14, 20);
      
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text(`Class: ${activeClass.name}`, 14, 28);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated on: ${format(new Date(), 'PPPP')}`, 14, 34);
      doc.text(`Join Code: ${activeClass.join_code}`, 14, 38);

      const sessionDates = sessions.map(s => format(new Date(s.created_at), 'yyyy-MM-dd'));
      const head = [['S.No', 'Student Information', 'Enrollment', 'Roll No', ...sessionDates, 'Score']];
      
      const sortedPdfEnrollmentData = [...enrollmentData].sort((a: any, b: any) => {
        const studentA = Array.isArray(a.users) ? a.users[0] : a.users;
        const profileA = Array.isArray(studentA?.student_profiles) 
          ? studentA?.student_profiles[0] 
          : studentA?.student_profiles;

        const studentB = Array.isArray(b.users) ? b.users[0] : b.users;
        const profileB = Array.isArray(studentB?.student_profiles) 
          ? studentB?.student_profiles[0] 
          : studentB?.student_profiles;

        const rollA = (profileA?.exam_roll_no ?? '').trim();
        const rollB = (profileB?.exam_roll_no ?? '').trim();

        if (!rollA && !rollB) return 0;
        if (!rollA) return 1;
        if (!rollB) return -1;

        return rollA.localeCompare(rollB, undefined, { numeric: true, sensitivity: 'base' });
      });

      const body = sortedPdfEnrollmentData.map((e: any, index: number) => {
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
        headStyles: { fillColor: [0, 33, 71], textColor: [255, 255, 255], fontSize: 8, halign: 'center' },
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

      const pdfBlob = doc.output('blob');
      const safeClassName = activeClass.name.replace(/[^a-zA-Z0-9]/g, '_');
      await downloadFile(`Attendance_${safeClassName}_${format(new Date(), 'yyyy-MM-dd')}.pdf`, pdfBlob, 'application/pdf');
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

    const channel = supabase
      .channel('sessions_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_sessions', filter: `class_id=eq.${activeClass?.id}` }, () => {
        fetchSessions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id, activeClass?.id, fetchSessions]);

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
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance_records', filter: `session_id=eq.${activeSession.id}` }, () => {
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

      const enrolledStudents = (enrollments || []).map((e: any) => {
        const userData = Array.isArray(e.users) ? e.users[0] : e.users;
        const profileData = Array.isArray(userData?.student_profiles) 
          ? userData?.student_profiles[0] 
          : userData?.student_profiles;
          
        return {
          id: userData?.id,
          name: userData?.name,
          profile: profileData
        };
      }).filter((s: any) => s.id);

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
      
      const response = await authFetch('/api/sessions/create', {
        method: 'POST',
        body: JSON.stringify({ classId: activeClass?.id, lat: pos.latitude, lng: pos.longitude, accuracy: pos.accuracy })
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
    
    const previousActiveSession = activeSession;
    setActiveSession(null);
    
    try {
      setLoading(true);
      const { error } = await supabase
        .from('attendance_sessions')
        .update({ active: false })
        .eq('class_id', activeClass.id)
        .eq('active', true);
      
      if (error) throw error;
      setSuccess('All active sessions for this class have been terminated.');
      await fetchSessions();
    } catch (err: any) {
      console.error('Error ending session:', err);
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
    const sessionToMark = activeSession || selectedPastSession;
    if (!sessionToMark) return;
    try {
      setLoading(true);
      const response = await authFetch('/api/attendance/manual', {
        method: 'POST',
        body: JSON.stringify({
          studentId,
          sessionId: sessionToMark.id
        })
      });
      if (!response.ok) throw new Error('Failed to mark manually');
      setSuccess('Student marked present manually.');
      fetchAllStudentStats();
      fetchAttendance();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportAttendance = async () => {
    if (attendance.length === 0) return;
    try {
      const sortedAttendance = [...attendance].sort((a: any, b: any) => {
        const profileAData = a.users?.student_profiles;
        const profileA = Array.isArray(profileAData) ? profileAData[0] : profileAData;
        const profileBData = b.users?.student_profiles;
        const profileB = Array.isArray(profileBData) ? profileBData[0] : profileBData;

        const rollA = (profileA?.exam_roll_no ?? '').trim();
        const rollB = (profileB?.exam_roll_no ?? '').trim();

        if (!rollA && !rollB) return 0;
        if (!rollA) return 1;
        if (!rollB) return -1;

        return rollA.localeCompare(rollB, undefined, { numeric: true, sensitivity: 'base' });
      });

      const csvContent = [
        ['Student Name', 'Enrollment No', 'Exam Roll No', 'Timestamp'],
        ...sortedAttendance.map(a => {
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

      await downloadFile(`attendance_${format(new Date(), 'yyyy-MM-dd')}.csv`, csvContent, 'text/csv;charset=utf-8;');
      setSuccess('Session attendance CSV exported successfully!');
    } catch (err: any) {
      console.error('Session CSV export error:', err);
      setError('Failed to export session CSV: ' + (err.message || err));
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Global Status Messages */}
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

      {!activeClass ? (
        <motion.div 
          key="class-list"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-5 sm:space-y-6"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#002147] dark:bg-blue-600 flex items-center justify-center text-white shrink-0">
                <Folder className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Faculty Portal</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Manage classes and live attendance</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
              <button 
                onClick={() => setShowCreateClass(true)} 
                className="btn-gradient px-4 py-2.5 flex items-center gap-2 text-xs sm:text-sm font-bold flex-1 sm:flex-none"
              >
                <Plus className="w-4 h-4" />
                Create Class
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

          {/* Create Class Modal / Bottom Sheet */}
          {showCreateClass && (
            <div className="modal-overlay" onClick={() => setShowCreateClass(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="sheet-drag-handle sm:hidden" />
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-[--color-text-primary]">Create Academic Class</h3>
                  <button onClick={() => setShowCreateClass(false)} className="p-1 text-slate-400 hover:text-slate-600 touch-target">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleCreateClass} className="space-y-4">
                  <div className="field-group">
                    <label className="field-label">Class Name</label>
                    <input 
                      type="text" 
                      value={newClassName} 
                      onChange={e => setNewClassName(e.target.value)} 
                      placeholder="e.g. Mathematics - Semester 2" 
                      className="field-input" 
                      autoFocus
                      required 
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button disabled={loading || !newClassName.trim()} type="submit" className="btn-gradient flex-1 font-bold">
                      {loading ? <Loader2 className="animate-spin mx-auto w-5 h-5"/> : 'Create Class'}
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setShowCreateClass(false)} 
                      className="btn-outlined px-4"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {classes.map(c => (
               <motion.div 
                 key={c.id} 
                 whileTap={{ scale: 0.98 }}
                 onClick={() => setActiveClass(c)} 
                 className="glass-card p-5 sm:p-6 cursor-pointer hover:border-blue-500/50 transition-all hover:shadow-md group active:scale-[0.98]"
               >
                 <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform border border-blue-100 dark:border-blue-900/40">
                    <Folder className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                 </div>
                 <h3 className="text-lg font-bold text-[--color-text-primary] mb-2 truncate">{c.name}</h3>
                 <div className="flex items-center gap-2 flex-wrap">
                   <span className="text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-md text-slate-700 dark:text-slate-300">Code: {c.join_code}</span>
                   {c.created_by !== user.id && (
                     <span className="text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-md">Co-Teacher</span>
                   )}
                 </div>
               </motion.div>
            ))}
            {classes.length === 0 && !showCreateClass && (
               <div className="col-span-full py-16 text-center glass-card">
                 <Folder className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                 <h3 className="text-slate-900 dark:text-white font-bold">No Classes Created</h3>
                 <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Start by creating your first academic class.</p>
                 <button onClick={() => setShowCreateClass(true)} className="mt-3 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
                   + Create Class
                 </button>
               </div>
            )}
          </div>
        </motion.div>
      ) : (
        <motion.div 
          key="class-active"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          {/* Active Class Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-800 p-3.5 sm:p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 min-w-0">
              <button 
                onClick={() => { setActiveClass(null); setActiveSession(null); setSelectedPastSession(null); }} 
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white shrink-0 touch-target"
                title="Back to classes"
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h2 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white truncate">{activeClass.name}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">Join Code: {activeClass.join_code}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <ThemeToggle darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
              <button 
                onClick={onLogout}
                className="p-2 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition-colors touch-target"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl">
            <button 
              onClick={() => setActiveTab('session')}
              className={cn(
                "py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all min-h-[44px]",
                activeTab === 'session' ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
              )}
            >
              <Clock className="w-4 h-4" />
              <span>Live Session</span>
            </button>
            <button 
              onClick={() => setActiveTab('records')}
              className={cn(
                "py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all min-h-[44px]",
                activeTab === 'records' ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
              )}
            >
              <Users className="w-4 h-4" />
              <span>Roster & Records</span>
            </button>
          </div>

          {/* Session Tab Content */}
          {activeTab === 'session' && (
            <div className="space-y-6">
              {!activeSession && !selectedPastSession && (
                <div className="glass-card p-6 sm:p-10 text-center">
                  <Clock className="w-12 h-12 mx-auto text-blue-600 dark:text-blue-400 mb-3" />
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Active Attendance Session</h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
                    Start a GPS-verified attendance session to generate an entrance code for students in your classroom.
                  </p>
                  <button 
                    onClick={createSession} 
                    disabled={loading} 
                    className="btn-gradient px-8 py-3.5 text-sm font-bold shadow-lg"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{samplingProgress ? `Sampling GPS (${samplingProgress.current}/${samplingProgress.total})...` : 'Creating Session...'}</span>
                      </div>
                    ) : (
                      <>
                        <Plus className="w-5 h-5" />
                        <span>Start New Session</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {(activeSession || selectedPastSession) && (
                <div className="glass-card overflow-hidden p-0">
                  <div className="bg-[#002147] dark:bg-slate-900 p-4 sm:p-8 text-white">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {selectedPastSession ? (
                        <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <span className="text-[10px] uppercase font-bold tracking-wider text-blue-200">Past Record</span>
                            <h3 className="text-xl sm:text-2xl font-black">{format(new Date(selectedPastSession.created_at), 'MMMM dd, yyyy - hh:mm a')}</h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => deleteSession(selectedPastSession.id)} 
                              className="btn-gradient-danger text-xs font-bold px-4 py-2"
                            >
                              Delete
                            </button>
                            <button 
                              onClick={() => setSelectedPastSession(null)} 
                              className="btn-outlined text-xs text-white border-white/30 px-4 py-2"
                            >
                              Close
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div>
                            <span className="text-[10px] uppercase font-bold tracking-wider text-blue-200">Live Attendance Code</span>
                            <h3 className="text-4xl sm:text-6xl font-black font-mono tracking-widest text-emerald-400 mt-1">{activeSession?.otp}</h3>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm text-center">
                              <span className="text-[10px] uppercase text-white/70 block font-bold">Accuracy</span>
                              <span className="text-base sm:text-lg font-bold">{locationAccuracy ? `~${Math.round(locationAccuracy)}m` : '--'}</span>
                            </div>
                            <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm text-center">
                              <span className="text-[10px] uppercase text-white/70 block font-bold">Expires</span>
                              <span className="text-base sm:text-lg font-bold font-mono">{activeSession ? format(new Date(activeSession.expires_at), 'HH:mm') : '--'}</span>
                            </div>
                            <div className="bg-emerald-600 p-3 rounded-xl text-center col-span-2 sm:col-span-1">
                              <span className="text-[10px] uppercase text-white/80 block font-bold">Present</span>
                              <span className="text-base sm:text-lg font-black">{attendance.length}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-2 sm:mt-0">
                            <button 
                              onClick={() => endSession(activeSession!.id)} 
                              className="btn-gradient-danger text-xs font-bold px-5 py-3 w-full sm:w-auto"
                            >
                              End Session
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Presence Log Table */}
                  <div className="p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500">
                        Present Students ({attendance.length})
                      </h4>
                      <button 
                        onClick={exportAttendance} 
                        disabled={attendance.length === 0} 
                        className="btn-outlined text-xs font-bold flex items-center gap-1.5 px-3 py-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export CSV</span>
                      </button>
                    </div>

                    <div className="overflow-x-auto touch-scroll">
                      <table className="w-full text-left min-w-[320px]">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                            <th className="py-2.5 px-3 sm:px-4">Student</th>
                            <th className="py-2.5 px-3 sm:px-4">Enrollment</th>
                            <th className="py-2.5 px-3 sm:px-4 text-right">Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-xs sm:text-sm">
                          {attendance.map(a => {
                            const studentProfile = Array.isArray(a.users.student_profiles) ? a.users.student_profiles[0] : a.users.student_profiles;
                            return (
                              <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                                <td className="py-3 px-3 sm:px-4 font-bold text-slate-900 dark:text-white">
                                  {a.users.name}
                                </td>
                                <td className="py-3 px-3 sm:px-4 font-mono text-slate-600 dark:text-slate-300">
                                  {studentProfile?.enrollment_no || 'N/A'}
                                </td>
                                <td className="py-3 px-3 sm:px-4 text-right text-slate-500 font-mono text-xs">
                                  {format(new Date(a.created_at), 'hh:mm:ss a')}
                                </td>
                              </tr>
                            );
                          })}
                          {attendance.length === 0 && (
                            <tr>
                              <td colSpan={3} className="py-8 text-center text-slate-400 italic">
                                Waiting for students to mark attendance...
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Past Sessions List */}
              <div className="glass-card">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
                  <History className="w-4 h-4" />
                  <span>Session History ({sessions.length})</span>
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto touch-scroll">
                  {sessions.map(s => (
                    <div 
                      key={s.id} 
                      onClick={() => setSelectedPastSession(s)}
                      className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("w-3 h-3 rounded-full", s.active ? "bg-emerald-500" : "bg-slate-400")} />
                        <div>
                          <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">{format(new Date(s.created_at), 'MMM dd, yyyy - hh:mm a')}</p>
                          <p className="text-[11px] text-slate-500 font-mono">Code: {s.otp}</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400">View →</span>
                    </div>
                  ))}
                  {sessions.length === 0 && (
                    <p className="text-xs text-slate-400 italic text-center py-4">No sessions recorded yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Records Tab Content */}
          {activeTab === 'records' && (
            <div className="space-y-4 sm:space-y-6">
              <div className="glass-card p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search student or enrollment..."
                      className="field-input pl-9"
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button 
                      onClick={exportFullRegister}
                      disabled={allStudents.length === 0}
                      className="btn-outlined text-xs font-bold flex items-center gap-1.5 px-3 py-2 flex-1 sm:flex-none"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export CSV</span>
                    </button>
                    <button 
                      onClick={exportRegisterPDF}
                      disabled={allStudents.length === 0}
                      className="btn-gradient text-xs font-bold flex items-center gap-1.5 px-3 py-2 flex-1 sm:flex-none"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Export PDF</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto touch-scroll">
                  <table className="w-full text-left min-w-[340px]">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                        <th className="py-3 px-3 sm:px-4">Student</th>
                        <th className="py-3 px-3 sm:px-4 text-center">Score</th>
                        <th className="py-3 px-3 sm:px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-xs sm:text-sm">
                      {filteredStudents.map(student => (
                        <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                          <td className="py-3 px-3 sm:px-4">
                            <div className="font-bold text-slate-900 dark:text-white">{student.name}</div>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5">{student.enrollment_no}</div>
                          </td>
                          <td className="py-3 px-3 sm:px-4 text-center">
                            <span className={cn(
                              "font-bold text-sm",
                              student.attendance_percentage >= 75 ? "text-emerald-600 dark:text-emerald-400" :
                              student.attendance_percentage >= 50 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"
                            )}>
                              {Math.round(student.attendance_percentage)}%
                            </span>
                            <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mt-1 overflow-hidden">
                              <div 
                                className={cn("h-full rounded-full", student.attendance_percentage >= 75 ? "bg-emerald-500" : "bg-rose-500")}
                                style={{ width: `${student.attendance_percentage}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-3 px-3 sm:px-4 text-right">
                            <div className="flex items-center justify-end gap-1 sm:gap-2">
                              {(activeSession || selectedPastSession) && !attendance.find(a => a.student_id === student.id) && (
                                <button 
                                  onClick={() => manualMarkAttendance(student.id)}
                                  className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider touch-target"
                                >
                                  Mark Present
                                </button>
                              )}
                              <button 
                                onClick={() => handleResetDevice(student.id)} 
                                className="p-2 text-slate-400 hover:text-amber-600 rounded-lg touch-target" 
                                title="Reset Device Link"
                              >
                                <Smartphone className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => setResettingUserId(student.id)} 
                                className="p-2 text-slate-400 hover:text-blue-600 rounded-lg touch-target" 
                                title="Reset PIN"
                              >
                                <Key className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredStudents.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-slate-400 italic">
                            No students enrolled in this class yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Password Reset Dialog */}
              {resettingUserId && (
                <div className="modal-overlay" onClick={() => setResettingUserId(null)}>
                  <div className="modal" onClick={e => e.stopPropagation()}>
                    <div className="sheet-drag-handle sm:hidden" />
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-[--color-text-primary]">Reset Student PIN</h3>
                      <button onClick={() => setResettingUserId(null)} className="p-1 text-slate-400 hover:text-slate-600 touch-target">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <p className="text-xs text-[--color-text-secondary] mb-4">
                      Set a new 6-digit numeric security PIN for this student account.
                    </p>
                    <div className="space-y-4">
                      <input 
                        type="password" 
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="field-input text-center text-2xl font-mono tracking-[0.3em]"
                        placeholder="••••••"
                        inputMode="numeric"
                        maxLength={6}
                        autoFocus
                      />
                      <div className="flex gap-2 pt-2">
                        <button 
                          onClick={() => handleResetPassword(resettingUserId)} 
                          disabled={loading || !/^\d{6}$/.test(newPassword)} 
                          className="btn-gradient flex-1 font-bold"
                        >
                          Confirm Reset
                        </button>
                        <button 
                          onClick={() => setResettingUserId(null)} 
                          className="btn-outlined px-4"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
