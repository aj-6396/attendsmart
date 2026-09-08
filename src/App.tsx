/**
 * Copyright © 2026 Ambuj Singh. All Rights Reserved.
 * This code is proprietary and confidential. Unauthorized copying, 
 * distribution, or use is strictly prohibited.
 */

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { supabase } from './supabase';
import { LogIn, LogOut, User as UserIcon, ShieldCheck, GraduationCap, Loader2, AlertCircle, CheckCircle2, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { getDeviceFingerprint } from './lib/device';
import { authFetch } from './lib/authFetch';
import { subscribeToToasts, requestAllAppPermissions, AppToast } from './lib/notifications';
import { syncOfflineQueue } from './lib/offlineQueue';
import { Preferences } from '@capacitor/preferences';
import RoleSelection from './components/RoleSelection';
import StudentLogin from './components/StudentLogin';
import TeacherLogin from './components/TeacherLogin';
import ConsentModal from './components/ConsentModal';
import ThemeToggle from './components/ThemeToggle';
import AboutPage from './components/AboutPage';
import UpdateModal from './components/UpdateModal';
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/react"

// Lazy load heavy dashboard components for performance optimization
const TeacherDashboard = lazy(() => import('./components/TeacherDashboard'));
const StudentDashboard = lazy(() => import('./components/StudentDashboard'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));

export type UserRole = 'teacher' | 'student' | 'admin';

interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  // Flattened student fields
  enrollment_no?: string;
  exam_roll_no?: string;
  course?: string;
  semester?: string;
  major_subject?: string;
  section?: string;
  batch?: string;
  // Flattened teacher fields
  employee_id?: string;
  department?: string;
  // Original nested fields for reference
  student_profiles?: any;
  teacher_profiles?: any;
}

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot-password'>('login');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [loginType, setLoginType] = useState<UserRole>('student');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showAbout, setShowAbout] = useState(false);

  // Global Theme State
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('theme') === 'dark' ||
          (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
      } catch (e) {
        return false;
      }
    }
    return false;
  });

  useEffect(() => {
    try {
      if (darkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
    } catch (e) {
      // Ignore
    }
  }, [darkMode]);

  // Toast Notifications State
  const [toasts, setToasts] = useState<AppToast[]>([]);

  useEffect(() => {
    requestAllAppPermissions();
    const unsubscribe = subscribeToToasts((toast) => {
      setToasts(prev => [toast, ...prev.slice(0, 4)]);
      // Auto dismiss after 5 seconds
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, 5000);
    });

    // Auto-sync offline attendance queue when internet returns
    const handleOnline = () => {
      syncOfflineQueue(authFetch);
    };

    if (navigator.onLine) {
      syncOfflineQueue(authFetch);
    }

    window.addEventListener('online', handleOnline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  // Consent gate — checks localStorage and native SharedPreferences
  const [consentAccepted, setConsentAccepted] = useState<boolean>(
    () => {
      try {
        return localStorage.getItem('classmark_consent_v1') === 'accepted';
      } catch (e) {
        return false;
      }
    }
  );

  useEffect(() => {
    Preferences.get({ key: 'classmark_consent_v1' }).then(({ value }) => {
      if (value === 'accepted') {
        setConsentAccepted(true);
      }
    }).catch(() => { });
  }, []);

  const handleAcceptConsent = async () => {
    try {
      localStorage.setItem('classmark_consent_v1', 'accepted');
      await Preferences.set({ key: 'classmark_consent_v1', value: 'accepted' });
    } catch (e) {
      // Ignore
    }
    setConsentAccepted(true);
    requestAllAppPermissions();
  };

  // Form states
  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [examRollNo, setExamRollNo] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [course, setCourse] = useState('');
  const [semester, setSemester] = useState('');
  const [majorSubject, setMajorSubject] = useState('');
  const [section, setSection] = useState('');
  const [batch, setBatch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 4000);

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timer);
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    }).catch((err) => {
      console.warn('Session get error, proceeding to login:', err);
      clearTimeout(timer);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);

      if (session) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*, student_profiles(*), teacher_profiles(*)')
        .eq('id', userId)
        .single();

      if (error || !data) {
        setProfile(null);
      } else {
        // Flatten the profile data for easier access in components
        const studentProfile = Array.isArray(data.student_profiles) ? data.student_profiles[0] : data.student_profiles;
        const teacherProfile = Array.isArray(data.teacher_profiles) ? data.teacher_profiles[0] : data.teacher_profiles;

        const flattenedProfile = {
          ...data,
          ...studentProfile,
          ...teacherProfile
        };
        setProfile(flattenedProfile as UserProfile);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load user profile.');
    } finally {
      setLoading(false);
    }
  };

  const getEmailFromEnrollment = (no: string) => {
    if (no.includes('@')) return no;
    return `${no.toLowerCase()}@college.com`;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const identifier = loginType === 'student' ? enrollmentNo.trim() : teacherEmail.trim();
    if (!identifier || !password) return;

    if (!/^\d{6}$/.test(password)) {
      setError('Password must be exactly 6 digits.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const email = loginType === 'student' ? getEmailFromEnrollment(enrollmentNo.trim()) : teacherEmail.trim();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      // Device Fingerprint Check for Students
      if (loginType === 'student' && data?.user) {
        const { data: profileData } = await supabase
          .from('student_profiles')
          .select('device_id')
          .eq('id', data.user.id)
          .single();

        if (profileData && profileData.device_id) {
          const fingerprint = await getDeviceFingerprint();
          const localFallback = localStorage.getItem('device_id');
          // If the database matches EITHER the newly generated fingerprint OR the one we have saved in their browser
          if (profileData.device_id !== fingerprint && profileData.device_id !== localFallback) {
            await supabase.auth.signOut();
            throw new Error('Device Mismatch: Your account is locked to another device (likely the smartphone you used during registration). If you changed your phone, please ask your teacher to "Reset Your Device Link" during class.');
          }
        } else if (profileData && !profileData.device_id) {
          // If the device ID is currently null (reset by teacher), lock the new device ID!
          const fingerprint = await getDeviceFingerprint();
          await supabase
            .from('student_profiles')
            .update({ device_id: fingerprint })
            .eq('id', data.user.id);
        }
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Invalid credentials.');
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    // Registration is ONLY for students
    if (!enrollmentNo || !examRollNo || !password || !fullName || !course || !semester || !majorSubject || !batch || !section) {
      setError('Please fill all fields.');
      return;
    }

    if (!/^\d{6}$/.test(enrollmentNo)) {
      setError('Enrollment Number must be exactly 6 digits.');
      return;
    }

    if (!/^[a-zA-Z0-9]{11}$/.test(examRollNo)) {
      setError('Examination Roll Number must be exactly 11 alphanumeric characters.');
      return;
    }

    if (!/^\d{6}$/.test(password)) {
      setError('Password must be exactly 6 digits (numeric only).');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const email = getEmailFromEnrollment(enrollmentNo.trim());

      // 1. Call server-side registration to bypass rate limits and email confirmation
      const response = await authFetch('/api/auth/register-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollmentNo: enrollmentNo.trim(),
          examRollNo: examRollNo.trim(),
          fullName: fullName.trim(),
          course: course.trim(),
          semester: semester.trim(),
          majorSubject: majorSubject.trim(),
          batch: batch.trim(),
          section: section.trim(),
          password,
          deviceId: await getDeviceFingerprint()
        })
      });

      const text = await response.text();
      let data: any = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch (parseError) {
        console.error("Raw server response:", text);
        throw new Error(`Server connection error (${response.status}). Please try again.`);
      }

      if (!response.ok) throw new Error(data.error || 'Registration failed.');
      // ---
      // 2. Auto-login after successful registration
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) throw loginError;

      // Profile will be fetched by the onAuthStateChange listener
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Failed to register.');
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!window.confirm('Do you really want to log out?')) return;
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setSession(null);
      setProfile(null);
    }
  };

  // Toast popup renderer helper
  const renderToastContainer = () => (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-md px-4 pointer-events-none flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className={cn(
              "pointer-events-auto p-4 rounded-xl border shadow-lg flex items-start gap-3 bg-white dark:bg-slate-800",
              toast.type === 'success' && "border-emerald-500 text-emerald-900 dark:text-emerald-100",
              toast.type === 'error' && "border-rose-500 text-rose-900 dark:text-rose-100",
              toast.type === 'warning' && "border-amber-500 text-amber-900 dark:text-amber-100",
              toast.type === 'info' && "border-blue-500 text-blue-900 dark:text-blue-100"
            )}
          >
            <div className="flex-1">
              <h4 className="text-xs font-bold uppercase tracking-wider mb-0.5">{toast.title}</h4>
              <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">{toast.message}</p>
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
            >
              ✕
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );

  if (loading) {
    return (
      <div className="page animated-bg">
        <div className="dot-grid" />
        <div className="z-10 flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 text-[--color-primary] animate-spin" />
        </div>
      </div>
    );
  }

  // Consent gate — shown before ANYTHING else on first visit
  if (!consentAccepted) {
    return <ConsentModal onAccept={handleAcceptConsent} />;
  }

  if (!session || !profile) {
    return (
      <>
        {renderToastContainer()}
        <UpdateModal />
        <div className="page animated-bg">
          <div className="dot-grid" />

          {/* Loading State */}
          {loading && (
            <div className="z-10 flex items-center justify-center min-h-screen">
              <Loader2 className="w-8 h-8 text-[--color-primary] animate-spin" />
            </div>
          )}

          {/* About Screen */}
          {!loading && showAbout && (
            <AboutPage onBack={() => setShowAbout(false)} />
          )}

          {/* Role Selection Screen */}
          {!loading && !selectedRole && !showAbout && <RoleSelection
            onSelectRole={(role) => {
              setSelectedRole(role);
              setLoginType(role);
              setAuthMode('login');
              setError(null);
              setMessage(null);
            }}
            onShowAbout={() => setShowAbout(true)}
            darkMode={darkMode}
            toggleDarkMode={toggleDarkMode}
          />}

          {/* Login Screens */}
          {!loading && selectedRole && (
            <div className="container-app flex flex-col items-center justify-center min-h-screen px-3 sm:px-6">
              {authMode === 'login' && selectedRole === 'student' && (
                <StudentLogin
                  enrollmentNo={enrollmentNo}
                  setEnrollmentNo={setEnrollmentNo}
                  password={password}
                  setPassword={setPassword}
                  loading={loading}
                  error={error}
                  message={message}
                  onLogin={handleLogin}
                  onRegister={() => {
                    setAuthMode('register');
                    setMessage(null);
                    setError(null);
                  }}
                  onForgotPassword={() => {
                    setAuthMode('forgot-password');
                    setMessage(null);
                    setError(null);
                  }}
                  onBack={() => setSelectedRole(null)}
                />
              )}

              {authMode === 'login' && selectedRole === 'teacher' && (
                <TeacherLogin
                  teacherEmail={teacherEmail}
                  setTeacherEmail={setTeacherEmail}
                  password={password}
                  setPassword={setPassword}
                  loading={loading}
                  error={error}
                  message={message}
                  onLogin={handleLogin}
                  onForgotPassword={() => {
                    setAuthMode('forgot-password');
                    setMessage(null);
                    setError(null);
                  }}
                  onBack={() => setSelectedRole(null)}
                />
              )}

              {/* Register Form - only for students */}
              {selectedRole === 'student' && authMode === 'register' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5 }}
                  className="glass-card w-full max-w-sm mx-2 sm:mx-0"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-[--color-text-primary]">Create Account</h1>
                    <motion.button
                      onClick={() => {
                        setAuthMode('login');
                        setMessage(null);
                        setError(null);
                      }}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      className="p-2 hover:bg-white/5 rounded-lg transition-all duration-300"
                    >
                      <LogOut className="w-5 h-5 text-[--color-text-secondary]" />
                    </motion.button>
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="alert--error mb-4"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span className="text-xs">{error}</span>
                    </motion.div>
                  )}

                  <form onSubmit={handleRegister} className="space-y-3 max-h-[65vh] overflow-y-auto pr-1 -mr-1">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="field-group"
                    >
                      <label className="field-label">Full Name</label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="field-input"
                        placeholder="Ambuj Singh"
                        required
                      />
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                      className="field-group"
                    >
                      <label className="field-label">Enrollment No (6 Digits)</label>
                      <input
                        type="text"
                        value={enrollmentNo}
                        onChange={(e) => setEnrollmentNo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="field-input"
                        placeholder="123456"
                        maxLength={6}
                        required
                      />
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="field-group"
                    >
                      <label className="field-label">Exam Roll No (11 Characters)</label>
                      <input
                        type="text"
                        value={examRollNo}
                        onChange={(e) => setExamRollNo(e.target.value.toUpperCase().slice(0, 11))}
                        className="field-input"
                        placeholder="24220MAT123"
                        maxLength={11}
                        required
                      />
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 }}
                      className="grid grid-cols-2 gap-3"
                    >
                      <div className="field-group">
                        <label className="field-label">Course</label>
                        <select
                          value={course}
                          onChange={(e) => setCourse(e.target.value)}
                          className="field-input bg-white/[0.07]"
                          required
                        >
                          <option value="">Select</option>
                          <option value="BSc Hons">BSc Hons</option>
                          <option value="MSc">MSc</option>
                          <option value="B.Tech">B.Tech</option>
                          <option value="M.Tech">M.Tech</option>
                        </select>
                      </div>
                      <div className="field-group">
                        <label className="field-label">Semester</label>
                        <select
                          value={semester}
                          onChange={(e) => setSemester(e.target.value)}
                          className="field-input bg-white/[0.07]"
                          required
                        >
                          <option value="">Select</option>
                          {[1, 2, 3, 4, 5, 6, 7, 8].map(s => {
                            let suffix = 'th';
                            if (s === 1) suffix = 'st';
                            else if (s === 2) suffix = 'nd';
                            else if (s === 3) suffix = 'rd';
                            return <option key={s} value={`${s}`}>{s}{suffix}</option>
                          })}
                        </select>
                      </div>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="field-group"
                    >
                      <label className="field-label">Major Subject</label>
                      <select
                        value={majorSubject}
                        onChange={(e) => setMajorSubject(e.target.value)}
                        className="field-input bg-white/[0.07]"
                        required
                      >
                        <option value="">Select</option>
                        <option value="Computer Science">Computer Science</option>
                        <option value="Mathematics">Mathematics</option>
                        <option value="Physics">Physics</option>
                        <option value="Chemistry">Chemistry</option>
                      </select>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35 }}
                      className="grid grid-cols-2 gap-3"
                    >
                      <div className="field-group">
                        <label className="field-label">Section</label>
                        <select
                          value={section}
                          onChange={(e) => setSection(e.target.value)}
                          className="field-input bg-white/[0.07]"
                          required
                        >
                          <option value="">Select</option>
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                          <option value="M1">M1</option>
                          <option value="M2">M2</option>
                          <option value="M3">M3</option>
                        </select>
                      </div>
                      <div className="field-group">
                        <label className="field-label">Batch</label>
                        <input
                          type="text"
                          value={batch}
                          onChange={(e) => setBatch(e.target.value)}
                          className="field-input"
                          placeholder="2026-27"
                          required
                        />
                      </div>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="field-group"
                    >
                      <label className="field-label">Password (6-digit PIN)</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="field-input"
                        placeholder="••••••"
                        pattern="\d{6}"
                        maxLength={6}
                        required
                      />
                    </motion.div>
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.45 }}
                      type="submit"
                      disabled={loading}
                      className="btn-gradient mt-4 w-full"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Create Account
                    </motion.button>
                  </form>
                </motion.div>
              )}

              {/* Forgot Password Screen */}
              {authMode === 'forgot-password' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5 }}
                  className="glass-card w-full max-w-sm mx-2 sm:mx-0"
                >
                  <div className="space-y-6">
                    <div className="glass-card--warning rounded-[14px]">
                      <div className="flex gap-3 mb-4">
                        <div className="icon-box--sm icon-box--warning shrink-0">
                          <AlertCircle className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-[--color-warning] mb-2">Forgot Password?</h3>
                          <p className="text-xs text-[--color-text-secondary] leading-relaxed mb-3">
                            For security reasons, password resets are handled by administration.
                          </p>
                          <div className="space-y-2">
                            <div className="text-xs text-[--color-text-secondary] flex gap-2">
                              <span className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-[--color-warning]" />
                              <span><strong>Students:</strong> Contact your teacher or department head</span>
                            </div>
                            <div className="text-xs text-[--color-text-secondary] flex gap-2">
                              <span className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-[--color-warning]" />
                              <span><strong>Teachers:</strong> Contact system administrator</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <motion.button
                      type="button"
                      onClick={() => {
                        setAuthMode('login');
                        setError(null);
                        setMessage(null);
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="back-btn w-full justify-center"
                    >
                      <LogIn className="w-4 h-4" />
                      Back to Sign In
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <SpeedInsights />
      <Analytics />
      {renderToastContainer()}
      <UpdateModal />
      <div className="page animated-bg">
        <div className="dot-grid" />
        {/* Only show global header for students or logged-out users */}
        {(!profile || profile.role === 'student') && (
          <header className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm sticky top-2 z-50 mx-2 sm:mx-4 mt-2 rounded-xl">
            <div className="px-5 h-14 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#002147] dark:bg-blue-600 flex items-center justify-center text-white">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <span className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">ClassMark</span>
              </div>

              <div className="flex items-center gap-2">
                <ThemeToggle darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
                {session && (
                  <button
                    onClick={handleLogout}
                    className="p-2 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition-colors"
                    title="Logout"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </header>
        )}

        <main className={cn(
          "container-app max-w-7xl mx-auto relative py-6 sm:py-8 safe-area-bottom",
          (profile?.role === 'admin' || profile?.role === 'teacher') ? "px-2 sm:px-4" : "px-2 sm:px-0"
        )}>
          <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
              <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-600" />
              <p className="text-sm font-black uppercase tracking-widest animate-pulse">Initializing Module...</p>
            </div>
          }>
            {profile?.role === 'admin' ? (
              <AdminDashboard user={session.user} profile={profile} onLogout={handleLogout} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
            ) : profile?.role === 'teacher' ? (
              <TeacherDashboard user={session.user} profile={profile} onLogout={handleLogout} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
            ) : (
              <StudentDashboard user={session.user} profile={profile!} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
            )}
          </Suspense>
        </main>
        <Analytics />
        <SpeedInsights />
      </div>
    </>
  );
}
