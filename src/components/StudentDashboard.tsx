/**
 * Copyright © 2026 Ambuj Singh. All Rights Reserved.
 * This code is proprietary and confidential. Unauthorized copying, 
 * distribution, or use is strictly prohibited.
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { authFetch } from '../lib/authFetch';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Folder, Plus, ArrowLeft as ArrowLeftIcon, Clock, CheckCircle2, AlertCircle, Loader2, History, BarChart3, ShieldCheck, KeyRound, GraduationCap, X } from 'lucide-react';
import { getAveragedPosition } from '../lib/geo';
import { getDeviceFingerprint } from '../lib/device';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { notifySessionStarted, notifyAttendanceMarked, notifyAbsentInClass, schedule5PMAttendanceNotification } from '../lib/notifications';
import { queueOfflineAttendance, syncOfflineQueue } from '../lib/offlineQueue';
import { useBackButton } from '../lib/backButton';

interface AttendanceRecord {
  id: string;
  session_id: string;
  created_at: string;
  attendance_sessions: {
    teacher: {
      name: string;
    };
  };
}

export default function StudentDashboard({ user, profile, darkMode, toggleDarkMode }: { user: any; profile: any; darkMode: boolean; toggleDarkMode: () => void }) {
  const [classes, setClasses] = useState<any[]>([]);
  const [activeClass, setActiveClass] = useState<any | null>(null);
  const [showJoinClass, setShowJoinClass] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'warning' | null; message: string }>({ type: null, message: '' });
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState({ attended: 0, total: 0, percentage: 0 });
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [samplingProgress, setSamplingProgress] = useState<{ current: number; total: number } | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [locationPermission, setLocationPermission] = useState<string | null>(null);
  const [showLowAttendanceToast, setShowLowAttendanceToast] = useState(false);
  const [toastDismissed, setToastDismissed] = useState(false);

  // Android Back Button handlers
  useBackButton(() => {
    if (showJoinClass) {
      setShowJoinClass(false);
      return true;
    }
    return false;
  }, showJoinClass, 50);

  useBackButton(() => {
    if (activeClass !== null) {
      setActiveClass(null);
      setStatus({ type: null, message: '' });
      return true;
    }
    return false;
  }, activeClass !== null && !showJoinClass, 30);

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

  useEffect(() => {
    const fetchClasses = async () => {
      const { data } = await supabase
        .from('class_enrollments')
        .select('class_id, classes(*)')
        .eq('student_id', user.id);
      if (data) {
        setClasses(data.map((d: any) => d.classes).filter(Boolean));
      }
    };
    fetchClasses();
  }, [user.id, activeClass?.id]);

  // Realtime Session Start Listener for Notifications
  useEffect(() => {
    if (classes.length === 0) return;
    const classIds = classes.map(c => c.id);

    const channel = supabase
      .channel('session_starts_notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'attendance_sessions',
      }, (payload: any) => {
        if (payload.new && classIds.includes(payload.new.class_id)) {
          const cls = classes.find(c => c.id === payload.new.class_id);
          notifySessionStarted(cls ? cls.name : 'your class');
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [classes]);

  // Daily 5:00 PM Absence Check Notification
  useEffect(() => {
    const checkAbsenceAt5PM = async () => {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const storageKey = `classmark_5pm_notified_${user.id}_${todayStr}`;
      
      // Only run if hour >= 17 (5 PM) and hasn't notified today
      if (now.getHours() >= 17 && !localStorage.getItem(storageKey)) {
        try {
          if (classes.length === 0) return;
          const classIds = classes.map(c => c.id);

          // Get today's sessions for enrolled classes
          const { data: todaySessions } = await supabase
            .from('attendance_sessions')
            .select('id, class_id')
            .in('class_id', classIds)
            .gte('created_at', `${todayStr}T00:00:00.000Z`);

          if (todaySessions && todaySessions.length > 0) {
            // Get student's attendance records for today
            const { data: records } = await supabase
              .from('attendance_records')
              .select('session_id')
              .eq('student_id', user.id);

            const attendedSessionIds = new Set((records || []).map((r: any) => r.session_id));

            // Check which enrolled classes held sessions today that student missed
            for (const s of todaySessions) {
              if (!attendedSessionIds.has(s.id)) {
                const cls = classes.find(c => c.id === s.class_id);
                if (cls) {
                  notifyAbsentInClass(cls.name);
                }
              }
            }
          }
          localStorage.setItem(storageKey, 'true');
        } catch (e) {
          console.error('5PM Absence check error:', e);
        }
      }
    };

    checkAbsenceAt5PM();
    const interval = setInterval(checkAbsenceAt5PM, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [classes, user.id]);

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: targetClass } = await supabase.from('classes').select('*').eq('join_code', joinCode.toUpperCase()).single();
      if (!targetClass) throw new Error('Invalid class code');
      
      const { error } = await supabase.from('class_enrollments').insert({
        class_id: targetClass.id,
        student_id: user.id
      });
      if (error && error.code !== '23505') throw error; // ignore duplicate
      
      setClasses(prev => [...prev.filter(c => c.id !== targetClass.id), targetClass]);
      setShowJoinClass(false);
      setJoinCode('');
      setStatus({ type: 'success', message: 'Successfully joined ' + targetClass.name });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeClass) return;
    const fetchHistory = async () => {
      try {
        // 1. Fetch student's attendance records with teacher info
        const { data: records, error: recordsError } = await supabase
          .from('attendance_records')
          .select(`
            id,
            session_id,
            created_at,
            attendance_sessions!inner (
              class_id,
              teacher:users!teacher_id (
                name
              )
            )
          `)
          .eq('student_id', user.id)
          .eq('attendance_sessions.class_id', activeClass.id)
          .order('created_at', { ascending: false });

        if (recordsError) throw recordsError;

        const { count, error: countError } = await supabase
          .from('attendance_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('class_id', activeClass.id);

        if (countError) throw countError;

        const attended = records ? records.length : 0;
        const total = count || 0;
        const percentage = total > 0 ? Math.round((attended / total) * 100) : 0;

        setHistory((records as any) || []);
        setStats({ attended, total, percentage });

        // Show low attendance alert if below 75%
        if (total > 0 && percentage < 75) {
          setShowLowAttendanceToast(true);
        }
      } catch (err) {
        console.error('Error fetching student data:', err);
      }
    };

    fetchHistory();

    const channel = supabase
      .channel('student_attendance')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance_records', filter: `student_id=eq.${user.id}` }, () => {
        fetchHistory();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id, activeClass?.id]);

  const markAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 4) return;

    // Hard 30-second timeout so the UI never gets permanently stuck
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('The operation took too long. Please check your GPS signal and try again.')), 30000)
    );

    try {
      setLoading(true);
      setStatus({ type: null, message: '' });

      await Promise.race([timeoutPromise, (async () => {
        // Collect 3 GPS samples for spoof detection (reduced from 5 for faster response)
        const pos = await getAveragedPosition(3, (current, total) => {
          setSamplingProgress({ current, total });
        });
        setSamplingProgress(null);
        setLocationAccuracy(pos.accuracy);
        
        if (pos.accuracy > 60) {
          if (retryCount < 2) {
            setRetryCount(prev => prev + 1);
            setStatus({ type: 'error', message: `Low GPS accuracy (${Math.round(pos.accuracy)}m). Please stay in an open area and try again. (Retry ${retryCount + 1}/3)` });
            return;
          } else {
            setStatus({ type: 'error', message: `GPS accuracy is too low (${Math.round(pos.accuracy)}m) after multiple attempts. Please move closer to the classroom or ask the teacher for manual override.` });
            return;
          }
        }

        // Get hardware-based device fingerprint (survives cache clearing)
        const deviceId = await getDeviceFingerprint();
        
        const payload = {
          classId: activeClass?.id,
          otp,
          lat: pos.latitude,
          lng: pos.longitude,
          accuracy: pos.accuracy,
          deviceId: deviceId,
          localFallback: localStorage.getItem('device_id'),
          gpsSamples: pos.rawSamples
        };

        // If offline upfront, queue immediately
        if (!navigator.onLine) {
          await queueOfflineAttendance(activeClass?.name || 'Class', payload);
          setStatus({ type: 'warning', message: '📶 Saved Offline! Your attendance is queued and will automatically sync when internet returns.' });
          setOtp('');
          setRetryCount(0);
          return;
        }

        try {
          const response = await authFetch('/api/attendance/mark', {
            method: 'POST',
            body: JSON.stringify(payload)
          });

          const data = await response.json();
          if (!response.ok) {
            if (data.distance && data.allowedRadius) {
              throw new Error(`You are too far (${data.distance}m). Please move slightly closer to the classroom.`);
            }
            throw new Error(data.error || 'Failed to mark attendance');
          }

          setStatus({ type: 'success', message: 'Attendance marked successfully!' });
          notifyAttendanceMarked(activeClass?.name || 'Class');
          schedule5PMAttendanceNotification(activeClass?.name || 'Class', 'present');
          setOtp('');
          setRetryCount(0);
        } catch (fetchErr: any) {
          // If fetch fails due to network outage, queue locally!
          if (fetchErr && (fetchErr.message?.includes('Failed to fetch') || fetchErr.message?.includes('NetworkError') || !navigator.onLine)) {
            await queueOfflineAttendance(activeClass?.name || 'Class', payload);
            setStatus({ type: 'warning', message: '📶 Saved Offline! Your connection dropped, but your attendance is queued and will auto-sync when internet returns.' });
            setOtp('');
            setRetryCount(0);
            return;
          }
          throw fetchErr;
        }
      })()]);

    } catch (err: any) {
      console.error('Attendance error:', err);
      setSamplingProgress(null);
      
      if (err && err.code === 1) {
        setLocationPermission('denied');
        setStatus({ type: 'error', message: 'Location access denied. Please enable location services in your browser/device settings.' });
      } else if (err && err.code === 2) {
        setStatus({ type: 'error', message: 'Location unavailable. Please check your GPS signal.' });
      } else if (err && err.code === 3) {
        setStatus({ type: 'error', message: 'Location request timed out. Please try again.' });
      } else {
        setStatus({ type: 'error', message: err.message || 'Failed to mark attendance.' });
      }
    } finally {
      setLoading(false);
    }
  };

  if (!activeClass) {
    return (
      <div className="space-y-5 sm:space-y-6">
        <AnimatePresence>
          {status.type && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className={status.type === 'success' ? "alert alert--success" : "alert alert--error"}>
              <p className="text-sm font-medium">{status.message}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-[--color-text-primary] tracking-tight">
              <Folder className="w-5 h-5 sm:w-6 sm:h-6 text-[--color-primary] dark:text-blue-500 shrink-0" />
              <span>Enrolled Classes</span>
            </h2>
            <p className="text-xs text-[--color-text-secondary] mt-0.5">Select a class to mark attendance</p>
          </div>
          <button 
            onClick={() => setShowJoinClass(true)} 
            className="btn-gradient px-4 py-2.5 flex items-center gap-1.5 text-xs sm:text-sm font-bold shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Join Class</span>
          </button>
        </div>

        {/* Join Class Dialog / Mobile Bottom Sheet */}
        {showJoinClass && (
          <div className="modal-overlay" onClick={() => setShowJoinClass(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="sheet-drag-handle sm:hidden" />
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-[--color-text-primary]">Enter Class Code</h3>
                <button
                  onClick={() => setShowJoinClass(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg touch-target"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-[--color-text-secondary] mb-4">
                Ask your instructor for the 6-character unique join code.
              </p>
              <form onSubmit={handleJoinClass} className="space-y-4">
                <input 
                  type="text" 
                  value={joinCode} 
                  onChange={e => setJoinCode(e.target.value.toUpperCase())} 
                  placeholder="e.g. A1B2C3" 
                  className="field-input uppercase tracking-[0.2em] font-mono text-center text-lg font-bold" 
                  maxLength={6}
                  autoFocus
                  required 
                />
                <div className="flex items-center gap-2 pt-2">
                  <button 
                    disabled={loading || !joinCode} 
                    type="submit" 
                    className="btn-gradient flex-1 font-bold"
                  >
                    {loading ? <Loader2 className="animate-spin mx-auto w-5 h-5"/> : 'Join Class'}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowJoinClass(false)} 
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
               <h3 className="text-lg font-bold text-[--color-text-primary] mb-1">{c.name}</h3>
               <p className="text-xs text-[--color-text-secondary] flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                 <span>Tap to open dashboard</span>
                 <span className="font-bold text-blue-600 dark:text-blue-400">→</span>
               </p>
             </motion.div>
          ))}
          {classes.length === 0 && !showJoinClass && (
             <div className="col-span-full py-16 text-center text-[--color-text-secondary] italic glass-card">
               <Folder className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
               <p className="text-sm">You haven't joined any classes yet.</p>
               <button onClick={() => setShowJoinClass(true)} className="mt-3 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
                 + Join your first class
               </button>
             </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence>
        {showLowAttendanceToast && !toastDismissed && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 pointer-events-auto safe-area-pb"
          >
            <div className="bg-red-500 text-white p-4 rounded-2xl shadow-2xl flex items-start gap-3 border border-red-400">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm leading-tight">Low Attendance Warning!</h4>
                <p className="text-xs text-red-100 mt-1 leading-relaxed">
                  Your overall attendance in <span className="font-bold underline">{activeClass.name}</span> is currently <span className="font-bold">{stats.percentage}%</span> (Required: 75%).
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={() => setToastDismissed(true)}
                    className="text-xs font-bold bg-white text-red-600 px-3 py-1.5 rounded-lg shadow-sm active:scale-95 transition-all touch-target"
                  >
                    I Understand
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Class Top Nav */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between bg-white dark:bg-slate-800 px-3.5 sm:px-6 py-3.5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 min-w-0">
              <button 
                onClick={() => { setActiveClass(null); setStatus({ type: null, message: '' }); }} 
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-500 hover:text-indigo-600 dark:hover:text-white shrink-0 touch-target"
                title="Back to all classes"
                aria-label="Back to classes"
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </button>
              <div className="min-w-0 flex-1">
                <h2 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white truncate">{activeClass.name}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Class Attendance & History</p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Profile Details Card */}
          <section className="glass-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-[--color-text-primary] truncate">{profile.name}</h1>
                <p className="text-[--color-text-secondary] text-xs sm:text-sm flex flex-wrap items-center gap-1 sm:gap-2 mt-1">
                  <GraduationCap className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
                  <span>{profile.course} • Sem {profile.semester} • {profile.major_subject}</span>
                  <span className="hidden sm:inline">• Batch {profile.batch}</span>
                </p>
              </div>
              <div className="glass-card--primary p-3 sm:p-4 rounded-xl min-w-0 sm:min-w-[180px]">
                <div className="grid grid-cols-2 sm:grid-cols-1 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-[--color-text-secondary] font-bold uppercase tracking-wider">Enrollment No</p>
                    <p className="text-sm sm:text-base font-mono font-bold text-[--color-text-primary] mt-0.5">{profile.enrollment_no}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[--color-text-secondary] font-bold uppercase tracking-wider">Exam Roll</p>
                    <p className="text-sm sm:text-base font-mono font-bold text-[--color-text-primary] mt-0.5">{profile.exam_roll_no || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Mark Attendance Card */}
          <section>
            <div className="glass-card overflow-hidden p-0">
              <div className="bg-[#002147] dark:bg-blue-600 p-4 sm:p-6 text-white">
                <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                  <ShieldCheck className="w-6 h-6 shrink-0" />
                  <span>Mark Attendance</span>
                </h2>
                <p className="text-blue-100 text-xs sm:text-sm mt-1">Enter the 4-digit OTP provided by your teacher in class.</p>
              </div>
              
              <div className="p-4 sm:p-8">
                {locationPermission === 'denied' && (
                  <div className="alert alert--error mb-5">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold">Location Access Denied</h4>
                      <p className="text-xs mt-1 leading-relaxed">
                        Location services are required to verify presence in the classroom. Please enable location permissions for this app in device settings.
                      </p>
                    </div>
                  </div>
                )}

                {locationPermission === 'prompt' && (
                  <div className="alert alert--warning mb-5">
                    <MapPin className="w-5 h-5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold">Location Permission Needed</h4>
                      <p className="text-xs mt-1 mb-2 leading-relaxed">
                        ClassMark uses secure GPS verification to confirm attendance.
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
                        className="text-xs font-bold bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity touch-target"
                      >
                        Enable Location
                      </button>
                    </div>
                  </div>
                )}

                <form onSubmit={markAttendance} className="max-w-xs sm:max-w-sm mx-auto space-y-5">
                  <div className="field-group text-center">
                    <label className="field-label uppercase tracking-wider block text-[--color-text-secondary] mb-1">
                      Enter 4-Digit OTP
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="••••"
                      inputMode="numeric"
                      className="field-input text-center text-2xl sm:text-4xl font-black font-mono tracking-[0.25em] sm:tracking-[0.4em] w-full py-3 sm:py-4"
                      autoComplete="one-time-code"
                      required
                    />
                  </div>

                  <AnimatePresence>
                    {status.type && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className={cn(
                          status.type === 'success' ? "alert alert--success" : status.type === 'warning' ? "alert alert--warning" : "alert alert--error"
                        )}
                      >
                        {status.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
                        <p className="text-xs sm:text-sm font-medium">{status.message}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    type="submit"
                    disabled={loading || otp.length !== 4}
                    className="btn-gradient-success w-full disabled:opacity-50 flex items-center justify-center gap-2 font-bold text-sm sm:text-base py-3.5"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{samplingProgress ? `Sampling GPS (${samplingProgress.current}/${samplingProgress.total})...` : 'Verifying Presence...'}</span>
                      </div>
                    ) : (
                      <>
                        <KeyRound className="w-5 h-5" />
                        <span>Submit Attendance</span>
                      </>
                    )}
                  </button>
                  
                  <div className="text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-0.5 pt-1">
                    <span className="flex items-center gap-1 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-blue-500" />
                      Smart Geofencing Verification
                    </span>
                    {locationAccuracy && (
                      <span className="text-[10px] opacity-75">
                        Current accuracy: ~{Math.round(locationAccuracy)}m
                      </span>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </section>

          {/* History Section */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
              <History className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>Recent Attendance</span>
            </h2>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-x-auto touch-scroll">
              <table className="w-full text-left min-w-[320px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold tracking-widest border-b border-slate-200 dark:border-slate-700">
                    <th className="py-3 px-3 sm:px-5">Date & Time</th>
                    <th className="py-3 px-3 sm:px-5">Instructor</th>
                    <th className="py-3 px-3 sm:px-5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-xs sm:text-sm">
                  {history.length > 0 ? (
                    history.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                        <td className="py-3 px-3 sm:px-5">
                          <div className="font-medium text-[--color-text-primary]">
                            {format(new Date(record.created_at), 'MMM dd, yyyy')}
                          </div>
                          <div className="text-[11px] text-[--color-text-secondary]">
                            {format(new Date(record.created_at), 'hh:mm a')}
                          </div>
                        </td>
                        <td className="py-3 px-3 sm:px-5 text-[--color-text-secondary] max-w-[120px] truncate">
                          {record.attendance_sessions?.teacher?.name || 'Faculty'}
                        </td>
                        <td className="py-3 px-3 sm:px-5 text-right">
                          <span className="badge badge--success text-[11px]">
                            <CheckCircle2 className="w-3 h-3" />
                            Present
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-10 text-center text-[--color-text-secondary] italic">
                        No attendance records for this class yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Stats Sidebar */}
        <div className="space-y-4 sm:space-y-6">
          <div className="glass-card">
            <h3 className="text-[--color-text-secondary] text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Attendance Stats</span>
            </h3>
            
            <div className="flex flex-col items-center text-center">
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center mb-3">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-slate-200 dark:text-slate-700"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="#10b981"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={351.8}
                    style={{
                      strokeDasharray: `${stats.total > 0 ? (351.8 * stats.attended) / stats.total : 0} 351.8`
                    }}
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl sm:text-3xl font-black text-[--color-text-primary]">{stats.percentage}%</span>
                  <span className="text-[10px] text-[--color-text-secondary] font-bold uppercase">Rate</span>
                </div>
              </div>

              <div className="flex gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                  <span className="text-[--color-text-secondary]">Present: {stats.attended}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
                  <span className="text-[--color-text-secondary]">Absent: {Math.max(0, stats.total - stats.attended)}</span>
                </div>
              </div>
              <p className="text-[--color-text-secondary] text-xs mt-2">
                Attended <span className="font-bold text-[--color-text-primary]">{stats.attended}</span> of <span className="font-bold text-[--color-text-primary]">{stats.total}</span> total classes.
              </p>
            </div>

            {stats.percentage < 75 && stats.total > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3.5 mt-4">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wide">Short Attendance</h4>
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5 leading-relaxed">
                      Your attendance is below the mandatory 75% threshold.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="glass-card border-blue-100 dark:border-blue-900/40">
            <h3 className="font-bold text-sm text-[--color-text-primary] mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Smart Geofencing</span>
            </h3>
            <p className="text-[--color-text-secondary] text-xs leading-relaxed">
              Attendance verification adjusts to indoor GPS signal quality while preventing proxies from outside classroom boundaries.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
