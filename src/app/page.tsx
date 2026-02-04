"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

function getSupabaseClient() {
  try {
    return createClient();
  } catch {
    return null;
  }
}

export default function HomePage() {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

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
      const { error: insertError } = await supabase.from("trips").insert({
        trip_code: tripCode,
        name: name.trim(),
        start_date: startDate || null,
        end_date: endDate || null,
      });

      if (insertError) {
        setError(insertError.message || "שגיאה ביצירת טיול");
        return;
      }
      window.location.href = `/trip/${tripCode}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה ביצירת טיול");
    } finally {
      setCreating(false);
    }
  }

  const supabase = getSupabaseClient();

  return (
    <div className="min-h-screen p-4 pt-[max(1rem,var(--safe-top))] pb-6 md:p-8 max-w-lg mx-auto">
      <h1 className="text-xl sm:text-2xl font-bold text-center mb-6 sm:mb-8">
        ניהול הוצאות טיול קבוצתי
      </h1>

      {!supabase && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-amber-800 text-sm">
          הגדר <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> ו־
          <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> ב־.env.local
        </div>
      )}

      <section className="bg-white rounded-xl shadow p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">הצטרף לטיול קיים</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim().length >= 4) {
              window.location.href = `/trip/${code.trim()}`;
            } else {
              setError("הזן קוד טיול בן 4 ספרות");
            }
          }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="קוד טיול (למשל 3215)"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="flex-1 border border-gray-300 rounded-xl px-4 py-3.5 text-lg min-h-[48px]"
            maxLength={4}
            dir="ltr"
            aria-label="קוד טיול"
          />
          <button
            type="submit"
            className="bg-slate-800 text-white px-6 py-3.5 rounded-xl font-medium min-h-[48px] tap-target shrink-0"
          >
            כניסה
          </button>
        </form>
      </section>

      <section className="bg-white rounded-xl shadow p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">צור טיול חדש</h2>
        {error && (
          <p className="text-red-600 text-sm mb-2">{error}</p>
        )}
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">שם הטיול *</label>
            <input
              type="text"
              placeholder="למשל: טיול לצפון, נופש אילת"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 min-h-[48px]"
              required
              aria-label="שם הטיול"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">תאריך התחלה</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 min-h-[48px]"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">תאריך סיום</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 min-h-[48px]"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={creating || !supabase}
            className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-medium min-h-[48px] tap-target disabled:opacity-50"
          >
            {creating ? "יוצר ומגריל קוד..." : "צור טיול"}
          </button>
        </form>
      </section>

      <p className="text-center text-gray-500 text-sm mt-4 sm:mt-6 px-1">
        הזן קוד טיול כדי לצפות ולהוסיף תשלומים.
      </p>
    </div>
  );
}
