import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ConsentModalProps {
  onAccept: () => void;
}

export default function ConsentModal({ onAccept }: ConsentModalProps) {
  const [tab, setTab] = useState<'privacy' | 'terms'>('privacy');
  const [checked, setChecked] = useState(false);
  const [declined, setDeclined] = useState(false);

  const canAccept = checked;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-3 sm:pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#002147] dark:bg-blue-600 shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Before You Continue</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Please review and accept our institutional policies</p>
            </div>
          </div>

          {/* Data notice */}
          <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
              ClassMark collects real-time <strong>GPS location</strong> and a secure <strong>hardware device signature</strong> during attendance to prevent proxy marking.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setTab('privacy')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs sm:text-sm font-bold transition-colors min-h-[44px] ${
              tab === 'privacy'
                ? 'text-[#002147] dark:text-blue-400 border-b-2 border-[#002147] dark:border-blue-400'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Privacy Policy</span>
          </button>
          <button
            onClick={() => setTab('terms')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs sm:text-sm font-bold transition-colors min-h-[44px] ${
              tab === 'terms'
                ? 'text-[#002147] dark:text-blue-400 border-b-2 border-[#002147] dark:border-blue-400'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Terms of Use</span>
          </button>
        </div>

        {/* Content Area */}
        <div
          className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 text-slate-700 dark:text-slate-300 text-xs leading-relaxed space-y-4 touch-scroll"
          style={{ minHeight: 0 }}
        >
          {tab === 'privacy' ? <PrivacyContent /> : <TermsContent />}
        </div>

        {/* Footer with Safe Area */}
        <div className="px-4 sm:px-6 pb-5 sm:pb-6 pt-3 sm:pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3 sm:space-y-4 safe-area-pb">
          {/* Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <div
              onClick={() => setChecked(!checked)}
              className={`mt-0.5 w-5 h-5 rounded-[6px] border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                checked
                  ? 'border-[#002147] bg-[#002147] dark:border-blue-500 dark:bg-blue-600'
                  : 'border-slate-300 dark:border-slate-600 group-hover:border-slate-400'
              }`}
            >
              {checked && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed select-none">
              I have read and agree to ClassMark's <strong>Privacy Policy</strong> and <strong>Terms of Use</strong>, including GPS location and device verification for attendance.
            </span>
          </label>

          {/* Declined warning */}
          <AnimatePresence>
            {declined && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-[12px] flex gap-2"
              >
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-800 dark:text-red-200 leading-relaxed">
                  <strong>Consent is required:</strong> GPS and device integrity checks are necessary to mark attendance securely.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Buttons */}
          <div className="flex gap-2.5">
            <button
              onClick={() => setDeclined(true)}
              className="flex-1 h-11 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Decline
            </button>
            <button
              onClick={() => { if (canAccept) onAccept(); else setDeclined(true); }}
              disabled={!canAccept}
              className={`flex-1 h-11 rounded-xl text-white text-xs sm:text-sm font-bold transition-all ${
                canAccept
                  ? 'bg-[#002147] dark:bg-blue-600 hover:opacity-90 shadow-md active:scale-98'
                  : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed opacity-60'
              }`}
            >
              I Accept & Continue
            </button>
          </div>

          <p className="text-center text-[10px] text-slate-400">
            Developed by <a href="https://aj-7portfolio.vercel.app/" target="_blank" rel="noopener noreferrer" className="hover:underline">Ambuj Singh</a>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function PrivacyContent() {
  return (
    <>
      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Privacy Policy</h3>
      <p className="text-[11px] text-slate-400">Effective: 2026 · ClassMark Security Architecture</p>

      <Section title="What We Collect">
        <ul className="list-disc pl-4 space-y-1">
          <li><strong>Academic Profile:</strong> Full name, Enrollment Number, Examination Roll Number, Course, Semester, Section, and Batch.</li>
          <li><strong>Real-Time Location:</strong> GPS coordinates at the moment attendance is marked to confirm classroom physical presence.</li>
          <li><strong>Device Signature:</strong> An anonymous hardware-level fingerprint linking your attendance to your personal device.</li>
        </ul>
      </Section>

      <Section title="Why We Collect It">
        <ul className="list-disc pl-4 space-y-1">
          <li>To verify physical presence within the teacher's classroom boundary.</li>
          <li>To prevent fraudulent attendance through proxy marking or spoofed accounts.</li>
        </ul>
      </Section>

      <Section title="Data Protection & Privacy">
        <ul className="list-disc pl-4 space-y-1">
          <li>No continuous location tracking: GPS is accessed only during attendance submission.</li>
          <li>No third-party tracking or advertising data sharing.</li>
        </ul>
      </Section>
    </>
  );
}

function TermsContent() {
  return (
    <>
      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Terms of Use</h3>
      <p className="text-[11px] text-slate-400">Institutional Attendance Terms</p>

      <Section title="Prohibited Conduct">
        <ul className="list-disc pl-4 space-y-1">
          <li><strong>Proxy Marking:</strong> Attempting to mark attendance for another student is strictly prohibited.</li>
          <li><strong>Location Spoofing:</strong> Using mock location tools or proxy servers is logged and flagged.</li>
          <li><strong>Account Sharing:</strong> Sharing OTPs or login PINs with unauthorized parties.</li>
        </ul>
      </Section>

      <Section title="Device Binding Policy">
        <p>Your student profile is bound to your primary smartphone. If you switch devices, your faculty instructor can reset the device binding in class.</p>
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1 uppercase tracking-wide">{title}</h4>
      <div className="text-slate-600 dark:text-slate-400 space-y-1 text-xs">{children}</div>
    </div>
  );
}
