"use client";

import { useState, useEffect } from "react";

/** PWA: אירוע beforeinstallprompt מכיל prompt() */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<{ prompt: () => Promise<{ outcome: string }> } | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt({ prompt: () => e.prompt() });
    };
    window.addEventListener("beforeinstallprompt", handler as EventListener);
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener);
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
