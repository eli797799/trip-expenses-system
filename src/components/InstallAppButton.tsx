"use client";

import { useState, useEffect } from "react";

export function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<{ prompt: () => Promise<void> } | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt({ prompt: () => (e as { prompt: () => Promise<void> }).prompt() });
    };
    window.addEventListener("beforeinstallprompt", handler);
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (installed) return null;
  if (!deferredPrompt) {
    return (
      <a
        href="/"
        className="text-slate-500 text-sm py-2 px-3 rounded-lg border border-slate-200 tap-target hover:bg-slate-50"
        title="הוסף למסך הבית"
      >
        הורד אפליקציה
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={() => deferredPrompt.prompt().then(() => setDeferredPrompt(null))}
      className="text-slate-600 text-sm py-2 px-3 rounded-lg border border-slate-200 tap-target hover:bg-slate-50 font-medium"
    >
      הורד אפליקציה
    </button>
  );
}
