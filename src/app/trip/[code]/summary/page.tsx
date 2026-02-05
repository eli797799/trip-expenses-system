"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { computeBalances, computeSettlements } from "@/lib/balance";
import type { TripRow, ParticipantRow, PaymentRow } from "@/types/database";

type Participant = {
  id: string;
  name: string;
  nickname: string | null;
  is_admin: boolean;
};

type PaymentWithPayer = PaymentRow & { payer: Participant };

type TripData = {
  id: string;
  name: string;
  trip_code: string;
  start_date: string | null;
  end_date: string | null;
  participants: ParticipantRow[];
  payments: PaymentWithPayer[];
};

type Summary = {
  total: number;
  participantCount: number;
  averagePerPerson: number;
  balances: {
    participantId: string;
    name: string;
    nickname: string | null;
    paid: number;
    expected: number;
    diff: number;
  }[];
  settlements: { fromName: string; toName: string; amount: number }[];
};

function getSupabaseClient() {
  try {
    return createClient();
  } catch {
    return null;
  }
}

function getTripDays(startDate: string | null, endDate: string | null): number {
  if (!startDate || !endDate) return 1;
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (end < start) return 1;
  return Math.max(1, Math.ceil((end - start) / (24 * 60 * 60 * 1000)) + 1);
}

function computeSummary(
  participants: ParticipantRow[],
  payments: PaymentWithPayer[],
  startDate: string | null,
  endDate: string | null
): Summary {
  const total = payments.reduce((s, p) => s + Number(p.amount), 0);
  const tripDays = getTripDays(startDate, endDate);
  const paidByParticipant = participants.map((p) => {
    const effectiveDays = p.days_in_trip != null ? Math.max(1, p.days_in_trip) : tripDays;
    return {
      participantId: p.id,
      name: p.name,
      nickname: p.nickname,
      sum: payments.filter((pay) => pay.paid_by_id === p.id).reduce((s, pay) => s + Number(pay.amount), 0),
      days: effectiveDays,
    };
  });
  const balances = computeBalances(total, paidByParticipant);
  const settlements = computeSettlements(balances).map((s) => ({
    fromName: s.fromName,
    toName: s.toName,
    amount: s.amount,
  }));
  const totalDays = paidByParticipant.reduce((s, p) => s + p.days, 0);
  const participantCount = participants.length;
  return {
    total: Math.round(total * 100) / 100,
    participantCount,
    averagePerPerson:
      participantCount > 0 ? Math.round((total / participantCount) * 100) / 100 : 0,
    balances: balances.map((b) => ({
      ...b,
      paid: Math.round(b.paid * 100) / 100,
      expected: Math.round(b.expected * 100) / 100,
      diff: Math.round(b.diff * 100) / 100,
    })),
    settlements,
  };
}

export default function TripSummaryPage() {
  const params = useParams();
  const code = params?.code as string;
  const [trip, setTrip] = useState<TripData | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adminCodeUnlocked, setAdminCodeUnlocked] = useState(false);
  const [adminCodeInput, setAdminCodeInput] = useState("");
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [viewCodeError, setViewCodeError] = useState("");

  const ADMIN_STORAGE_KEY = "trip_admin_";
  const ADMIN_CODE_VALUE_KEY = "trip_admin_code_";

  function checkAdminUnlocked() {
    if (typeof window === "undefined" || !code) return false;
    return localStorage.getItem(ADMIN_STORAGE_KEY + code) === "1";
  }

  async function verifyAdminCode(entered: string) {
    setVerifyingCode(true);
    setViewCodeError("");
    try {
      const res = await fetch(`/api/trips/${code}/verify-view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: entered }),
      });
      const data = (await res.json()) as { ok?: boolean };
      if (data.ok) {
        localStorage.setItem(ADMIN_STORAGE_KEY + code, "1");
        if (entered) localStorage.setItem(ADMIN_CODE_VALUE_KEY + code, entered);
        setAdminCodeUnlocked(true);
        setAdminCodeInput("");
      } else {
        setViewCodeError("קוד לא נכון");
      }
    } catch {
      setViewCodeError("שגיאה בבדיקה");
    } finally {
      setVerifyingCode(false);
    }
  }

  async function refresh() {
    if (!code) return;
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError("Supabase לא מוגדר");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: tripRow, error: tripErr } = await supabase
        .from("trips")
        .select("id, trip_code, name, start_date, end_date, created_at")
        .eq("trip_code", code)
        .single();

      if (tripErr || !tripRow) {
        setError("טיול לא נמצא");
        setTrip(null);
        setSummary(null);
        setLoading(false);
        return;
      }

      const tripId = (tripRow as TripRow).id;

      const { data: participants = [], error: partErr } = await supabase
        .from("participants")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: true });

      if (partErr) {
        setError(partErr.message);
        setLoading(false);
        return;
      }

      const { data: payments = [], error: payErr } = await supabase
        .from("payments")
        .select("*")
        .eq("trip_id", tripId)
        .order("paid_at", { ascending: false });

      if (payErr) {
        setError(payErr.message);
        setLoading(false);
        return;
      }

      const participantsList = participants as ParticipantRow[];
      const paymentsList = payments as PaymentRow[];

      const participantMap = new Map(participantsList.map((p) => [p.id, p]));
      const paymentsWithPayer: PaymentWithPayer[] = paymentsList.map((p) => {
        const payer = participantMap.get(p.paid_by_id);
        return {
          ...p,
          payer: payer
            ? {
                id: payer.id,
                name: payer.name,
                nickname: payer.nickname,
                is_admin: payer.is_admin,
              }
            : { id: p.paid_by_id, name: "?", nickname: null, is_admin: false },
        };
      });

      setError("");
      setTrip({
        id: tripId,
        name: (tripRow as TripRow).name,
        trip_code: (tripRow as TripRow).trip_code,
        start_date: (tripRow as TripRow).start_date,
        end_date: (tripRow as TripRow).end_date,
        participants: participantsList,
        payments: paymentsWithPayer,
      });
      setSummary(
        computeSummary(
          participantsList,
          paymentsWithPayer,
          (tripRow as TripRow).start_date,
          (tripRow as TripRow).end_date
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בטעינה");
      setTrip(null);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }

  function shareToWhatsApp() {
    if (!trip || !summary) return;

    let message = `📊 *סיכום טיול: ${trip.name}*\n\n`;
    message += `💰 סך הוצאות: ${summary.total.toFixed(2)} ₪\n`;
    message += `👥 מספר משתתפים: ${summary.participantCount}\n`;
    message += `📈 ממוצע למשתתף: ${summary.averagePerPerson.toFixed(2)} ₪\n\n`;

    if (summary.settlements.length > 0) {
      message += `💸 *חובות לסגירה:*\n`;
      summary.settlements.forEach((s) => {
        message += `• ${s.fromName} חייב ל-${s.toName} ${s.amount.toFixed(2)} ₪\n`;
      });
    } else {
      message += `✅ הכל מאוזן - אין חובות לסגירה\n`;
    }

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    window.open(whatsappUrl, "_blank");
  }

  function downloadExcel() {
    if (!trip || !summary) return;
    const BOM = "\uFEFF";
    const rows: string[] = [];
    const csv = (cells: (string | number)[]) =>
      cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",");

    rows.push("סיכום טיול");
    rows.push(csv(["סך הוצאות (₪)", "משתתפים", "ממוצע למשתתף (₪)"]));
    rows.push(csv([summary.total.toFixed(2), summary.participantCount, summary.averagePerPerson.toFixed(2)]));
    rows.push("");

    rows.push("פירוט משתתפים – כמה כל אחד צריך לשלם");
    rows.push(csv(["שם", "שילם (₪)", "צפוי (₪)", "הפרש (₪)"]));
    summary.balances.forEach((b) => {
      rows.push(csv([b.nickname || b.name, b.paid.toFixed(2), b.expected.toFixed(2), b.diff.toFixed(2)]));
    });
    rows.push("");

    rows.push("הוצאות מפורטות");
    rows.push(csv(["#", "תאריך", "סכום (₪)", "שילם", "תיאור", "הערה"]));
    trip.payments.forEach((p, i) => {
      rows.push(
        csv([
          i + 1,
          new Date(p.paid_at).toLocaleDateString("he-IL"),
          Number(p.amount).toFixed(2),
          p.payer?.nickname || p.payer?.name || "?",
          p.description || "",
          p.note || "",
        ])
      );
    });
    rows.push("");

    rows.push("העברות – מי משלם למי");
    rows.push(csv(["מ", "אל", "סכום (₪)"]));
    summary.settlements.forEach((s) => {
      rows.push(csv([s.fromName, s.toName, s.amount.toFixed(2)]));
    });

    const blob = new Blob([BOM + rows.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `סיכום-טיול-${trip.name.replace(/[^\w\s-]/g, "")}-${trip.trip_code}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    setAdminCodeUnlocked(checkAdminUnlocked());
  }, [code]);

  useEffect(() => {
    refresh();
  }, [code]);

  if (loading && !trip) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--muted)] animate-fade-in">טוען...</p>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen p-4 max-w-lg mx-auto bg-[var(--background)]">
        <p className="text-red-400 mb-4">{error || "טיול לא נמצא"}</p>
        <Link href="/" className="text-[var(--neon-blue)] hover:text-[var(--neon-purple)] underline min-h-[44px] inline-flex items-center tap-target transition-colors">
          חזרה לדף הבית
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 pb-8 md:p-6 max-w-2xl mx-auto bg-[var(--background)]">
      <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2 flex-wrap animate-fade-in opacity-0 [animation-fill-mode:forwards]">
        <Link href={`/trip/${code}`} className="text-[var(--muted)] hover:text-[var(--foreground)] text-sm underline py-2 tap-target shrink-0 transition-colors">
          ← חזרה לדף הטיול
        </Link>
        <span className="text-[var(--muted)] text-sm font-mono truncate" dir="ltr">
          קוד: {trip.trip_code}
        </span>
      </div>

      <h1 className="text-lg sm:text-xl font-semibold mb-1 sm:mb-2 break-words text-[var(--foreground)] animate-fade-in opacity-0 animate-delay-1 [animation-fill-mode:forwards]">
        סיכום וסגירת טיול: {trip.name}
      </h1>

      {!adminCodeUnlocked ? (
        <div className="mt-6 glass-card p-4 sm:p-5 w-full max-w-md mx-auto animate-fade-in opacity-0 animate-delay-2 [animation-fill-mode:forwards]">
          <h2 className="font-semibold mb-2 text-sm sm:text-base text-[var(--foreground)]">הגנת קוד מנהל</h2>
          <p className="text-[var(--muted)] text-sm mb-3">
            הזן קוד צפייה כדי לראות את סיכום החובות הסופי.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              verifyAdminCode(adminCodeInput);
            }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="קוד צפייה (4 ספרות)"
              value={adminCodeInput}
              onChange={(e) => setAdminCodeInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="flex-1 input-dark px-4 py-3 min-h-[44px] tap-target"
              dir="ltr"
              maxLength={4}
            />
            <button
              type="submit"
              disabled={verifyingCode}
              className="btn-neon px-4 py-3 min-h-[44px] tap-target disabled:opacity-50 shrink-0"
            >
              {verifyingCode ? "בודק..." : "הצג סיכום"}
            </button>
          </form>
          {viewCodeError && <p className="text-red-400 text-sm mt-2">{viewCodeError}</p>}
        </div>
      ) : (
        <>
          {summary && (
            <>
              <div className="mt-6 glass-card p-4 grid grid-cols-3 gap-2 sm:gap-4 text-center mb-4 animate-fade-in opacity-0 animate-delay-2 [animation-fill-mode:forwards]">
                <div>
                  <p className="text-lg sm:text-2xl font-semibold text-[var(--foreground)]">{summary.total.toFixed(2)} ₪</p>
                  <p className="text-xs sm:text-sm text-[var(--muted)]">סך ההוצאות</p>
                </div>
                <div>
                  <p className="text-lg sm:text-2xl font-semibold text-[var(--foreground)]">{summary.participantCount}</p>
                  <p className="text-xs sm:text-sm text-[var(--muted)]">משתתפים</p>
                </div>
                <div>
                  <p className="text-lg sm:text-2xl font-semibold text-[var(--foreground)]">{summary.averagePerPerson.toFixed(2)} ₪</p>
                  <p className="text-xs sm:text-sm text-[var(--muted)]">ממוצע למשתתף</p>
                </div>
              </div>

              <div className="glass-card p-4 mb-4 animate-fade-in opacity-0 animate-delay-2 [animation-fill-mode:forwards]">
                <h2 className="font-semibold mb-3 text-sm sm:text-base text-[var(--foreground)]">פירוט לפי משתתף</h2>
                <ul className="space-y-2">
                  {summary.balances.map((b) => (
                    <li key={b.participantId} className="flex justify-between items-center py-2 border-b border-white/10 last:border-0 gap-2">
                      <span className="text-sm sm:text-base text-[var(--foreground)]">
                        {b.nickname || b.name}
                      </span>
                      <div className="text-left shrink-0">
                        <span className="font-semibold text-base text-[var(--neon)]">
                          ₪{b.expected.toFixed(2)}
                        </span>
                        <span className="text-xs text-[var(--muted)] mr-2">
                          (שילם: ₪{b.paid.toFixed(2)})
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="glass-card p-4 mb-4 animate-fade-in opacity-0 animate-delay-2 [animation-fill-mode:forwards]">
                <h2 className="font-semibold mb-3 text-sm sm:text-base text-[var(--foreground)]">
                  מי חייב למי – העברות כספיות נדרשות
                </h2>
                {summary.settlements.length === 0 ? (
                  <p className="text-[var(--muted)] text-sm">✅ הכל מאוזן - אין חובות לסגירה.</p>
                ) : (
                  <ul className="space-y-3">
                    {summary.settlements.map((s, i) => (
                      <li
                        key={i}
                        className="flex justify-between items-center py-3 border-b border-white/10 last:border-0 gap-2 min-h-[44px]"
                      >
                        <span className="text-sm sm:text-base break-words text-[var(--foreground)]">
                          <strong>{s.fromName}</strong> חייב ל־<strong>{s.toName}</strong>
                        </span>
                        <span className="font-semibold text-base sm:text-lg shrink-0 text-[var(--foreground)]">
                          {s.amount.toFixed(2)} ₪
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mb-4 animate-fade-in opacity-0 animate-delay-2 [animation-fill-mode:forwards]">
                <button
                  type="button"
                  onClick={shareToWhatsApp}
                  className="btn-neon px-4 py-3 rounded-xl min-h-[44px] tap-target flex items-center gap-2"
                >
                  <span aria-hidden>📱</span>
                  שיתוף לוואטסאפ
                </button>
                <button
                  type="button"
                  onClick={downloadExcel}
                  className="btn-ghost px-4 py-3 rounded-xl min-h-[44px] tap-target text-[var(--foreground)] border border-white/10 flex items-center gap-2"
                >
                  <span aria-hidden>📊</span>
                  הורד Excel (CSV)
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
