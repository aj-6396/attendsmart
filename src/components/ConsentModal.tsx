import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, FileText, AlertCircle, CheckCircle2, ChevronDown, ExternalLink } from 'lucide-react';

interface ConsentModalProps {
  onAccept: () => void;
}

export default function ConsentModal({ onAccept }: ConsentModalProps) {
  const [tab, setTab] = useState<'privacy' | 'terms'>('privacy');
  const [ppRead, setPpRead] = useState(false);
  const [tosRead, setTosRead] = useState(false);
  const [checked, setChecked] = useState(false);
  const [declined, setDeclined] = useState(false);

  const canAccept = ppRead && tosRead && checked;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>, type: 'privacy' | 'terms') => {
    const el = e.currentTarget;
    const isBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (isBottom) {
      if (type === 'privacy') setPpRead(true);
      if (type === 'terms') setTosRead(true);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg bg-white rounded-[24px] shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-11 h-11 rounded-[14px] flex items-center justify-center" style={{ background: 'var(--color-primary, #002147)' }}>
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Before You Continue</h2>
              <p className="text-xs text-slate-500">Please review and accept our legal documents</p>
            </div>
          </div>

          {/* Data notice */}
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-[12px] flex gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              ClassMark collects your <strong>GPS location</strong> and a <strong>hardware device fingerprint</strong> to prevent proxy attendance. Your data is used solely for attendance verification.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => setTab('privacy')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors duration-150 ${
              tab === 'privacy'
                ? 'text-[#002147] border-b-2 border-[#002147]'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Privacy Policy
            {ppRead && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
          </button>
          <button
            onClick={() => setTab('terms')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors duration-150 ${
              tab === 'terms'
                ? 'text-[#002147] border-b-2 border-[#002147]'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <FileText className="w-4 h-4" />
            Terms of Use
            {tosRead && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
          </button>
        </div>

        {/* Content Area */}
        <div
          className="flex-1 overflow-y-auto px-6 py-4 text-slate-700 text-xs leading-relaxed space-y-4"
          style={{ minHeight: 0 }}
          onScroll={(e) => handleScroll(e, tab)}
        >
          {tab === 'privacy' ? <PrivacyContent /> : <TermsContent />}

          {/* Scroll hint */}
          {((tab === 'privacy' && !ppRead) || (tab === 'terms' && !tosRead)) && (
            <div className="sticky bottom-0 flex justify-center pt-2 pb-1 pointer-events-none">
              <motion.div
                animate={{ y: [0, 5, 0] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
                className="flex items-center gap-1 text-xs text-slate-400 bg-white/80 px-3 py-1 rounded-full"
              >
                <ChevronDown className="w-3 h-3" />
                Scroll to read
              </motion.div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-4 border-t border-slate-100 space-y-4">
          {/* Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <div
              onClick={() => setChecked(!checked)}
              className={`mt-0.5 w-5 h-5 rounded-[6px] border-2 flex items-center justify-center flex-shrink-0 transition-colors duration-150 ${
                checked
                  ? 'border-[#002147] bg-[#002147]'
                  : 'border-slate-300 group-hover:border-slate-400'
              }`}
            >
              {checked && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
            </div>
            <span className="text-xs text-slate-600 leading-relaxed">
              I have read and agree to ClassMark's <strong>Privacy Policy</strong> and <strong>Terms of Use</strong>, including the collection of my GPS location and device fingerprint for attendance verification.
            </span>
          </label>

          {/* Read both hint */}
          {(!ppRead || !tosRead) && (
            <p className="text-xs text-amber-600 text-center">
              Please scroll through both tabs to read them fully.
            </p>
          )}

          {/* Declined warning */}
          <AnimatePresence>
            {declined && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3 bg-red-50 border border-red-200 rounded-[12px] flex gap-2"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs text-red-800 leading-relaxed">
                  <strong>You must accept the terms to use ClassMark.</strong> This application requires GPS and device data to function for attendance. Without consent, access is not possible.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Buttons */}
          <div className="flex gap-2.5">
            <button
              onClick={() => setDeclined(true)}
              className="flex-1 h-11 rounded-[12px] border border-slate-200 text-slate-500 text-sm font-medium hover:bg-slate-50 transition-colors duration-150"
            >
              Decline
            </button>
            <button
              onClick={() => { if (canAccept) onAccept(); else setDeclined(true); }}
              disabled={!canAccept}
              className={`flex-1 h-11 rounded-[12px] text-white text-sm font-semibold transition-all duration-150 ${
                canAccept
                  ? 'bg-[#002147] hover:opacity-90 shadow-lg'
                  : 'bg-slate-300 cursor-not-allowed'
              }`}
            >
              I Accept
            </button>
          </div>

          <p className="text-center text-[11px] text-slate-400">
            Developed by Ambuj Singh & Aniket Verma
          </p>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Inline Policy Text ─────────────────────────────────────────── */

function PrivacyContent() {
  return (
    <>
      <h3 className="text-sm font-bold text-slate-900">Privacy Policy</h3>
      <p className="text-[11px] text-slate-400">Effective: April 16, 2025 · Developers: Ambuj Singh & Aniket Verma</p>

      <Section title="What We Collect">
        <ul className="list-disc pl-4 space-y-1">
          <li><strong>Account Data:</strong> Name, Enrollment No., Exam Roll No., Course, Semester, Section, Batch, and a 6-digit PIN (stored as a secure hash).</li>
          <li><strong>GPS Location:</strong> Your real-time coordinates and accuracy value at the exact moment you mark attendance. Up to 5 consecutive readings are captured (~5 seconds) to verify you are physically present.</li>
          <li><strong>Device Fingerprint:</strong> A hardware-derived identifier generated from your browser, screen, GPU, fonts, audio context, and timezone. This cannot be changed by clearing cache.</li>
          <li><strong>Attendance Records:</strong> Which sessions you attended, with associated timestamps and GPS data.</li>
        </ul>
      </Section>

      <Section title="Why We Collect It">
        <ul className="list-disc pl-4 space-y-1">
          <li>GPS location verifies you are physically inside the classroom radius before marking attendance.</li>
          <li>GPS samples detect mock/fake GPS apps used to spoof location.</li>
          <li>Device fingerprint binds your account to one device to prevent proxy attendance.</li>
        </ul>
      </Section>

      <Section title="What We DON'T Do">
        <ul className="list-disc pl-4 space-y-1">
          <li>We do NOT track your location continuously — only during the attendance action.</li>
          <li>We do NOT sell or share your data with advertisers.</li>
          <li>We do NOT collect biometric data, financial data, or national IDs.</li>
        </ul>
      </Section>

      <Section title="Third-Party Services">
        <ul className="list-disc pl-4 space-y-1">
          <li><strong>Supabase</strong> — Database & authentication (GDPR & SOC 2 compliant).</li>
          <li><strong>Vercel</strong> — API hosting (does not store personal data).</li>
          <li><strong>FingerprintJS (open-source)</strong> — Device ID generation, runs entirely on-device, no data sent to FingerprintJS servers.</li>
        </ul>
      </Section>

      <Section title="Data Retention">
        <p>GPS attendance records are stored permanently as institutional academic records. Device fingerprints are stored until an admin resets them or your account is deleted.</p>
      </Section>

      <Section title="Your Rights">
        <p>You may request access, correction, or deletion of your data through your institution's system administrator.</p>
      </Section>
    </>
  );
}

function TermsContent() {
  return (
    <>
      <h3 className="text-sm font-bold text-slate-900">Terms of Use</h3>
      <p className="text-[11px] text-slate-400">Effective: April 16, 2025 · Governed by the laws of India</p>

      <Section title="Acceptance">
        <p>By using ClassMark, you agree to these Terms. If you do not agree, you may not use this application.</p>
      </Section>

      <Section title="Prohibited Conduct">
        <p className="mb-1 font-medium text-slate-800">The following are strictly prohibited and may result in account suspension:</p>
        <ul className="list-disc pl-4 space-y-1">
          <li><strong>Proxy Attendance:</strong> Marking attendance for another student, or allowing another person to mark yours.</li>
          <li><strong>GPS Spoofing:</strong> Using mock location apps, VPNs, or any tool to falsify GPS coordinates.</li>
          <li><strong>Account Sharing:</strong> Sharing login credentials with any other person.</li>
          <li><strong>Device Manipulation:</strong> Modifying device fingerprint or localStorage to bypass device binding.</li>
          <li><strong>API Abuse:</strong> Calling backend APIs directly to bypass client-side checks.</li>
          <li><strong>OTP Sharing:</strong> Sharing the attendance OTP with absent students.</li>
        </ul>
      </Section>

      <Section title="Location & Device Consent">
        <p>You explicitly consent to:</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Collection of real-time GPS coordinates during each attendance marking event.</li>
          <li>Collection of up to 5 GPS readings for spoofing detection.</li>
          <li>Generation and permanent storage of a hardware-based device fingerprint linked to your account.</li>
        </ul>
      </Section>

      <Section title="One Device Policy">
        <p>Your account is bound to the first device used to mark attendance. To switch devices, request a device reset from your teacher or administrator.</p>
      </Section>

      <Section title="Institutional Authority">
        <p>Your institution's administrators and teachers may view your GPS attendance records, reset your device binding, manually override attendance, and suspend your account for violations.</p>
      </Section>

      <Section title="Disclaimer">
        <p>ClassMark is provided "as is". GPS accuracy may vary in indoor environments. We are not liable for inaccurate GPS readings caused by device or network limitations.</p>
      </Section>

      <Section title="Governing Law">
        <p>These Terms are governed by the laws of India. Disputes are subject to the jurisdiction of competent courts in India.</p>
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-bold text-slate-800 mb-1.5 uppercase tracking-wide">{title}</h4>
      <div className="text-slate-600 space-y-1">{children}</div>
    </div>
  );
}
