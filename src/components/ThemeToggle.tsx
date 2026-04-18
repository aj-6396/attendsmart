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
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "relative p-2 rounded-xl transition-all duration-300",
        "bg-white/10 dark:bg-black/20 border border-white/10 dark:border-[#39ff14]/20",
        "hover:shadow-[0_0_15px_rgba(57,255,20,0.2)] dark:hover:shadow-[0_0_20px_rgba(57,255,20,0.4)]",
        className
      )}
      title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      <div className="relative w-6 h-6">
        <motion.div
          animate={{
            scale: darkMode ? 0 : 1,
            rotate: darkMode ? 90 : 0,
            opacity: darkMode ? 0 : 1
          }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <Moon className="w-5 h-5 text-indigo-600" />
        </motion.div>
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale: darkMode ? 1 : 0,
            rotate: darkMode ? 0 : -90,
            opacity: darkMode ? 1 : 0
          }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 flex items-center justify-center text-[#39ff14]"
        >
          <Sun className="w-5 h-5" />
        </motion.div>
      </div>
    </motion.button>
  );
}
