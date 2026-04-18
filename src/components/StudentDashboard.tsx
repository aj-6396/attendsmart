/**
 * Copyright © 2026 Ambuj Singh & Aniket Verma. All Rights Reserved.
 * This code is proprietary and confidential. Unauthorized copying, 
 * distribution, or use is strictly prohibited.
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Folder, Plus, ArrowLeft as ArrowLeftIcon, Clock, CheckCircle2, XCircle, AlertCircle, Loader2, History, BarChart3, ShieldCheck, KeyRound, GraduationCap } from 'lucide-react';
import { getAveragedPosition } from '../lib/geo';
import { getDeviceFingerprint } from '../lib/device';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

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
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState({ attended: 0, total: 0, percentage: 0 });
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [samplingProgress, setSamplingProgress] = useState<{ current: number; total: number } | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [locationPermission, setLocationPermission] = useState<string | null>(null);
  const [showLowAttendanceToast, setShowLowAttendanceToast] = useState(false);
  const [toastDismissed, setToastDismissed] = useState(false);

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

        const attended = records?.length || 0;
        const total = count || 0;
        
        setHistory(records as any || []);
        setStats({
          attended,
          total,
          percentage: total > 0 ? Math.round((attended / total) * 100) : 0
        });
        if (total > 0 && Math.round((attended / total) * 100) < 75 && !toastDismissed) {
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

    try {
      setLoading(true);
      setStatus({ type: null, message: '' });

      // Collect 5 GPS samples for better spoof detection
      const pos = await getAveragedPosition(5, (current, total) => {
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
      
      const response = await fetch('/api/attendance/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: user.id,
          classId: activeClass?.id, // Added classId for strict isolation
          otp,
          lat: pos.latitude,
          lng: pos.longitude,
          accuracy: pos.accuracy,
          deviceId: deviceId,
          gpsSamples: pos.rawSamples  // Send raw samples for server-side spoof detection
        })
      });

      const data = await response.json();
      if (!response.ok) {
        if (data.distance && data.allowedRadius) {
          throw new Error(`You are too far (${data.distance}m). Please move slightly closer to the classroom.`);
        }
        throw new Error(data.error || 'Failed to mark attendance');
      }

      setStatus({ type: 'success', message: 'Attendance marked successfully!' });
      setOtp('');
      setRetryCount(0);

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
      <div className="space-y-6">
        <AnimatePresence>
          {status.type && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className={status.type === 'success' ? "alert alert--success" : "alert alert--error"}>
              <p className="text-sm font-medium">{status.message}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2 text-[--color-text-primary]">
            <Folder className="w-6 h-6 text-[--color-primary]" />
            My Enrolled Classes
          </h2>
          <button onClick={() => setShowJoinClass(true)} className="btn-gradient px-4 py-2 flex items-center gap-2 w-auto h-10 text-sm">
            <Plus className="w-4 h-4" />
            Join Class
          </button>
        </div>

        {showJoinClass && (
          <div className="glass-card p-6">
            <h3 className="font-bold mb-4 text-[--color-text-primary]">Enter Class Code</h3>
            <form onSubmit={handleJoinClass} className="flex gap-4">
              <input 
                type="text" 
                value={joinCode} 
                onChange={e => setJoinCode(e.target.value.toUpperCase())} 
                placeholder="e.g. A1B2C3" 
                className="field-input flex-1 uppercase tracking-widest font-mono" 
                maxLength={6}
                required 
              />
              <button disabled={loading} type="submit" className="btn-gradient w-32 h-12">
                {loading ? <Loader2 className="animate-spin mx-auto w-5 h-5"/> : 'Join'}
              </button>
              <button type="button" onClick={() => setShowJoinClass(false)} className="px-4 py-2 border rounded-xl hover:bg-slate-50 text-[--color-text-secondary]">Cancel</button>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map(c => (
             <div key={c.id} onClick={() => setActiveClass(c)} className="glass-card p-6 cursor-pointer hover:border-[--color-primary]/50 transition-all hover:shadow-xl group">
               <div className="w-12 h-12 rounded-xl bg-[--color-primary]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Folder className="w-6 h-6 text-[--color-primary]" />
               </div>
               <h3 className="text-lg font-bold text-[--color-text-primary] mb-2">{c.name}</h3>
             </div>
          ))}
          {classes.length === 0 && !showJoinClass && (
             <div className="col-span-full py-12 text-center text-[--color-text-secondary] italic">
               You haven't joined any classes yet. Click 'Join Class' to enter a code.
             </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Low Attendance Toast */}
      <AnimatePresence>
        {showLowAttendanceToast && stats.percentage < 75 && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-6 left-4 right-4 z-[9999] md:left-auto md:right-6 md:w-96"
          >
            <div className="bg-gradient-to-r from-red-600 to-amber-600 p-[1px] rounded-2xl shadow-2xl">
              <div className="bg-white rounded-[15px] p-4 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-black text-slate-900 leading-tight">Low Attendance Alert</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Your attendance is currently <span className="text-red-600 font-bold">{stats.percentage}%</span>. 
                    Please attend more classes to maintain the 75% requirement.
                  </p>
                  <div className="flex items-center gap-3 mt-3">
                    <button 
                      onClick={() => {
                        setShowLowAttendanceToast(false);
                        setToastDismissed(true);
                      }}
                      className="text-[10px] font-black uppercase tracking-widest text-white bg-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      Got it
                    </button>
                    <button 
                       onClick={() => setShowLowAttendanceToast(false)}
                       className="text-[10px] font-bold text-slate-400 hover:text-slate-600"
                    >
                      Remind later
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-3 mb-[-1rem]">
         <div className="flex items-center justify-between bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-100">
           <div className="flex items-center gap-4">
             <button onClick={() => { setActiveClass(null); setStatus({ type: null, message: '' }); }} className="p-2 hover:bg-slate-50 rounded-lg text-[--color-text-secondary] hover:text-[--color-primary]">
                <ArrowLeftIcon className="w-5 h-5" />
             </button>
             <div>
               <h2 className="text-xl font-bold text-[--color-text-primary]">{activeClass.name}</h2>
               <p className="text-xs text-[--color-text-secondary]">Class Dashboard</p>
             </div>
           </div>
         </div>
      </div>

      <div className="lg:col-span-2 space-y-8">
        <section className="glass-card">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[--color-text-primary]">{profile.name}</h1>
              <p className="text-[--color-text-secondary] text-sm flex items-center gap-2 mt-1">
                <GraduationCap className="w-4 h-4" />
                {profile.course} • {profile.semester} Semester • {profile.major_subject} • Batch {profile.batch}
              </p>
            </div>
            {/* Student Detail Box */}
            <div className="glass-card--primary p-4 min-w-[200px]">
              <h3 className="text-sm font-semibold text-[--color-text-secondary] mb-3 text-center">Student Details</h3>
              <div className="space-y-3">
                <div className="text-center">
                  <p className="text-xs text-[--color-text-secondary] font-medium uppercase tracking-wide">Enrollment No</p>
                  <p className="text-lg font-mono font-bold text-[--color-text-primary] mt-1">{profile.enrollment_no}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-[--color-text-secondary] font-medium uppercase tracking-wide">Exam Roll No</p>
                  <p className="text-lg font-mono font-bold text-[--color-text-primary] mt-1">{profile.exam_roll_no || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="glass-card overflow-hidden">
            <div className="bg-gradient-to-r from-[--color-success] to-[--color-secondary] p-6 text-black">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <ShieldCheck className="w-6 h-6" />
                Mark Attendance
              </h2>
              <p className="text-black/80 text-sm mt-1">Enter the 4-digit OTP provided by your teacher.</p>
            </div>
            
            <div className="p-8">
              {locationPermission === 'denied' && (
                <div className="alert alert--error mb-6">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold">Location Access Denied</h4>
                    <p className="text-xs mt-1">
                      You have denied location access. Please enable location services for this app in your device settings or browser settings to mark attendance.
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
                      We need your location to verify you are in the classroom.
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

              <form onSubmit={markAttendance} className="max-w-sm mx-auto space-y-6">
                <div className="field-group">
                  <label className="field-label text-center uppercase tracking-wider block text-black">
                    Enter 4-Digit OTP
                  </label>
                  <div className="flex justify-center gap-4">
                    <input
                      type="text"
                      maxLength={4}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="0000"
                      className="field-input text-center text-4xl font-black tracking-[0.5em] w-full"
                    />
                  </div>
                </div>

                <AnimatePresence>
                  {status.type && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className={cn(
                        status.type === 'success' ? "alert alert--success" : "alert alert--error"
                      )}
                    >
                      {status.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
                      <p className="text-sm font-medium">{status.message}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={loading || otp.length !== 4}
                  className="btn-gradient-success w-full disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {samplingProgress ? `Sampling ${samplingProgress.current}/${samplingProgress.total}...` : 'Processing...'}
                    </div>
                  ) : (
                    <>
                      <KeyRound className="w-5 h-5" />
                      Submit Attendance
                    </>
                  )}
                </button>
                
                <p className="text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Smart Geofencing Active
                  </span>
                  {locationAccuracy && (
                    <span className="text-[10px] opacity-75">
                      Your current accuracy: {Math.round(locationAccuracy)}m
                    </span>
                  )}
                </p>
              </form>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-indigo-600" />
            Recent Attendance
          </h2>
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase font-bold tracking-widest border-b border-slate-100">
                  <th className="py-3 px-6">Date & Time</th>
                  <th className="py-3 px-6">Teacher</th>
                  <th className="py-3 px-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {history.length > 0 ? (
                  history.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-medium text-[--color-text-primary]">
                          {format(new Date(record.created_at), 'MMM dd, yyyy')}
                        </div>
                        <div className="text-xs text-[--color-text-secondary]">
                          {format(new Date(record.created_at), 'HH:mm')}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-[--color-text-secondary] text-sm">
                        {record.attendance_sessions?.teacher?.name || 'Unknown'}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <span className="badge badge--success">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Present
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-[--color-text-secondary] italic">
                      No attendance records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="space-y-6">
        <div className="glass-card">
          <h3 className="text-[--color-text-secondary] text-xs font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Attendance Stats
          </h3>
          
          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative w-32 h-32 flex items-center justify-center mb-4">
              <svg className="w-full h-full transform -rotate-90">
                {/* Background circle */}
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  className="text-[--color-text-secondary]/30"
                />
                {/* Red segment for absent */}
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  stroke="#FF4D6D"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={364.4}
                  strokeDashoffset={0}
                  className="transition-all duration-1000 ease-out"
                  style={{
                    strokeDasharray: `${(364.4 * (stats.total - stats.attended)) / stats.total} 364.4`
                  }}
                />
                {/* Green segment for present */}
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  stroke="#00D4AA"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={364.4}
                  className="transition-all duration-1000 ease-out"
                  style={{
                    strokeDasharray: `${(364.4 * stats.attended) / stats.total} 364.4`,
                    strokeDashoffset: `-${(364.4 * (stats.total - stats.attended)) / stats.total}`
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-[--color-text-primary]">{stats.percentage}%</span>
                <span className="text-[10px] text-[--color-text-secondary] font-bold uppercase">Overall</span>
              </div>
            </div>
            <div className="flex gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#00D4AA]"></div>
                <span className="text-[--color-text-secondary]">Present: {stats.attended}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#FF4D6D]"></div>
                <span className="text-[--color-text-secondary]">Absent: {stats.total - stats.attended}</span>
              </div>
            </div>
            <p className="text-[--color-text-secondary] text-sm mt-2">
              You have been present for <span className="font-bold text-[--color-text-primary]">{stats.attended}</span> out of <span className="font-bold text-[--color-text-primary]">{stats.total}</span> classes.
            </p>
          </div>

          {stats.percentage < 75 && (
            <div className="relative group overflow-hidden bg-gradient-to-br from-amber-50 to-red-50 border border-amber-200 rounded-2xl p-5 mt-6">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform">
                 <AlertCircle className="w-16 h-16 text-red-600" />
              </div>
              <div className="relative z-10 flex items-start gap-3">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-amber-900 uppercase tracking-wide">Danger Zone: Low Attendance</h4>
                  <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                    Your attendance is below the **75% institutional requirement**. 
                    Falling below this limit may result in being barred from examinations.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="glass-card bg-gradient-to-br from-[--color-primary]/20 to-[--color-secondary]/20 border border-[--color-primary]/30">
          <h3 className="font-bold text-[--color-text-primary] mb-2">Smart Geofencing</h3>
          <p className="text-[--color-text-secondary] text-sm leading-relaxed">
            The system automatically adjusts the attendance radius based on GPS accuracy. 
            This ensures you can mark attendance even with poor indoor signals, 
            while blocking those in nearby buildings or hostels.
          </p>
        </div>
      </div>
    </div>
    </>
  );
}
