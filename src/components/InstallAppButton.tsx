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
      <button
        type="button"
        onClick={() =>
          alert(
            "הוספה למסך הבית:\n\n" +
              "• Chrome (אנדרואיד): תפריט ⋮ → \"הוסף למסך הבית\" או \"התקן אפליקציה\"\n\n" +
              "• Safari (iPhone/iPad): כפתור שתף ↓ → \"הוסף למסך הבית\"\n\n" +
              "• במחשב: בדפדפן לחץ על אייקון ההתקנה בשורת הכתובת (אם מופיע)."
          )
        }
        className="text-[var(--muted)] hover:text-[var(--foreground)] text-sm py-2 px-3 rounded-lg border border-white/10 tap-target hover:bg-white/5 transition-all"
        title="הוראות הוספה למסך הבית"
      >
        הורד אפליקציה
      </button>
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
