import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface ThemeToggleProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
  className?: string;
}

export default function ThemeToggle({ darkMode, toggleDarkMode, className }: ThemeToggleProps) {
  return (
    <motion.button
      onClick={toggleDarkMode}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "relative p-2 rounded-xl transition-all duration-200 touch-target min-h-[40px] min-w-[40px] flex items-center justify-center",
        "bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200",
        className
      )}
      title={darkMode ? "Switch to Light Theme" : "Switch to Dark Theme"}
      aria-label="Toggle dark/light theme"
    >
      <div className="relative w-5 h-5">
        <motion.div
          animate={{
            scale: darkMode ? 0 : 1,
            rotate: darkMode ? 90 : 0,
            opacity: darkMode ? 0 : 1
          }}
          transition={{ duration: 0.25 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <Moon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </motion.div>
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale: darkMode ? 1 : 0,
            rotate: darkMode ? 0 : -90,
            opacity: darkMode ? 1 : 0
          }}
          transition={{ duration: 0.25 }}
          className="absolute inset-0 flex items-center justify-center text-amber-400"
        >
          <Sun className="w-4 h-4" />
        </motion.div>
      </div>
    </motion.button>
  );
}
