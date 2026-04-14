import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { LogIn, LogOut, User as UserIcon, ShieldCheck, GraduationCap, Loader2, AlertCircle, CheckCircle2, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import TeacherDashboard from './components/TeacherDashboard';
import StudentDashboard from './components/StudentDashboard';
import AdminDashboard from './components/AdminDashboard';
import RoleSelection from './components/RoleSelection';
import StudentLogin from './components/StudentLogin';
import TeacherLogin from './components/TeacherLogin';
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
  const [selectedRole, setSelectedRole] = useState<'student' | 'teacher' | null>(null);
  const [loginType, setLoginType] = useState<UserRole>('student');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      
      // Device ID Check for Students
      if (loginType === 'student' && data?.user) {
         const { data: profileData } = await supabase
           .from('student_profiles')
           .select('device_id')
           .eq('id', data.user.id)
           .single();
           
         if (profileData && profileData.device_id) {
           let localDeviceId = localStorage.getItem('device_id');
           if (profileData.device_id !== localDeviceId) {
             await supabase.auth.signOut();
             throw new Error('Login denied: Your account is registered to another device.');
           }
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
          password,
          deviceId: (() => {
            let id = localStorage.getItem('device_id');
            if (!id) {
               id = crypto.randomUUID();
               localStorage.setItem('device_id', id);
            }
            return id;
          })()
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
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

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

  if (!session || !profile) {
    return (
      <div className="page animated-bg">
        <div className="dot-grid" />
        
        {/* Loading State */}
        {loading && (
          <div className="z-10 flex items-center justify-center min-h-screen">
            <Loader2 className="w-8 h-8 text-[--color-primary] animate-spin" />
          </div>
        )}

        {/* Role Selection Screen */}
        {!loading && !selectedRole && <RoleSelection onSelectRole={(role) => {
          setSelectedRole(role);
          setLoginType(role);
          setAuthMode('login');
          setError(null);
          setMessage(null);
        }} />}

        {/* Login Screens */}
        {!loading && selectedRole && (
          <div className="container-app flex flex-col items-center justify-center min-h-screen">
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
                className="glass-card w-full max-w-sm"
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

                <form onSubmit={handleRegister} className="space-y-3 max-h-[70vh] overflow-y-auto">
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
                      placeholder="John Doe"
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
                      placeholder="ABC12345678"
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
                        {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={`${s}`}>{s}st</option>)}
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
                      </select>
                    </div>
                    <div className="field-group">
                      <label className="field-label">Batch</label>
                      <input
                        type="text"
                        value={batch}
                        onChange={(e) => setBatch(e.target.value)}
                        className="field-input"
                        placeholder="2021-25"
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
                className="glass-card w-full max-w-sm"
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
    );
  }

  return (
    <div className="page animated-bg">
      <div className="dot-grid" />
      <header className="glass-card sticky top-4 z-50 mx-4 mt-4 rounded-[20px]">
        <div className="px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="icon-box--md icon-box--primary">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
          </div>

          <div className="flex-1 text-center">
            <span className="text-xl font-bold text-[--color-primary] dark:text-white tracking-tight">Class Mark</span>
          </div>

          <button
            onClick={handleLogout}
            className="icon-btn hover:text-[--color-error]"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="container-app max-w-7xl mx-auto relative z-10 py-8">
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
