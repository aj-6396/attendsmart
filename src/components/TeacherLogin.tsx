import React, { useState } from 'react';
import { motion } from 'motion/react';
import { LogIn, AlertCircle, CheckCircle2, Loader2, ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';

interface TeacherLoginProps {
  teacherEmail: string;
  setTeacherEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  loading: boolean;
  error: string | null;
  message: { type: 'success' | 'error'; text: string } | null;
  onLogin: (e: React.FormEvent) => void;
  onForgotPassword: () => void;
  onBack: () => void;
}

export default function TeacherLogin({
  teacherEmail,
  setTeacherEmail,
  password,
  setPassword,
  loading,
  error,
  message,
  onLogin,
  onForgotPassword,
  onBack,
}: TeacherLoginProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full max-w-md sm:max-w-lg flex flex-col gap-4">
      {/* Top Bar with Logo and App Name */}
      <div className="glass-card p-4 flex items-center gap-3 border border-[--color-glass-border] bg-white/10 shadow-xl">
        <div className="icon-box--sm icon-box--primary">
          <ShieldCheck className="w-4 h-4 text-white" />
        </div>
        <span className="text-lg sm:text-xl font-bold text-[--color-primary] dark:text-white tracking-tight">
          Class Mark
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-card"
      >
        {/* Header with back button */}
        <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[--color-text-primary]">Welcome Back</h1>
          <p className="text-[--color-text-secondary] text-sm mt-1">Teacher Login</p>
        </div>
        <div className="rounded-3xl p-1 bg-gradient-to-br from-red-400/25 via-red-500/20 to-red-600/20 backdrop-blur-sm border border-white/10">
          <motion.button
            onClick={onBack}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center justify-center rounded-2xl bg-white/10 p-3 transition-all duration-300"
            title="Back to role selection"
          >
            <ArrowLeft className="w-5 h-5 gradient-icon-red" />
          </motion.button>
        </div>
      </div>

      {/* Error Alert */}
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

      {/* Success Message */}
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "alert mb-4",
            message.type === 'success'
              ? "alert--success bg-[rgba(0,212,170,0.1)] border border-[rgba(0,212,170,0.3)] text-[--color-success]"
              : "alert--error"
          )}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span className="text-xs">{message.text}</span>
        </motion.div>
      )}

      {/* Form */}
      <form onSubmit={onLogin} className="space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="field-group"
        >
          <label className="field-label">Email Address</label>
          <input
            type="email"
            value={teacherEmail}
            onChange={(e) => setTeacherEmail(e.target.value)}
            className="field-input"
            placeholder="teacher@college.com"
            required
          />
          <p className="text-xs text-[--color-text-secondary] mt-2">
            Your institutional email address
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="field-group"
        >
          <label className="field-label">Password (6-digit PIN)</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="field-input pr-10"
              placeholder="••••••"
              pattern="\d{6}"
              maxLength={6}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[--color-text-secondary] hover:text-[--color-accent] transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="text-right mt-2">
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-xs text-[--color-accent] hover:text-[--color-secondary] transition-colors font-medium"
            >
              Forgot password?
            </button>
          </div>
        </motion.div>

        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          type="submit"
          disabled={loading}
          className="btn-gradient mt-6 w-full bg-gradient-to-r from-[--color-accent] to-purple-500"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Sign In'}
        </motion.button>
      </form>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[--color-glass-border]" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-2 bg-[--color-surface] text-[--color-text-secondary]">Need help?</span>
        </div>
      </div>

      {/* Admin Contact */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="p-3 bg-white/5 rounded-lg text-center"
      >
        <p className="text-xs text-[--color-text-secondary]">
          Contact your administrator or{' '}
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-[--color-accent] hover:text-[--color-secondary] font-medium transition-colors"
          >
            reset your password
          </button>
        </p>
      </motion.div>
      </motion.div>
    </div>
  );
}
