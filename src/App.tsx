import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { LogIn, LogOut, User as UserIcon, ShieldCheck, GraduationCap, Loader2, AlertCircle, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import TeacherDashboard from './components/TeacherDashboard';
import StudentDashboard from './components/StudentDashboard';
import AdminDashboard from './components/AdminDashboard';
import { Analytics } from "@vercel/analytics/next"

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
  const [loginType, setLoginType] = useState<UserRole>('student');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

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
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
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

    return () => subscription.unsubscribe();
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
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
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

    if (!/^[a-zA-Z0-9]{10}$/.test(examRollNo)) {
      setError('Examination Roll Number must be exactly 10 alphanumeric characters.');
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
      const response = await fetch('/api/auth/register-student', {
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
          password
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Registration failed.');

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
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!session || !profile) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors duration-300">
        <div className="fixed top-4 right-4">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-3 bg-white dark:bg-slate-900 rounded-full shadow-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-slate-100 dark:border-slate-800"
        >
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2 text-center">AttendSmart</h1>
          <p className="text-slate-600 mb-8 text-center">Secure, real-time attendance monitoring.</p>
          
          {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {message && (
            <div className={cn(
              "mb-6 p-3 rounded-lg text-sm flex items-center gap-2",
              message.type === 'success' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
            )}>
              {message.type === 'success' ? <ShieldCheck className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {message.text}
            </div>
          )}

          {(authMode === 'login') && (
            <div className="flex p-1 bg-slate-100 rounded-xl mb-6">
              <button
                onClick={() => setLoginType('student')}
                className={cn(
                  "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
                  loginType === 'student' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                Student
              </button>
              <button
                onClick={() => setLoginType('teacher')}
                className={cn(
                  "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
                  loginType === 'teacher' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                Teacher
              </button>
            </div>
          )}

          {authMode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              {loginType === 'student' ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Enrollment Number</label>
                  <input
                    type="text"
                    value={enrollmentNo}
                    onChange={(e) => setEnrollmentNo(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="e.g. EN123456"
                    required
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Teacher Email</label>
                  <input
                    type="email"
                    value={teacherEmail}
                    onChange={(e) => setTeacherEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="teacher@college.com"
                    required
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="6-digit PIN"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                />
                <div className="text-right mt-1">
                  <button 
                    type="button" 
                    onClick={() => {
                      setAuthMode('forgot-password');
                      setMessage(null);
                      setError(null);
                    }} 
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-indigo-200"
              >
                {loginType === 'student' ? 'Student Sign In' : 'Teacher Sign In'}
              </button>
              <p className="text-center text-sm text-slate-600">
                Student?{' '}
                <button type="button" onClick={() => {
                  setAuthMode('register');
                  setMessage(null);
                  setError(null);
                }} className="text-indigo-600 font-bold">Register here</button>
              </p>
            </form>
          ) : authMode === 'forgot-password' ? (
            <div className="space-y-6">
              <div className="p-6 bg-amber-50 border border-amber-100 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-amber-600" />
                  </div>
                  <h3 className="text-lg font-bold text-amber-900">Forgot Password?</h3>
                </div>
                <p className="text-sm text-amber-800 leading-relaxed mb-4">
                  For security reasons, password resets are handled manually by the administration.
                </p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-white/50 rounded-xl border border-amber-200/50">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <p className="text-xs text-amber-900">
                      <strong>Students:</strong> Please contact your Subject Teacher or Department Head.
                    </p>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-white/50 rounded-xl border border-amber-200/50">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <p className="text-xs text-amber-900">
                      <strong>Teachers:</strong> Please contact the System Administrator.
                    </p>
                  </div>
                </div>
              </div>
              
              <button 
                type="button" 
                onClick={() => setAuthMode('login')}
                className="w-full py-3 text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Enrollment No (6 Digits)</label>
                  <input
                    type="text"
                    value={enrollmentNo}
                    onChange={(e) => setEnrollmentNo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="e.g. 123456"
                    maxLength={6}
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Examination Roll No (10 Alphanumeric)</label>
                  <input
                    type="text"
                    value={examRollNo}
                    onChange={(e) => setExamRollNo(e.target.value.toUpperCase().slice(0, 10))}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="e.g. ABC1234567"
                    maxLength={10}
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Course</label>
                  <select
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    required
                  >
                    <option value="">Select Course</option>
                    <option value="BSc Hons">BSc Hons</option>
                    <option value="MSc">MSc</option>
                    <option value="B.Tech">B.Tech</option>
                    <option value="M.Tech">M.Tech</option>
                    <option value="BCA">BCA</option>
                    <option value="MCA">MCA</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Semester</label>
                  <select
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    required
                  >
                    <option value="">Select Semester</option>
                    <option value="1st">1st</option>
                    <option value="2nd">2nd</option>
                    <option value="3rd">3rd</option>
                    <option value="4th">4th</option>
                    <option value="5th">5th</option>
                    <option value="6th">6th</option>
                    <option value="7th">7th</option>
                    <option value="8th">8th</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Major Subject</label>
                  <select
                    value={majorSubject}
                    onChange={(e) => setMajorSubject(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    required
                  >
                    <option value="">Select Major</option>
                    <option value="Computer Science">Computer Science</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Biology">Biology</option>
                    <option value="Statistics">Statistics</option>
                    <option value="Electronics">Electronics</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Section</label>
                  <select
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    required
                  >
                    <option value="">Select Section</option>
                    <option value="M1">M1</option>
                    <option value="M2">M2</option>
                    <option value="M3">M3</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Batch</label>
                  <input
                    type="text"
                    value={batch}
                    onChange={(e) => setBatch(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="e.g. 2021-25"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password (6-digit PIN)</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="e.g. 123456"
                    pattern="\d{6}"
                    maxLength={6}
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-indigo-200 mt-4"
              >
                Create Student Account
              </button>
              <p className="text-center text-sm text-slate-600">
                Already have an account?{' '}
                <button type="button" onClick={() => {
                  setAuthMode('login');
                  setMessage(null);
                  setError(null);
                }} className="text-indigo-600 font-bold">Sign In</button>
              </p>
            </form>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-black text-slate-900 dark:text-white tracking-tight hidden sm:block">AttendSmart</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700">
              <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-[10px] font-bold">
                {profile?.name.charAt(0)}
              </div>
              <div className="flex flex-col hidden sm:flex">
                <span className="text-xs font-bold text-slate-900 dark:text-white leading-none">{profile?.name}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    ID: {profile?.role === 'student' ? (profile?.enrollment_no ? `${profile.enrollment_no.slice(0, 2)}****${profile.enrollment_no.slice(-2)}` : 'N/A') : profile?.employee_id}
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 text-[10px] uppercase font-bold bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 rounded-md border border-slate-200 dark:border-slate-700">
                {profile?.role}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {profile?.role === 'admin' ? (
          <AdminDashboard user={session.user} profile={profile} />
        ) : profile?.role === 'teacher' ? (
          <TeacherDashboard user={session.user} profile={profile} />
        ) : (
          <StudentDashboard user={session.user} profile={profile!} />
        )}
      </main>
    </div>
  );
}
