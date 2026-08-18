import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ShieldCheck, MapPin, Smartphone, Key } from 'lucide-react';

interface AboutPageProps {
  onBack: () => void;
}

export default function AboutPage({ onBack }: AboutPageProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="min-h-screen flex flex-col items-center justify-center px-3 sm:px-6 py-6 sm:py-12 safe-area-pt safe-area-pb"
    >
      <div className="w-full max-w-3xl glass-card p-5 sm:p-10 relative overflow-hidden">
        {/* Background Accents */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-blue-500 rounded-full blur-[100px] opacity-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-rose-500 rounded-full blur-[100px] opacity-10 pointer-events-none" />

        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors mb-6 group relative z-10 touch-target p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Back to role selection"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-bold text-sm">Back</span>
        </button>

        <div className="flex items-center gap-3.5 mb-8 relative z-10">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#002147] dark:bg-blue-600 flex items-center justify-center text-white shadow-md shrink-0">
            <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold text-[--color-text-primary] tracking-tight">ClassMark</h1>
            <p className="text-blue-600 dark:text-blue-400 font-semibold text-xs sm:text-sm mt-0.5">Smart Institutional Attendance System</p>
          </div>
        </div>

        <div className="space-y-6 sm:space-y-8 relative z-10">
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-[--color-text-primary] mb-2.5 border-b border-[--color-glass-border] pb-2">About ClassMark</h2>
            <p className="text-[--color-text-secondary] leading-relaxed text-xs sm:text-sm">
              ClassMark is a modern, GPS-verified institutional attendance monitoring platform built for colleges and universities. 
              It provides hardware-level device integrity, dynamic proximity verification, and tamper-resistant logging.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-4 sm:mt-6">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <Smartphone className="w-6 h-6 text-blue-600 dark:text-blue-400 mb-2" />
                <h3 className="font-bold text-[--color-text-primary] text-xs sm:text-sm mb-1">Hardware Locking</h3>
                <p className="text-[11px] sm:text-xs text-[--color-text-secondary]">Students are bound to their verified physical device.</p>
              </div>
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <MapPin className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mb-2" />
                <h3 className="font-bold text-[--color-text-primary] text-xs sm:text-sm mb-1">Smart Geofencing</h3>
                <p className="text-[11px] sm:text-xs text-[--color-text-secondary]">Dynamic indoor GPS accuracy checks using the Haversine model.</p>
              </div>
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <Key className="w-6 h-6 text-amber-600 dark:text-amber-400 mb-2" />
                <h3 className="font-bold text-[--color-text-primary] text-xs sm:text-sm mb-1">Dynamic OTP</h3>
                <p className="text-[11px] sm:text-xs text-[--color-text-secondary]">Live, time-limited OTP codes generated for each class session.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-bold text-[--color-text-primary] mb-3 border-b border-[--color-glass-border] pb-2">Developer & Architect</h2>
            <div className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-[#002147] dark:bg-blue-600 flex items-center justify-center text-white font-bold text-base shadow-sm shrink-0">
                  AS
                </div>
                <div>
                  <h3 className="font-bold text-[--color-text-primary] text-base">
                    <a href="https://aj-7portfolio.vercel.app/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1">
                      Ambuj Singh
                      <span className="text-xs">↗</span>
                    </a>
                  </h3>
                  <p className="text-[11px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">Founder & Lead Engineer</p>
                </div>
              </div>
              <p className="text-xs text-[--color-text-secondary] leading-relaxed">
                Focused on crafting secure, high-performance web and native mobile solutions for education and enterprise.
              </p>
            </div>
          </section>
          
          <div className="text-center pt-4 border-t border-[--color-glass-border]/50 text-[11px] text-[--color-text-secondary]">
            <p>ClassMark © 2026 <a href="https://aj-7portfolio.vercel.app/" target="_blank" rel="noopener noreferrer" className="hover:underline">Ambuj Singh</a>. All Rights Reserved.</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
