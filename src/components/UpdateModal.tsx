import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Sparkles, X, ArrowUpCircle, ExternalLink } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

// Current installed app version
export const CURRENT_VERSION = '1.0.3';

interface ReleaseInfo {
  version: string;
  releaseUrl: string;
  downloadUrl?: string;
  body?: string;
  isMandatory?: boolean;
}

export default function UpdateModal() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [releaseInfo, setReleaseInfo] = useState<ReleaseInfo | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Only check if not already dismissed in current session
    const checkUpdates = async () => {
      try {
        const dismissedUntil = localStorage.getItem('classmark_update_dismissed');
        if (dismissedUntil && Date.now() < Number(dismissedUntil)) {
          return;
        }

        // 1. Fetch latest release from GitHub Releases API
        const res = await fetch('https://api.github.com/repos/aj-6396/classmark/releases/latest', {
          headers: { 'Accept': 'application/vnd.github.v3+json' },
        });

        if (res.ok) {
          const data = await res.json();
          const remoteTag = data.tag_name || data.name || '';
          const remoteVersion = remoteTag.replace(/^v/i, '').trim();

          if (remoteVersion && isNewerVersion(remoteVersion, CURRENT_VERSION)) {
            // Find APK asset download URL if available
            const apkAsset = data.assets?.find((a: any) => a.name?.endsWith('.apk'));
            
            setReleaseInfo({
              version: remoteVersion,
              releaseUrl: data.html_url || 'https://github.com/aj-6396/classmark/releases/latest',
              downloadUrl: apkAsset?.browser_download_url || data.html_url || 'https://github.com/aj-6396/classmark/releases/latest',
              body: data.body || 'New features, attendance calendar improvements & bug fixes.',
            });
            setUpdateAvailable(true);
            return;
          }
        }

        // 2. Fallback: check remote package.json if GitHub Releases has no release yet
        const rawRes = await fetch('https://raw.githubusercontent.com/aj-6396/classmark/main/package.json');
        if (rawRes.ok) {
          const pkgData = await rawRes.json();
          const remoteVersion = pkgData.version;

          if (remoteVersion && isNewerVersion(remoteVersion, CURRENT_VERSION)) {
            setReleaseInfo({
              version: remoteVersion,
              releaseUrl: 'https://github.com/aj-6396/classmark/releases/latest',
              downloadUrl: 'https://github.com/aj-6396/classmark/releases/latest',
              body: 'New features, Attendance Calendar & Push Notification system updates.',
            });
            setUpdateAvailable(true);
          }
        }
      } catch (err) {
        // Silently fail if offline or network error
        console.warn('Update check warning:', err);
      }
    };

    checkUpdates();
  }, []);

  // Semver comparison helper (returns true if remote > local)
  const isNewerVersion = (remote: string, local: string): boolean => {
    try {
      const rParts = remote.split('.').map(n => parseInt(n, 10) || 0);
      const lParts = local.split('.').map(n => parseInt(n, 10) || 0);
      for (let i = 0; i < Math.max(rParts.length, lParts.length); i++) {
        const r = rParts[i] || 0;
        const l = lParts[i] || 0;
        if (r > l) return true;
        if (r < l) return false;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    // Snooze for 12 hours
    try {
      localStorage.setItem('classmark_update_dismissed', String(Date.now() + 12 * 60 * 60 * 1000));
    } catch {}
  };

  const handleDownload = () => {
    const targetUrl = releaseInfo?.downloadUrl || releaseInfo?.releaseUrl || 'https://github.com/aj-6396/classmark/releases/latest';
    if (Capacitor.isNativePlatform()) {
      window.open(targetUrl, '_system');
    } else {
      window.open(targetUrl, '_blank');
    }
  };

  if (!updateAvailable || isDismissed || !releaseInfo) {
    return null;
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-7"
        >
          {/* Background Ambient Glow */}
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header Icon */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <ArrowUpCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                  Update v{releaseInfo.version}
                </span>
                <span className="text-[10px] text-slate-400">Current: v{CURRENT_VERSION}</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                New Update Available!
              </h3>
            </div>
          </div>

          {/* Body content */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 mb-5 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              What's New in this update:
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-line max-h-36 overflow-y-auto">
              {releaseInfo.body}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleDismiss}
              className="flex-1 py-3 px-4 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-center"
            >
              Later
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 py-3 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition active:scale-95"
            >
              <Download className="w-4 h-4" />
              Update Now
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
