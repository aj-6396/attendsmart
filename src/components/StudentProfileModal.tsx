import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, User, GraduationCap, BookOpen, Calendar, ShieldCheck, 
  Smartphone, Edit3, Save, CheckCircle2, AlertCircle, Loader2, Key, Hash
} from 'lucide-react';
import { authFetch } from '../lib/authFetch';
import { format } from 'date-fns';

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

export default function StudentProfileModal({
  isOpen,
  onClose,
  student,
  onSaved,
  isEditable = false,
}: StudentProfileModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [examRollNo, setExamRollNo] = useState('');
  const [course, setCourse] = useState('');
  const [semester, setSemester] = useState('');
  const [majorSubject, setMajorSubject] = useState('');
  const [batch, setBatch] = useState('');
  const [section, setSection] = useState('');

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
    }
  }, [student, isOpen]);

  if (!isOpen || !student) return null;

  const prof = student.profile || student;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Frontend validation
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
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-6">
            {/* Status Feedback Alerts */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="alert alert--error"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="text-xs font-medium">{error}</span>
              </motion.div>
            )}

            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="alert alert--success bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="text-xs font-medium">{success}</span>
              </motion.div>
            )}

            {isEditing ? (
              /* Editable Form for Teachers & Admins */
              <form onSubmit={handleSave} className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-indigo-600" />
                    Correct Student Profile
                  </h4>
                  <span className="text-[10px] text-slate-400 font-medium">Edit values carefully</span>
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

                {/* Form Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-gradient px-6 py-2.5 text-xs font-bold flex items-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Save className="w-4 h-4" /> Save Corrections
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* Read-only View */
              <div className="space-y-6">
                {/* Profile Grid Cards */}
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
                      <Calendar className="w-3.5 h-3.5 text-purple-500" /> Batch & Section
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

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                  {prof.created_at && (
                    <span className="text-[10px] text-slate-400 font-medium">
                      Registered: {format(new Date(prof.created_at), 'MMM dd, yyyy')}
                    </span>
                  )}

                  <div className="flex items-center gap-2 ml-auto">
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
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
