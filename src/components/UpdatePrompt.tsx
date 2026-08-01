import React, { useEffect, useState } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Download } from 'lucide-react';
import { motion } from 'motion/react';

// TODO: Replace with your actual GitHub username and repository name
const GITHUB_REPO = 'aj-6396/classmark';

interface ReleaseInfo {
  version: string;
  downloadUrl: string;
  releaseNotes: string;
}

export default function UpdatePrompt() {
  const [updateAvailable, setUpdateAvailable] = useState<ReleaseInfo | null>(null);
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
      const currentVersion = appInfo.version;

      // 2. Fetch latest release from GitHub
      const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
      
      if (!response.ok) {
        throw new Error('Could not fetch latest release info');
      }
      
      const data = await response.json();
      
      // GitHub tags are often "v1.0.0", strip the "v" if present
      const latestVersion = data.tag_name?.replace(/^v/, '') || '0.0.0';

      // 3. Compare versions (simple string comparison works for semantic versioning like 1.0.0 vs 1.0.1)
      if (isNewerVersion(currentVersion, latestVersion)) {
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
    const currentParts = current.split('.').map(Number);
    const latestParts = latest.split('.').map(Number);
    
    for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
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
        
        <h2 className="text-xl font-bold text-center text-slate-900 dark:text-white mb-2">
          Update Required
        </h2>
        
        <p className="text-sm text-center text-slate-600 dark:text-slate-400 mb-6">
          A new version of the app (v{updateAvailable.version}) is available. You must update to continue using the app.
        </p>

        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-6 max-h-32 overflow-y-auto">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Release Notes</h3>
          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
            {updateAvailable.releaseNotes}
          </p>
        </div>

        <button 
          onClick={handleUpdate}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <Download className="w-5 h-5" />
          Download Update
        </button>
        
        <p className="text-xs text-center text-slate-500 mt-4">
          After downloading, open the APK file to install the update.
        </p>
      </motion.div>
    </div>
  );
}
