import React from 'react';
import { motion } from 'motion/react';
import { GraduationCap, BookOpen, ShieldCheck, Info } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

interface RoleSelectionProps {
  onSelectRole: (role: 'student' | 'teacher' | 'admin') => void;
  onShowAbout: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export default function RoleSelection({ onSelectRole, onShowAbout, darkMode, toggleDarkMode }: RoleSelectionProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-3 sm:px-6 py-4 sm:py-8 safe-area-pt safe-area-pb">
      {/* Top Bar */}
      <div className="w-full max-w-2xl mb-6 sm:mb-8 p-3 sm:p-4 flex items-center justify-between border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#002147] dark:bg-blue-600 flex items-center justify-center text-white shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <span className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            ClassMark
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            onClick={onShowAbout}
            className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-[--color-primary] dark:text-slate-300 dark:hover:text-[--color-primary] transition-colors bg-slate-100 dark:bg-slate-700/60 px-3 py-2 rounded-lg min-h-[40px] touch-target"
            aria-label="About App"
          >
            <Info className="w-4 h-4" />
            <span className="hidden xs:inline sm:inline">About</span>
          </button>
          <ThemeToggle darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
        </div>
      </div>

      {/* Title Section */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center mb-6 sm:mb-10 max-w-xl mx-auto px-2"
      >
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-[--color-text-primary] mb-2 tracking-tight">
          Choose Your Role
        </h1>
        <p className="text-[--color-text-secondary] text-xs sm:text-base">
          Select how you want to access ClassMark
        </p>
      </motion.div>

      {/* Role Buttons Container */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 w-full max-w-2xl">
        {/* Student Card */}
        <motion.button
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          whileHover={{ y: -4, scale: 1.01 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onSelectRole('student')}
          className="group text-left"
        >
          <div className="glass-card p-5 sm:p-7 h-full flex flex-col items-center justify-center border-2 border-[--color-glass-border] group-hover:border-blue-500/50 transition-all duration-300 shadow-sm hover:shadow-md">
            {/* Icon Container */}
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shadow-md mb-4 shrink-0" style={{ backgroundColor: "#002147" }}>
              <GraduationCap className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </div>

            {/* Text */}
            <h2 className="text-xl sm:text-2xl font-bold text-[--color-text-primary] mb-1.5 text-center">
              Student
            </h2>
            <p className="text-[--color-text-secondary] text-xs sm:text-sm text-center leading-relaxed mb-4">
              Track attendance, verify sessions via GPS & OTP, and view stats
            </p>

            {/* Button indicator */}
            <div className="w-full py-2.5 px-4 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-xl text-xs sm:text-sm font-bold text-center border border-blue-200 dark:border-blue-900/50">
              Continue as Student →
            </div>
          </div>
        </motion.button>

        {/* Teacher Card */}
        <motion.button
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          whileHover={{ y: -4, scale: 1.01 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onSelectRole('teacher')}
          className="group text-left"
        >
          <div className="glass-card p-5 sm:p-7 h-full flex flex-col items-center justify-center border-2 border-[--color-glass-border] group-hover:border-purple-500/50 transition-all duration-300 shadow-sm hover:shadow-md">
            {/* Icon Container */}
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shadow-md mb-4 shrink-0" style={{ backgroundColor: "#800000" }}>
              <BookOpen className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </div>

            {/* Text */}
            <h2 className="text-xl sm:text-2xl font-bold text-[--color-text-primary] mb-1.5 text-center">
              Teacher
            </h2>
            <p className="text-[--color-text-secondary] text-xs sm:text-sm text-center leading-relaxed mb-4">
              Start geofenced sessions, generate OTPs, and export records
            </p>

            {/* Button indicator */}
            <div className="w-full py-2.5 px-4 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 rounded-xl text-xs sm:text-sm font-bold text-center border border-amber-200 dark:border-amber-900/50">
              Continue as Teacher →
            </div>
          </div>
        </motion.button>
      </div>
    </div>
  );
}
