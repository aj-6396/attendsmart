import React, { useState } from 'react';
import { motion } from 'motion/react';
import { LogIn, LogOut, AlertCircle, CheckCircle2, Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
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
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-card w-full max-w-md sm:max-w-lg"
    >
      {/* Header with back button */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[--color-text-primary]">Welcome Back</h1>
          <p className="text-[--color-text-secondary] text-sm mt-1">Student Login</p>
        </div>
        <motion.button
          onClick={onBack}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="p-2 hover:bg-white/5 rounded-lg transition-all duration-300"
          title="Back to role selection"
        >
          <ArrowLeft className="w-5 h-5 text-[--color-text-secondary]" />
        </motion.button>
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
          <label className="field-label">Enrollment Number</label>
          <input
            type="text"
            value={enrollmentNo}
            onChange={(e) => setEnrollmentNo(e.target.value)}
            className="field-input"
            placeholder="e.g. EN123456"
            required
          />
          <p className="text-xs text-[--color-text-secondary] mt-2">
            6-digit enrollment number (shown on your ID card)
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[--color-text-secondary] hover:text-[--color-primary] transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="text-right mt-2">
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-xs text-[--color-primary] hover:text-[--color-secondary] transition-colors font-medium"
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
          className="btn-gradient mt-6 w-full"
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
          <span className="px-2 bg-[--color-surface] text-[--color-text-secondary]">or</span>
        </div>
      </div>

      {/* Register Link */}
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        type="button"
        onClick={onRegister}
        className="w-full py-3 px-4 border-2 border-[--color-glass-border] rounded-lg text-[--color-primary] font-semibold hover:bg-white/5 hover:border-[--color-primary]/50 transition-all duration-300"
      >
        New Student? Register Here
      </motion.button>
    </motion.div>
  );
}
