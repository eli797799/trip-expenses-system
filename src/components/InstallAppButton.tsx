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
        className="text-[var(--muted)] hover:text-[var(--foreground)] text-sm py-2 px-3 rounded-lg border border-white/10 tap-target hover:bg-white/5 transition-all"
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
      className="text-[var(--foreground)] text-sm py-2 px-3 rounded-lg border border-white/10 tap-target hover:bg-white/5 hover:border-[var(--neon-blue)]/50 font-medium transition-all"
    >
      הורד אפליקציה
    </button>
  );
}
