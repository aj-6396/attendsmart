import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Converts a Blob into a base64 encoded string.
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = (err) => reject(err);
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Standard browser download fallback using Object URL.
 */
function fallbackWebDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    if (document.body.contains(link)) {
      document.body.removeChild(link);
    }
    URL.revokeObjectURL(url);
  }, 500);
}

/**
 * Universal file downloader that works seamlessly on both Web and native Mobile (Capacitor Android/iOS).
 * Native WebViews often block standard HTML5 `a[download]` blob URLs. This utility converts blobs to base64,
 * writes them to device storage via `@capacitor/filesystem`, and opens the native system share/save dialog via `@capacitor/share`.
 */
export async function downloadFile(filename: string, content: Blob | string, mimeType: string): Promise<void> {
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;

  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = await blobToBase64(blob);
      const writeResult = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      });

      const canShareRes = await Share.canShare().catch(() => ({ value: true }));
      if (canShareRes.value !== false) {
        await Share.share({
          title: filename,
          text: `Exported ${filename}`,
          url: writeResult.uri,
          dialogTitle: `Save or Open ${filename}`,
        });
      } else {
        fallbackWebDownload(filename, blob);
      }
    } catch (err) {
      console.error('Native file save/share failed, falling back to web download:', err);
      fallbackWebDownload(filename, blob);
    }
  } else {
    fallbackWebDownload(filename, blob);
  }
}

