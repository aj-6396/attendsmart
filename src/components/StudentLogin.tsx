import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, CheckCircle2, Loader2, ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';

interface StudentLoginProps {
  enrollmentNo: string;
  setEnrollmentNo: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  loading: boolean;
  error: string | null;
  message: { type: 'success' | 'error'; text: string } | null;
  onLogin: (e: React.FormEvent) => void;
  onRegister: () => void;
  onForgotPassword: () => void;
  onBack: () => void;
}

export default function StudentLogin({
  enrollmentNo,
  setEnrollmentNo,
  password,
  setPassword,
  loading,
  error,
  message,
  onLogin,
  onRegister,
  onForgotPassword,
  onBack,
}: StudentLoginProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full max-w-md sm:max-w-lg flex flex-col gap-3 sm:gap-4 mx-auto">
      {/* Top Bar with Logo and App Name */}
      <div className="p-3 sm:p-3.5 flex items-center justify-between border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#002147] dark:bg-blue-600 flex items-center justify-center text-white shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <span className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
            ClassMark
          </span>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors touch-target"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Change Role</span>
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="glass-card p-5 sm:p-7"
      >
        {/* Header */}
        <div className="mb-5 sm:mb-6">
          <h1 className="text-2xl font-bold text-[--color-text-primary] tracking-tight">Welcome Back</h1>
          <p className="text-[--color-text-secondary] text-xs sm:text-sm mt-1">Student Portal Access</p>
        </div>

        {/* Error Alert */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
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
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "alert mb-4",
              message.type === 'success' ? "alert--success" : "alert--error"
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
          <div className="field-group">
            <label className="field-label">Enrollment Number</label>
            <input
              type="text"
              value={enrollmentNo}
              onChange={(e) => setEnrollmentNo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="field-input font-mono"
              placeholder="e.g. 123456"
              inputMode="numeric"
              maxLength={6}
              required
            />
            <p className="text-xs text-[--color-text-secondary] mt-1">
              6-digit enrollment number from your college ID
            </p>
          </div>

          <div className="field-group">
            <label className="field-label">Password (6-digit PIN)</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="field-input pr-12 font-mono"
                placeholder="••••••"
                pattern="\d{6}"
                maxLength={6}
                inputMode="numeric"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 touch-target flex items-center justify-center"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="text-right mt-1.5">
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold py-1 inline-block"
              >
                Forgot password?
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-gradient mt-4 w-full"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Sign In'}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-5 sm:my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[--color-glass-border]" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 bg-[--color-surface] text-[--color-text-secondary]">or</span>
          </div>
        </div>

        {/* Register Link */}
        <button
          type="button"
          onClick={onRegister}
          className="w-full py-3 px-4 border border-blue-200 dark:border-blue-800/60 rounded-xl text-blue-600 dark:text-blue-400 font-bold text-xs sm:text-sm hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all min-h-[44px] flex items-center justify-center active:scale-[0.98]"
        >
          New Student? Register Here
        </button>
      </motion.div>
    </div>
  );
}
