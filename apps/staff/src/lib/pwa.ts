/**
 * @tepisawah/staff — PWA registration & install utilities.
 *
 * Provides:
 * - Service Worker registration
 * - Chromium `beforeinstallprompt` interception
 * - iOS Safari standalone detection
 * - State hook for in-app install triggers
 */
import { useEffect, useState } from "react";

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<(prompt: BeforeInstallPromptEvent | null) => void>();

function setDeferredPrompt(prompt: BeforeInstallPromptEvent | null) {
  deferredPrompt = prompt;
  for (const listener of promptListeners) {
    listener(deferredPrompt);
  }
}

/** Check if running inside installed standalone PWA */
export function isRunningStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const isStandaloneMedia = window.matchMedia("(display-mode: standalone)").matches;
  const isIosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return isStandaloneMedia || isIosStandalone;
}

/** Check if current browser is iOS Safari (where beforeinstallprompt is not supported) */
export function isIosDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const isApple = /iphone|ipad|ipod/.test(ua);
  return isApple && !isRunningStandalone();
}

/** Initialize Service Worker & PWA listeners */
export function initPwa(): void {
  if (typeof window === "undefined") return;

  // 1. Register Service Worker in production / supported environments
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          // Check for worker updates
          reg.addEventListener("updatefound", () => {
            const installing = reg.installing;
            if (!installing) return;
            installing.addEventListener("statechange", () => {
              if (installing.state === "installed" && navigator.serviceWorker.controller) {
                console.info("[PWA] Pembaruan portal staf siap dipakai.");
              }
            });
          });
        })
        .catch((err) => {
          console.warn("[PWA] Service Worker gagal didaftarkan:", err);
        });
    });
  }

  // 2. Intercept install prompt
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    setDeferredPrompt(e);
  });

  // 3. Listen for completed install
  window.addEventListener("appinstalled", () => {
    console.info("[PWA] Portal Staf Tepi Sawah berhasil dipasang!");
    setDeferredPrompt(null);
  });
}

/** Hook for UI components to inspect and trigger PWA installation */
export function usePwaInstall() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(deferredPrompt);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [showIosGuide, setShowIosGuide] = useState<boolean>(false);

  useEffect(() => {
    setIsInstalled(isRunningStandalone());

    const handlePromptChange = (newPrompt: BeforeInstallPromptEvent | null) => {
      setPrompt(newPrompt);
      setIsInstalled(isRunningStandalone());
    };

    promptListeners.add(handlePromptChange);

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setPrompt(null);
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      promptListeners.delete(handlePromptChange);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const isIos = isIosDevice();
  const canInstall = !isInstalled && (Boolean(prompt) || isIos);

  const triggerInstall = async (): Promise<"accepted" | "dismissed" | "ios" | "unsupported"> => {
    if (prompt) {
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice.outcome === "accepted") {
          setDeferredPrompt(null);
          return "accepted";
        }
        return "dismissed";
      } catch (err) {
        console.error("[PWA] Error launching install prompt:", err);
        return "unsupported";
      }
    }

    if (isIos) {
      setShowIosGuide(true);
      return "ios";
    }

    return "unsupported";
  };

  return {
    canInstall,
    isInstalled,
    isIos,
    showIosGuide,
    setShowIosGuide,
    triggerInstall,
  };
}
