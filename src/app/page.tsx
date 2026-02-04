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

/** מחלץ קוד טיול (4 ספרות) מקישור מלא או מהזנה ישירה */
function extractTripCode(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  // קישור כמו .../trip/3215 או .../trip/3215/
  const match = trimmed.match(/\/trip\/(\d{4})\/?/);
  if (match) return match[1];
  // רק ספרות – קוד ישיר
  const digits = trimmed.replace(/\D/g, "").slice(0, 4);
  return digits.length === 4 ? digits : "";
}

export default function HomePage() {
  const [linkOrCode, setLinkOrCode] = useState("");
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

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
      const viewCode = String(Math.floor(1000 + Math.random() * 9000));
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
      alert(`קוד צפייה בסכומים: ${viewCode}\nשמור אותו – רק איתו אפשר לראות סך הוצאות ומי משלם למי.`);
      window.location.href = `/trip/${tripCode}?view_code=${viewCode}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה ביצירת טיול");
    } finally {
      setCreating(false);
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

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const tripCode = extractTripCode(linkOrCode);
    if (tripCode) {
      window.location.href = `/trip/${tripCode}`;
    } else {
      setError("הדבק קישור מלא לטיול או הזן קוד בן 4 ספרות");
    }
  }

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

      {/* כניסה לטיול – הפעולה הראשית */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-slate-800">כניסה לטיול</h2>
        <p className="text-slate-600 text-sm mb-3">
          יש לך קישור? הדבק כאן או הזן קוד – תיכנס אוטומטית לטיול.
        </p>
        <form onSubmit={handleJoin} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="הדבק קישור לטיול או הזן קוד (4 ספרות)"
            value={linkOrCode}
            onChange={(e) => setLinkOrCode(e.target.value)}
            className="flex-1 border border-gray-300 rounded-xl px-4 py-3.5 text-lg min-h-[48px]"
            dir="ltr"
            aria-label="קישור או קוד טיול"
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            className="bg-slate-800 text-white px-6 py-3.5 rounded-xl font-medium min-h-[48px] tap-target shrink-0"
          >
            כניסה לטיול
          </button>
        </form>
      </section>

      {/* צור טיול – משני, מתקפל */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6">
        <button
          type="button"
          onClick={() => setShowCreateForm((v) => !v)}
          className="w-full text-right text-slate-600 hover:text-slate-800 font-medium py-2 tap-target"
          aria-expanded={showCreateForm}
        >
          {showCreateForm ? "▼ הסתר" : "אין לך קישור? צור טיול חדש"}
        </button>
        {showCreateForm && (
          <>
            {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
            <form onSubmit={handleCreate} className="space-y-4 mt-4">
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
          </>
        )}
      </section>

      <p className="text-center text-gray-500 text-sm mt-4 sm:mt-6 px-1">
        כל מי שבטיול מקבל קישור – לחיצה על הקישור מכניסה אוטומטית לטיול.
      </p>
    </div>
  );
}
