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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6">
      <div className="w-full max-w-2xl mb-6 sm:mb-8 p-3 sm:p-4 flex items-center justify-between border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl shadow-sm mx-2 sm:mx-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#002147] dark:bg-blue-600 flex items-center justify-center text-white">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <span className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            ClassMark
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={onShowAbout}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-[--color-primary] dark:text-slate-300 dark:hover:text-[--color-primary] transition-colors bg-slate-100 dark:bg-slate-700/50 px-3 py-1.5 rounded-lg"
          >
            <Info className="w-4 h-4" />
            <span className="hidden sm:inline">About App</span>
          </button>
          <ThemeToggle darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
        </div>
      </div>

      {/* Title Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-8 sm:mb-12 md:mb-16"
      >
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[--color-text-primary] mb-3">
          Choose Your Role
        </h1>
        <p className="text-[--color-text-secondary] text-sm sm:text-base max-w-xl mx-auto">
          Select how you want to access Class Mark
        </p>
      </motion.div>

      {/* Role Buttons Container */}
      <div className="grid grid-cols-1 gap-4 sm:gap-5 w-full max-w-2xl px-2 sm:px-0">
        {/* Student Card */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          whileHover={{ y: -8, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelectRole('student')}
          className="group relative overflow-hidden"
        >
          {/* Card background hover */}
          <div className="absolute inset-0 bg-[--color-primary] opacity-0 group-hover:opacity-5 transition-opacity duration-500" />
          
          {/* Glass card */}
          <div className="relative glass-card p-5 sm:p-6 md:p-8 h-full flex flex-col items-center justify-center border-2 border-[--color-glass-border] group-hover:border-[--color-primary]/50 transition-all duration-500">
            {/* Icon Container */}
            <motion.div
              whileHover={{ rotate: 10, scale: 1.1 }}
              transition={{ type: "spring", stiffness: 300, damping: 10 }}
              className="mb-4 sm:mb-6"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center shadow-lg shadow-[--color-glass-border] group-hover:shadow-xl transition-all duration-500" style={{ backgroundColor: "var(--color-primary)" }}>
                <GraduationCap className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
            </motion.div>

            {/* Text */}
            <h2 className="text-2xl md:text-3xl font-bold text-[--color-text-primary] mb-2 group-hover:text-[--color-primary] transition-colors duration-300">
              Student
            </h2>
            <p className="text-[--color-text-secondary] text-sm md:text-base text-center leading-relaxed group-hover:text-[--color-text-primary]/80 transition-colors duration-300">
              Track your attendance, view statistics, and manage your academic profile
            </p>

            {/* Button indicator */}
            <motion.div
              className="mt-6 px-6 py-2 bg-white/10 rounded-lg text-[--color-primary] text-sm font-semibold"
              whileHover={{ backgroundColor: "rgba(79, 172, 254, 0.2)" }}
              transition={{ duration: 0.3 }}
            >
              Get Started →
            </motion.div>
          </div>
        </motion.button>

        {/* Teacher Card */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          whileHover={{ y: -8, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelectRole('teacher')}
          className="group relative overflow-hidden"
        >
          {/* Card background hover */}
          <div className="absolute inset-0 bg-[--color-secondary] opacity-0 group-hover:opacity-5 transition-opacity duration-500" />
          
          {/* Glass card */}
          <div className="relative glass-card p-5 sm:p-6 md:p-8 h-full flex flex-col items-center justify-center border-2 border-[--color-glass-border] group-hover:border-[--color-accent]/50 transition-all duration-500">
            {/* Icon Container */}
            <motion.div
              whileHover={{ rotate: -10, scale: 1.1 }}
              transition={{ type: "spring", stiffness: 300, damping: 10 }}
              className="mb-4 sm:mb-6"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center shadow-lg shadow-[--color-glass-border] group-hover:shadow-xl transition-all duration-500" style={{ backgroundColor: "var(--color-secondary)" }}>
                <BookOpen className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
            </motion.div>

            {/* Text */}
            <h2 className="text-2xl md:text-3xl font-bold text-[--color-text-primary] mb-2 group-hover:text-[--color-accent] transition-colors duration-300">
              Teacher
            </h2>
            <p className="text-[--color-text-secondary] text-sm md:text-base text-center leading-relaxed group-hover:text-[--color-text-primary]/80 transition-colors duration-300">
              Manage classes, mark attendance, view analytics, and create sessions
            </p>

            {/* Button indicator */}
            <motion.div
              className="mt-6 px-6 py-2 bg-white/10 rounded-lg text-[--color-accent] text-sm font-semibold"
              whileHover={{ backgroundColor: "rgba(123, 97, 255, 0.2)" }}
              transition={{ duration: 0.3 }}
            >
              Get Started →
            </motion.div>
          </div>
        </motion.button>
      </div>

      {/* Clean background without floating elements */}
    </div>
  );
}
