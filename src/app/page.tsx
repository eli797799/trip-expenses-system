"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

function getSupabaseClient() {
  try {
    return createClient();
  } catch {
    return null;
  }
}

type TripRow = {
  id: string;
  trip_code: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

export default function HomePage() {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [viewCodeCustom, setViewCodeCustom] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(true);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingName, setSavingName] = useState(false);

  async function generateUniqueTripCode(): Promise<string> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error("Supabase לא מוגדר");

    let code: string;
    let exists = true;
    do {
      code = String(Math.floor(1000 + Math.random() * 9000));
      const { data } = await supabase
        .from("trips")
        .select("id")
        .eq("trip_code", code)
        .maybeSingle();
      exists = data != null;
    } while (exists);
    return code;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setError("חסרים משתני סביבה: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY");
        return;
      }

      const tripCode = await generateUniqueTripCode();
      const viewCode =
        viewCodeCustom.trim().replace(/\D/g, "").length === 4
          ? viewCodeCustom.trim().replace(/\D/g, "").slice(0, 4)
          : String(Math.floor(1000 + Math.random() * 9000));
      const { error: insertError } = await supabase.from("trips").insert({
        trip_code: tripCode,
        name: name.trim(),
        start_date: startDate || null,
        end_date: endDate || null,
        view_code: viewCode,
      });

      if (insertError) {
        setError(insertError.message || "שגיאה ביצירת טיול");
        return;
      }
      alert(`קוד צפייה בסכומים: ${viewCode}\nשמור אותו – רק למי שיש את הקוד ${viewCode} תהיה גישה ל"כמה עלה הטיול" ו"מי משלם למי".`);
      window.location.href = `/trip/${tripCode}?view_code=${viewCode}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה ביצירת טיול");
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveTripName(tripCode: string) {
    const trimmed = editingName.trim();
    if (!trimmed || savingName) return;
    setSavingName(true);
    try {
      const res = await fetch(`/api/trips/${tripCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "שגיאה בעדכון השם");
        return;
      }
      setTrips((prev) =>
        prev.map((t) => (t.trip_code === tripCode ? { ...t, name: trimmed } : t))
      );
      setEditingTripId(null);
      setEditingName("");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בעדכון השם");
    } finally {
      setSavingName(false);
    }
  }

  const supabase = getSupabaseClient();

  // כניסה אוטומטית אם יש קוד ב-URL (?code=3215 או ?trip=3215)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const codeFromUrl = params.get("code")?.trim() || params.get("trip")?.trim();
    if (codeFromUrl && /^\d{4}$/.test(codeFromUrl)) {
      window.location.replace(`/trip/${codeFromUrl}`);
    }
  }, []);

  // טעינת רשימת הטיולים הקיימים (דרך API – עובד גם עם RLS)
  useEffect(() => {
    fetch("/api/trips")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setTrips(Array.isArray(data) ? data : []);
      })
      .catch(() => setTrips([]))
      .finally(() => setTripsLoading(false));
  }, []);

  function formatTripDate(d: string | null) {
    if (!d) return "";
    try {
      return new Date(d + "Z").toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return d;
    }
  }

  return (
    <div className="min-h-screen p-4 pt-[max(1rem,var(--safe-top))] pb-6 md:p-8 max-w-lg mx-auto">
      <h1 className="text-xl sm:text-2xl font-semibold text-center mb-6 sm:mb-8 text-[var(--foreground)] animate-fade-in opacity-0 [animation-fill-mode:forwards]">
        ניהול הוצאות טיול קבוצתי
      </h1>

      {!supabase && (
        <div className="glass-card p-4 mb-6 text-amber-300 text-sm border-amber-500/30 animate-fade-in opacity-0 animate-delay-1 [animation-fill-mode:forwards]">
          הגדר <code className="bg-white/10 px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> ו־
          <code className="bg-white/10 px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> ב־.env.local
        </div>
      )}

      {/* טיולים קיימים – כניסה בלי קוד */}
      {supabase && (
        <section className="glass-card p-4 sm:p-6 mb-6 animate-fade-in opacity-0 animate-delay-1 [animation-fill-mode:forwards]">
          <h2 className="text-base font-semibold text-[var(--foreground)] mb-3">טיולים קיימים</h2>
          {editingTripId && error && <p className="text-red-400 text-sm mb-2">{error}</p>}
          {tripsLoading ? (
            <p className="text-sm text-[var(--muted)]">טוען...</p>
          ) : trips.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">אין עדיין טיולים. צור טיול חדש למטה.</p>
          ) : (
            <ul className="space-y-2">
              {trips.map((t) => (
                <li key={t.id}>
                  {editingTripId === t.id ? (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        placeholder="שם הטיול"
                        className="flex-1 input-dark px-3 py-2 min-h-[40px] tap-target"
                        autoFocus
                        aria-label="שם הטיול"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveTripName(t.trip_code);
                          if (e.key === "Escape") {
                            setError("");
                            setEditingTripId(null);
                            setEditingName("");
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveTripName(t.trip_code)}
                        disabled={savingName || !editingName.trim()}
                        className="px-3 py-2 rounded-lg bg-[var(--neon)] text-[var(--background)] font-medium text-sm tap-target disabled:opacity-50"
                      >
                        {savingName ? "..." : "שמור"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setError("");
                          setEditingTripId(null);
                          setEditingName("");
                        }}
                        disabled={savingName}
                        className="px-3 py-2 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] tap-target disabled:opacity-50"
                      >
                        ביטול
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-colors">
                      <Link
                        href={`/trip/${t.trip_code}`}
                        className="flex-1 flex items-center justify-between gap-3 min-w-0 tap-target"
                      >
                        <span className="font-medium text-[var(--foreground)] truncate">{t.name}</span>
                        <span className="text-xs text-[var(--muted)] shrink-0">
                          {t.start_date || t.end_date ? formatTripDate(t.start_date || t.end_date) : `קוד ${t.trip_code}`}
                        </span>
                        <span className="text-[var(--neon)] shrink-0" aria-hidden>←</span>
                      </Link>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setError("");
                          setEditingTripId(t.id);
                          setEditingName(t.name);
                        }}
                        className="shrink-0 p-2 -m-2 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-white/5 tap-target"
                        aria-label={`ערוך שם טיול: ${t.name}`}
                        title="ערוך שם"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* צור טיול חדש */}
      <section className="glass-card p-4 sm:p-6 animate-fade-in opacity-0 animate-delay-1 [animation-fill-mode:forwards]">
        <button
          type="button"
          onClick={() => setShowCreateForm((v) => !v)}
          className="w-full text-right text-[var(--muted)] hover:text-[var(--foreground)] font-medium py-2 tap-target transition-colors"
          aria-expanded={showCreateForm}
        >
          {showCreateForm ? "▼ הסתר טופס" : "צור טיול חדש"}
        </button>
        {showCreateForm && (
          <>
            {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
            <form onSubmit={handleCreate} className="space-y-4 mt-4">
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">שם הטיול *</label>
                <input
                  type="text"
                  placeholder="למשל: טיול לצפון, נופש אילת"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full input-dark px-4 py-3 min-h-[48px] tap-target"
                  required
                  aria-label="שם הטיול"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">תאריך התחלה</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full input-dark px-4 py-3 min-h-[48px] tap-target"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">תאריך סיום</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full input-dark px-4 py-3 min-h-[48px] tap-target"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-[var(--muted)] mb-1">קוד צפייה בסכומים (4 ספרות, אופציונלי)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="ריק = אקראי. למשל 3215 – רק למי שיש את הקוד תהיה גישה"
                  value={viewCodeCustom}
                  onChange={(e) => setViewCodeCustom(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="w-full input-dark px-4 py-3 min-h-[48px] tap-target"
                  dir="ltr"
                  maxLength={4}
                  aria-label="קוד צפייה"
                />
              </div>
              <button
                type="submit"
                disabled={creating || !supabase}
                className="w-full btn-neon-green py-3.5 min-h-[48px] tap-target disabled:opacity-50"
              >
                {creating ? "יוצר ומגריל קוד..." : "צור טיול"}
              </button>
            </form>
          </>
        )}
      </section>

      <p className="text-center text-[var(--muted)] text-sm mt-4 sm:mt-6 px-1 animate-fade-in opacity-0 animate-delay-2 [animation-fill-mode:forwards]">
        לכניסה לטיול – בחר טיול מהרשימה למעלה או לחץ על הקישור שקיבלת. אין צורך להזין קוד.
      </p>
    </div>
  );
}
