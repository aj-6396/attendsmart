import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Clock, CheckCircle2, XCircle, AlertCircle, Loader2, History, BarChart3, ShieldCheck, KeyRound, GraduationCap } from 'lucide-react';
import { getAveragedPosition } from '../lib/geo';
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

export default function StudentDashboard({ user, profile }: { user: any; profile: any }) {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState({ attended: 0, total: 0, percentage: 0 });
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [samplingProgress, setSamplingProgress] = useState<{ current: number; total: number } | null>(null);
  const [retryCount, setRetryCount] = useState(0);
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

  useEffect(() => {
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
              teacher:users!teacher_id (
                name
              )
            )
          `)
          .eq('student_id', user.id)
          .order('created_at', { ascending: false });

        if (recordsError) throw recordsError;

        // 2. Fetch total sessions available in the system
        // In a real app, this would be filtered by course/batch
        const { count, error: countError } = await supabase
          .from('attendance_sessions')
          .select('*', { count: 'exact', head: true });

        if (countError) throw countError;

        const attended = records?.length || 0;
        const total = count || 0;
        
        setHistory(records as any || []);
        setStats({
          attended,
          total,
          percentage: total > 0 ? Math.round((attended / total) * 100) : 0
        });
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
  }, [user.id]);

  const markAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 4) return;

    try {
      setLoading(true);
      setStatus({ type: null, message: '' });

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
      
      const response = await fetch('/api/attendance/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: user.id,
          otp,
          lat: pos.latitude,
          lng: pos.longitude,
          accuracy: pos.accuracy,
          deviceId: localStorage.getItem('device_id') // Simulated device ID
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-8">
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{profile.name}</h1>
              <p className="text-slate-500 text-sm flex items-center gap-2 mt-1">
                <GraduationCap className="w-4 h-4" />
                {profile.course} • {profile.semester} Semester • {profile.major_subject} • Batch {profile.batch}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Enrollment No</p>
                <p className="text-sm font-mono font-bold text-slate-700">{profile.enrollment_no}</p>
              </div>
              <div className="px-3 py-1.5 bg-indigo-50 rounded-lg border border-indigo-100">
                <p className="text-[10px] text-indigo-400 font-bold uppercase">Exam Roll No</p>
                <p className="text-sm font-mono font-bold text-indigo-700">{profile.exam_roll_no || 'N/A'}</p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
            <div className="bg-emerald-600 p-6 text-white">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <ShieldCheck className="w-6 h-6" />
                Mark Attendance
              </h2>
              <p className="text-emerald-100 text-sm mt-1">Enter the 4-digit OTP provided by your teacher.</p>
            </div>
            
            <div className="p-8">
              {locationPermission === 'denied' && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-red-900">Location Access Denied</h4>
                    <p className="text-xs text-red-700 mt-1">
                      You have denied location access. Please enable location services for this app in your device settings or browser settings to mark attendance.
                    </p>
                  </div>
                </div>
              )}

              {locationPermission === 'prompt' && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-amber-900">Location Access Required</h4>
                    <p className="text-xs text-amber-700 mt-1 mb-2">
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
                      className="text-xs font-bold bg-amber-200 text-amber-800 px-3 py-1.5 rounded-lg hover:bg-amber-300 transition-colors"
                    >
                      Grant Permission
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={markAttendance} className="max-w-sm mx-auto space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 uppercase tracking-wider block text-center">
                    Enter 4-Digit OTP
                  </label>
                  <div className="flex justify-center gap-4">
                    <input
                      type="text"
                      maxLength={4}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="0000"
                      className="w-full text-center text-4xl font-black tracking-[0.5em] py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 outline-none transition-all placeholder:text-slate-200"
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
                        "p-4 rounded-xl flex items-center gap-3 text-sm font-medium",
                        status.type === 'success' ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                      )}
                    >
                      {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                      {status.message}
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={loading || otp.length !== 4}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
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
                        <div className="font-medium text-slate-900">
                          {format(new Date(record.created_at), 'MMM dd, yyyy')}
                        </div>
                        <div className="text-xs text-slate-400">
                          {format(new Date(record.created_at), 'HH:mm')}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-600 text-sm">
                        {record.attendance_sessions?.teacher?.name || 'Unknown'}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold text-xs bg-emerald-50 px-2.5 py-1 rounded-full">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Present
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-slate-400 italic">
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
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Attendance Stats
          </h3>
          
          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative w-32 h-32 flex items-center justify-center mb-4">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  className="text-slate-100"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={364.4}
                  strokeDashoffset={364.4 - (364.4 * stats.percentage) / 100}
                  className={cn(
                    "transition-all duration-1000 ease-out",
                    stats.percentage >= 75 ? "text-emerald-500" : "text-amber-500"
                  )}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-slate-900">{stats.percentage}%</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Overall</span>
              </div>
            </div>
            <p className="text-slate-600 text-sm">
              You have been present for <span className="font-bold text-slate-900">{stats.attended}</span> out of <span className="font-bold text-slate-900">{stats.total}</span> classes.
            </p>
          </div>

          {stats.percentage < 75 && (
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-amber-900">Low Attendance Alert</h4>
                  <p className="text-xs text-amber-700 mt-1">
                    Your attendance is below the required 75% limit. Please attend classes regularly to avoid penalties.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-indigo-600 p-6 rounded-2xl shadow-lg text-white">
          <h3 className="font-bold mb-2">Smart Geofencing</h3>
          <p className="text-indigo-100 text-sm leading-relaxed">
            The system automatically adjusts the attendance radius based on GPS accuracy. 
            This ensures you can mark attendance even with poor indoor signals, 
            while blocking those in nearby buildings or hostels.
          </p>
        </div>
      </div>
    </div>
  );
}
