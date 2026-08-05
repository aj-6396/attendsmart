import React, { useEffect, useState } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Download, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

// GitHub repository name for release updates
const GITHUB_REPO = 'aj-6396/attendsmart';

interface ReleaseInfo {
  version: string;
  downloadUrl: string;
  releaseNotes: string;
}

export default function UpdatePrompt() {
  const [updateAvailable, setUpdateAvailable] = useState<ReleaseInfo | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkUpdate();
  }, []);

  const checkUpdate = async () => {
    try {
      setChecking(true);

      // We usually only force updates on native Android/iOS
      if (!Capacitor.isNativePlatform()) {
        setChecking(false);
        return;
      }

      // 1. Get current app version
      const appInfo = await App.getInfo();
      const detectedVersion = appInfo.version || '1.0.0';
      setCurrentVersion(detectedVersion);

      // 2. Fetch latest release from GitHub
      const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
      
      if (!response.ok) {
        throw new Error('Could not fetch latest release info');
      }
      
      const data = await response.json();
      
      // GitHub tags are often "v1.0.2", strip the "v" if present
      const latestVersion = data.tag_name?.replace(/^v/, '').trim() || '0.0.0';

      // 3. Compare versions
      if (isNewerVersion(detectedVersion, latestVersion)) {
        // Find the APK asset if available, otherwise fallback to the release page HTML url
        let downloadUrl = data.html_url;
        if (data.assets && data.assets.length > 0) {
          const apkAsset = data.assets.find((asset: any) => asset.name.endsWith('.apk'));
          if (apkAsset) {
            downloadUrl = apkAsset.browser_download_url;
          }
        }

        setUpdateAvailable({
          version: latestVersion,
          downloadUrl: downloadUrl,
          releaseNotes: data.body || 'Bug fixes and performance improvements.',
        });
      }
    } catch (err) {
      console.error('Failed to check for updates:', err);
      // We don't want to block the app if the check fails (e.g. no internet)
    } finally {
      setChecking(false);
    }
  };

  const isNewerVersion = (current: string, latest: string) => {
    const cleanCurrent = (current || '').replace(/^v/, '').trim();
    const cleanLatest = (latest || '').replace(/^v/, '').trim();

    const currentParts = cleanCurrent.split('.').map(num => parseInt(num, 10) || 0);
    const latestParts = cleanLatest.split('.').map(num => parseInt(num, 10) || 0);
    
    const maxLength = Math.max(currentParts.length, latestParts.length);
    for (let i = 0; i < maxLength; i++) {
      const c = currentParts[i] || 0;
      const l = latestParts[i] || 0;
      if (l > c) return true;
      if (c > l) return false;
    }
    return false;
  };

  const handleUpdate = () => {
    if (updateAvailable) {
      // Use _system to open the link in the external device browser so it can download the APK
      window.open(updateAvailable.downloadUrl, '_system');
    }
  };

  // If we are still checking, or no update is available, render nothing.
  if (checking || !updateAvailable) {
    return null;
  }

  // Mandatory Update Prompt
  return (
    <div className="fixed inset-0 z-[99999] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col"
      >
        <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
          <Download className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        
        <h2 className="text-xl font-bold text-center text-slate-900 dark:text-white mb-1">
          Update Required
        </h2>

        <div className="flex items-center justify-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 mb-4 bg-slate-100 dark:bg-slate-800/80 py-1.5 px-3 rounded-full mx-auto">
          <span>Installed: v{currentVersion}</span>
          <span>→</span>
          <span className="text-blue-600 dark:text-blue-400 font-semibold">New: v{updateAvailable.version}</span>
        </div>
        
        <p className="text-sm text-center text-slate-600 dark:text-slate-400 mb-4">
          A new version of ClassMark is available. You must update to continue using the app.
        </p>

        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 mb-4 max-h-28 overflow-y-auto">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Release Notes</h3>
          <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
            {updateAvailable.releaseNotes}
          </p>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3 mb-4 text-xs text-amber-800 dark:text-amber-300 flex gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <strong className="block mb-0.5">How to Complete Update:</strong>
            <ol className="list-decimal ml-4 space-y-0.5">
              <li>Tap <strong>Download Update</strong>.</li>
              <li>Open your phone's notification bar or Downloads folder.</li>
              <li>Tap the downloaded <strong>.apk</strong> file to install it.</li>
            </ol>
          </div>
        </div>

        <button 
          onClick={handleUpdate}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
        >
          <Download className="w-5 h-5" />
          Download Update (.apk)
        </button>
      </motion.div>
    </div>
  );
}
