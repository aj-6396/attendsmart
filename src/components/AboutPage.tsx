import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ShieldCheck, MapPin, Smartphone, Key } from 'lucide-react';

interface AboutPageProps {
  onBack: () => void;
}

export default function AboutPage({ onBack }: AboutPageProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 py-12"
    >
      <div className="w-full max-w-3xl glass-card p-6 sm:p-10 relative overflow-hidden">
        {/* Background Accents */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-[--color-primary] rounded-full blur-[100px] opacity-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-[--color-accent] rounded-full blur-[100px] opacity-20 pointer-events-none" />

        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-[--color-text-secondary] hover:text-[--color-primary] transition-colors mb-8 group relative z-10"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back</span>
        </button>

        <div className="flex items-center gap-4 mb-8 relative z-10">
          <div className="w-14 h-14 rounded-xl bg-[#002147] dark:bg-blue-600 flex items-center justify-center text-white shadow-lg">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-[--color-text-primary] tracking-tight">ClassMark</h1>
            <p className="text-[--color-primary] font-medium mt-1">Smart Attendance System</p>
          </div>
        </div>

        <div className="space-y-8 relative z-10">
          <section>
            <h2 className="text-xl font-semibold text-[--color-text-primary] mb-3 border-b border-[--color-glass-border] pb-2">About the App</h2>
            <p className="text-[--color-text-secondary] leading-relaxed text-sm sm:text-base">
              ClassMark is a premium, institutional attendance monitoring system designed for modern colleges. 
              It leverages advanced technologies to ensure 100% attendance accuracy and prevent proxy marking.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
              <div className="glass-card--subtle p-5 rounded-xl border border-[--color-glass-border] hover:border-[--color-primary]/30 transition-colors">
                <Smartphone className="w-7 h-7 text-[--color-primary] mb-3" />
                <h3 className="font-semibold text-[--color-text-primary] text-sm mb-1">Hardware Locking</h3>
                <p className="text-xs text-[--color-text-secondary]">Students are securely locked to their registered devices.</p>
              </div>
              <div className="glass-card--subtle p-5 rounded-xl border border-[--color-glass-border] hover:border-[--color-secondary]/30 transition-colors">
                <MapPin className="w-7 h-7 text-[--color-secondary] mb-3" />
                <h3 className="font-semibold text-[--color-text-primary] text-sm mb-1">Geo-Fencing</h3>
                <p className="text-xs text-[--color-text-secondary]">Precise proximity checks using the Haversine Algorithm.</p>
              </div>
              <div className="glass-card--subtle p-5 rounded-xl border border-[--color-glass-border] hover:border-[--color-accent]/30 transition-colors">
                <Key className="w-7 h-7 text-[--color-accent] mb-3" />
                <h3 className="font-semibold text-[--color-text-primary] text-sm mb-1">Dynamic OTP</h3>
                <p className="text-xs text-[--color-text-secondary]">Time-bound, secure OTP verification for classes.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[--color-text-primary] mb-4 border-b border-[--color-glass-border] pb-2">Know the Developer</h2>
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="flex-1 glass-card--subtle p-5 rounded-xl border border-[--color-glass-border] hover:border-[--color-primary]/30 transition-colors group">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-md group-hover:scale-110 transition-transform">
                    AS
                  </div>
                  <div>
                    <h3 className="font-bold text-[--color-text-primary] text-lg">
                      <a href="https://aj-7portfolio.vercel.app/" target="_blank" rel="noopener noreferrer" className="hover:text-[--color-primary] transition-colors flex items-center gap-1.5 group/link">
                        Ambuj Singh
                        <svg className="w-4 h-4 opacity-0 -ml-2 group-hover/link:opacity-100 group-hover/link:translate-x-2 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </h3>
                    <p className="text-xs text-[--color-primary] font-medium uppercase tracking-wider">Founder & Developer</p>
                  </div>
                </div>
                <p className="text-sm text-[--color-text-secondary]">
                  Passionate about building secure, scalable, and intuitive software solutions for modern education.
                </p>
              </div>
            </div>
          </section>
          
          <div className="text-center mt-8 pt-6 border-t border-[--color-glass-border]/50 text-xs text-[--color-text-secondary]">
            <p>ClassMark © 2026 <a href="https://aj-7portfolio.vercel.app/" target="_blank" rel="noopener noreferrer" className="hover:text-[--color-primary] transition-colors underline decoration-dotted underline-offset-2">Ambuj Singh</a>. All Rights Reserved.</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
