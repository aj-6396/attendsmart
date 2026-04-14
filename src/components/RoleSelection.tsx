import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { GraduationCap, BookOpen, ShieldCheck, Sun, Moon } from 'lucide-react';

interface RoleSelectionProps {
  onSelectRole: (role: 'student' | 'teacher') => void;
}

export default function RoleSelection({ onSelectRole }: RoleSelectionProps) {
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
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6">
      <div className="w-full max-w-2xl mb-10 glass-card p-4 flex items-center justify-between border border-[--color-glass-border] bg-white/10 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="icon-box--sm icon-box--primary">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <span className="text-xl sm:text-2xl font-bold text-[--color-primary] dark:text-white tracking-tight">
            Class Mark
          </span>
        </div>
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="icon-btn"
          title="Toggle theme"
        >
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>

      {/* Title Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-12 sm:mb-16"
      >
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[--color-text-primary] mb-3">
          Choose Your Role
        </h1>
        <p className="text-[--color-text-secondary] text-sm sm:text-base max-w-xl mx-auto">
          Select how you want to access Class Mark
        </p>
      </motion.div>

      {/* Role Buttons Container */}
      <div className="grid grid-cols-1 gap-5 w-full max-w-2xl">
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
          <div className="relative glass-card p-6 sm:p-8 h-full flex flex-col items-center justify-center border-2 border-[--color-glass-border] group-hover:border-[--color-primary]/50 transition-all duration-500">
            {/* Icon Container */}
            <motion.div
              whileHover={{ rotate: 10, scale: 1.1 }}
              transition={{ type: "spring", stiffness: 300, damping: 10 }}
              className="mb-6"
            >
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg shadow-[--color-glass-border] group-hover:shadow-xl transition-all duration-500" style={{ backgroundColor: "var(--color-primary)" }}>
                <GraduationCap className="w-10 h-10 text-white" />
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
          <div className="relative glass-card p-6 sm:p-8 h-full flex flex-col items-center justify-center border-2 border-[--color-glass-border] group-hover:border-[--color-accent]/50 transition-all duration-500">
            {/* Icon Container */}
            <motion.div
              whileHover={{ rotate: -10, scale: 1.1 }}
              transition={{ type: "spring", stiffness: 300, damping: 10 }}
              className="mb-6"
            >
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg shadow-[--color-glass-border] group-hover:shadow-xl transition-all duration-500" style={{ backgroundColor: "var(--color-secondary)" }}>
                <BookOpen className="w-10 h-10 text-white" />
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
