import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { emitToast } from './notifications';

type BackButtonHandler = () => boolean | Promise<boolean>;

// Priority stack for back button handlers
const handlerStack: { id: string; priority: number; handler: BackButtonHandler }[] = [];
let isListenerRegistered = false;
let lastBackPressTime = 0;

/**
 * Register global Capacitor back button listener once
 */
function ensureGlobalListener() {
  if (isListenerRegistered || !Capacitor.isNativePlatform()) return;

  isListenerRegistered = true;

  App.addListener('backButton', async () => {
    // Sort descending by priority (highest priority executed first)
    const sorted = [...handlerStack].sort((a, b) => b.priority - a.priority);

    for (const item of sorted) {
      try {
        const handled = await item.handler();
        if (handled) {
          // Handled successfully, stop propagation
          return;
        }
      } catch (err) {
        console.error('Error executing backButton handler:', err);
      }
    }

    // Default root behavior: Double-tap back to exit
    const now = Date.now();
    if (now - lastBackPressTime < 2000) {
      App.exitApp();
    } else {
      lastBackPressTime = now;
      emitToast({
        title: 'Exit ClassMark',
        message: 'Press back again to exit the app',
        type: 'info',
      });
    }
  });
}

/**
 * React hook to register a back button handler.
 * @param handler Function that returns true if it handled the event (e.g. closed a modal), false otherwise.
 * @param priority Higher priority runs first (e.g., Modals: 100, Subviews: 50, Navigation: 10).
 * @param enabled Whether this handler is currently active.
 */
export function useBackButton(
  handler: BackButtonHandler,
  enabled: boolean = true,
  priority: number = 10
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    ensureGlobalListener();

    if (!enabled) return;

    const id = Math.random().toString(36).substring(2, 9);
    const entry = {
      id,
      priority,
      handler: () => handlerRef.current(),
    };

    handlerStack.push(entry);

    return () => {
      const index = handlerStack.findIndex((item) => item.id === id);
      if (index !== -1) {
        handlerStack.splice(index, 1);
      }
    };
  }, [enabled, priority]);
}
