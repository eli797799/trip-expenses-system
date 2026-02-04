"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { computeBalances, computeSettlements } from "@/lib/balance";
import { InstallAppButton } from "@/components/InstallAppButton";
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
  return {
    total: Math.round(total * 100) / 100,
    participantCount: participants.length,
    averagePerPerson:
      totalDays > 0 ? Math.round((total / totalDays) * 100) / 100 : 0,
    balances: balances.map((b) => ({
      ...b,
      paid: Math.round(b.paid * 100) / 100,
      expected: Math.round(b.expected * 100) / 100,
      diff: Math.round(b.diff * 100) / 100,
    })),
    settlements,
  };
}

export default function TripPage() {
  const params = useParams();
  const code = params?.code as string;
  const [trip, setTrip] = useState<TripData | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [paymentUnlocked, setPaymentUnlocked] = useState(false);
  const [viewCodeInput, setViewCodeInput] = useState("");
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [viewCodeError, setViewCodeError] = useState("");

  const VIEW_STORAGE_KEY = "trip_view_";

  function checkPaymentUnlocked() {
    if (typeof window === "undefined" || !code) return false;
    return localStorage.getItem(VIEW_STORAGE_KEY + code) === "1";
  }

  async function verifyViewCode(entered: string) {
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
        localStorage.setItem(VIEW_STORAGE_KEY + code, "1");
        setPaymentUnlocked(true);
        setViewCodeInput("");
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

  useEffect(() => {
    setPaymentUnlocked(checkPaymentUnlocked());
  }, [code]);

  useEffect(() => {
    if (!code || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const viewCodeFromUrl = params.get("view_code");
    if (viewCodeFromUrl) {
      fetch(`/api/trips/${code}/verify-view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: viewCodeFromUrl }),
      })
        .then((r) => r.json())
        .then((data: { ok?: boolean }) => {
          if (data.ok) {
            localStorage.setItem(VIEW_STORAGE_KEY + code, "1");
            setPaymentUnlocked(true);
          }
        });
      window.history.replaceState({}, "", window.location.pathname);
    }
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
        <Link href="/" className="text-[var(--muted)] hover:text-[var(--foreground)] text-sm underline py-2 tap-target shrink-0 transition-colors">
          ← דף הבית
        </Link>
        <div className="flex items-center gap-2">
          <InstallAppButton />
          <span className="text-[var(--muted)] text-sm font-mono truncate" dir="ltr">
            קוד: {trip.trip_code}
          </span>
        </div>
      </div>

      <h1 className="text-lg sm:text-xl font-semibold mb-1 sm:mb-2 break-words text-[var(--foreground)] animate-fade-in opacity-0 animate-delay-1 [animation-fill-mode:forwards]">{trip.name}</h1>
      {(trip.start_date || trip.end_date) && (
        <p className="text-[var(--muted)] text-sm mb-4">
          {trip.start_date && new Date(trip.start_date).toLocaleDateString("he-IL")}
          {trip.start_date && trip.end_date && " – "}
          {trip.end_date && new Date(trip.end_date).toLocaleDateString("he-IL")}
        </p>
      )}

      {paymentUnlocked ? (
        <>
          <TripHomeSummary summary={summary} />
          <WhoPaysWhom settlements={summary?.settlements ?? []} />
        </>
      ) : (
        <div className="glass-card p-4 sm:p-5 mb-4 animate-fade-in opacity-0 animate-delay-2 [animation-fill-mode:forwards]">
          <h2 className="font-semibold mb-2 text-sm sm:text-base text-[var(--foreground)]">צפייה בסכומים</h2>
          <p className="text-[var(--muted)] text-sm mb-3">
            רק למי שיש את קוד הצפייה – הזן קוד (או השאר ריק בטיולים ישנים) כדי לראות סך הוצאות ומי משלם למי.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              verifyViewCode(viewCodeInput);
            }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="קוד צפייה (4 ספרות)"
              value={viewCodeInput}
              onChange={(e) => setViewCodeInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="flex-1 input-dark px-4 py-3 min-h-[44px] tap-target"
              dir="ltr"
              maxLength={4}
            />
            <button
              type="submit"
              disabled={verifyingCode}
              className="btn-neon px-4 py-3 min-h-[44px] tap-target disabled:opacity-50 shrink-0"
            >
              {verifyingCode ? "בודק..." : "הצג סכומים"}
            </button>
          </form>
          {viewCodeError && <p className="text-red-400 text-sm mt-2">{viewCodeError}</p>}
        </div>
      )}

      <AddParticipantSection tripId={trip.id} participants={trip.participants} onAdded={refresh} />

      <div className="mt-6">
        <button
          type="button"
          onClick={() => setShowAddExpense(true)}
          className="w-full btn-neon-green py-3.5 min-h-[48px] tap-target"
        >
          + הוסף הוצאה
        </button>
      </div>

      {showAddExpense && (
        <AddExpenseScreen
          tripId={trip.id}
          participants={trip.participants}
          onClose={() => setShowAddExpense(false)}
          onSaved={() => {
            setShowAddExpense(false);
            refresh();
          }}
        />
      )}

      <ExpensesList payments={trip.payments} onDelete={refresh} />
    </div>
  );
}

function TripHomeSummary({ summary }: { summary: Summary | null }) {
  if (!summary) return null;
  return (
    <div className="glass-card p-4 grid grid-cols-3 gap-2 sm:gap-4 text-center mb-4 animate-fade-in opacity-0 animate-delay-2 [animation-fill-mode:forwards]">
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
        <p className="text-xs sm:text-sm text-[var(--muted)]">למשתתף</p>
      </div>
    </div>
  );
}

function AddParticipantSection({
  tripId,
  participants,
  onAdded,
}: {
  tripId: string;
  participants: ParticipantRow[];
  onAdded: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [daysInTrip, setDaysInTrip] = useState("");
  const [saving, setSaving] = useState(false);
  const supabase = getSupabaseClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !supabase) return;
    setSaving(true);
    try {
      const days = daysInTrip.trim() ? parseInt(daysInTrip.trim(), 10) : null;
      const { error } = await supabase.from("participants").insert({
        trip_id: tripId,
        name: name.trim(),
        nickname: nickname.trim() || null,
        is_admin: false,
        days_in_trip: days != null && !Number.isNaN(days) && days >= 1 ? days : null,
      });
      if (error) {
        alert(error.message);
        return;
      }
      setName("");
      setNickname("");
      setDaysInTrip("");
      setShowForm(false);
      onAdded();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 glass-card p-4 animate-fade-in opacity-0 animate-delay-3 [animation-fill-mode:forwards]">
      <h3 className="font-semibold mb-2 text-sm sm:text-base text-[var(--foreground)]">משתתפים ({participants.length})</h3>
      {participants.length > 0 && (
        <ul className="text-sm text-[var(--muted)] mb-3 space-y-1">
          {participants.map((p) => (
            <li key={p.id}>
              {p.nickname || p.name}
              {p.days_in_trip != null && p.days_in_trip >= 1 ? (
                <span className="text-[var(--foreground)]"> ({p.days_in_trip} {p.days_in_trip === 1 ? "יום" : "ימים"})</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="text-[var(--neon-cyan)] hover:text-[var(--neon-blue)] font-medium text-sm transition-colors"
        >
          + הוסף משתתף
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3 mt-2">
          <input
            type="text"
            placeholder="שם *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full input-dark px-3 py-2 min-h-[44px] tap-target"
            required
          />
          <input
            type="text"
            placeholder="כינוי (אופציונלי)"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full input-dark px-3 py-2 min-h-[44px] tap-target"
          />
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1">ימים בטיול (ריק = כל הימים – למשל 1 ליום אחד)</label>
            <input
              type="number"
              min={1}
              placeholder="כל הימים"
              value={daysInTrip}
              onChange={(e) => setDaysInTrip(e.target.value.replace(/\D/g, ""))}
              className="w-full input-dark px-3 py-2 min-h-[44px] tap-target"
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 btn-ghost py-2 tap-target">
              ביטול
            </button>
            <button type="submit" disabled={saving} className="flex-1 btn-neon py-2 tap-target disabled:opacity-50">
              {saving ? "שומר..." : "הוסף"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function WhoPaysWhom({ settlements }: { settlements: { fromName: string; toName: string; amount: number }[] }) {
  if (settlements.length === 0) {
    return (
      <div className="glass-card p-4 mb-4 animate-fade-in opacity-0 animate-delay-2 [animation-fill-mode:forwards]">
        <h2 className="font-semibold mb-3 text-sm sm:text-base text-[var(--foreground)]">מי משלם למי</h2>
        <p className="text-[var(--muted)] text-sm">אין חובות לסגור – הכל מאוזן.</p>
      </div>
    );
  }
  return (
    <div className="glass-card p-4 mb-4 animate-fade-in opacity-0 animate-delay-2 [animation-fill-mode:forwards]">
      <h2 className="font-semibold mb-3 text-sm sm:text-base text-[var(--foreground)]">מי משלם למי</h2>
      <ul className="space-y-3">
        {settlements.map((s, i) => (
          <li
            key={i}
            className="flex justify-between items-center py-3 border-b border-white/10 last:border-0 gap-2 min-h-[44px]"
          >
            <span className="text-sm sm:text-base break-words text-[var(--foreground)]">
              <strong>{s.fromName}</strong> משלם ל־<strong>{s.toName}</strong>
            </span>
            <span className="font-semibold text-base sm:text-lg shrink-0 text-[var(--foreground)]">{s.amount.toFixed(2)} ₪</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type AddExpenseScreenProps = {
  tripId: string;
  participants: ParticipantRow[];
  onClose: () => void;
  onSaved: () => void;
};

function AddExpenseScreen({ tripId, participants, onClose, onSaved }: AddExpenseScreenProps) {
  const [amount, setAmount] = useState("");
  const [paidById, setPaidById] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const receiptInputRef = useRef<HTMLInputElement | null>(null);
  const receiptCameraRef = useRef<HTMLInputElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiResult, setAiResult] = useState<{ amount: number | null; date: string | null; businessName: string | null } | null>(null);

  async function analyzeReceipt() {
    if (!receiptFile) return;
    setAnalyzing(true);
    setAiResult(null);
    try {
      const form = new FormData();
      form.append("file", receiptFile);
      const res = await fetch("/api/receipt-analyze", { method: "POST", body: form });
      const data = await res.json();
      setAiResult({
        amount: data.amount ?? null,
        date: data.date ?? null,
        businessName: data.businessName ?? null,
      });
      if (data.amount != null) setAmount(String(data.amount));
      if (data.date) setPaidAt(data.date);
      if (data.businessName) setDescription((d) => d || data.businessName);
    } catch {
      setAiResult({ amount: null, date: null, businessName: null });
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!paidById || !amount || parseFloat(amount) <= 0) return;
    const supabase = getSupabaseClient();
    if (!supabase) {
      alert("Supabase לא מוגדר");
      return;
    }
    setSaving(true);
    try {
      const { error: insertError } = await supabase.from("payments").insert({
        trip_id: tripId,
        amount: parseFloat(amount),
        paid_by_id: paidById,
        description: description.trim() || null,
        note: note.trim() || null,
        paid_at: paidAt ? new Date(paidAt).toISOString() : new Date().toISOString(),
      });
      if (insertError) {
        alert(insertError.message || "שגיאה בשמירה");
        return;
      }
      onSaved();
    } catch (e) {
      alert(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-card-strong max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 animate-fade-in-up opacity-0 [animation-fill-mode:forwards]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">הוספת הוצאה</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--foreground)] p-2 tap-target transition-colors"
            aria-label="סגור"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-sm text-[var(--muted)] mb-1">העלאת קבלה (ניתוח AI)</label>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <input
                type="file"
                accept="image/*"
                ref={receiptInputRef}
                onChange={(e) => {
                  setReceiptFile(e.target.files?.[0] ?? null);
                  setAiResult(null);
                }}
                className="hidden"
                aria-hidden
              />
              <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={receiptCameraRef}
                onChange={(e) => {
                  setReceiptFile(e.target.files?.[0] ?? null);
                  setAiResult(null);
                }}
                className="hidden"
                aria-hidden
              />
              <button
                type="button"
                onClick={() => receiptInputRef.current?.click()}
                className="btn-ghost px-4 py-3 rounded-xl text-sm min-h-[48px] tap-target"
              >
                בחר קובץ
              </button>
              <button
                type="button"
                onClick={() => receiptCameraRef.current?.click()}
                className="btn-ghost px-4 py-3 rounded-xl text-sm min-h-[48px] tap-target"
              >
                צלם קבלה
              </button>
              <button
                type="button"
                onClick={analyzeReceipt}
                disabled={!receiptFile || analyzing}
                className="btn-neon px-4 py-3 rounded-xl text-sm min-h-[48px] tap-target disabled:opacity-50 shrink-0"
              >
                {analyzing ? "מנתח..." : "נתח קבלה"}
              </button>
            </div>
            {receiptFile && (
              <p className="text-sm text-[var(--muted)]">
                נבחר: {receiptFile.name}
              </p>
            )}
          </div>
          {aiResult && (
            <div className="mt-2 p-3 glass-card rounded-lg text-sm">
              <p className="font-medium mb-1 text-[var(--foreground)]">תוצאות ניתוח – בדוק וערוך:</p>
              <p className="text-[var(--muted)]">סכום: {aiResult.amount != null ? `${aiResult.amount} ₪` : "—"}</p>
              <p className="text-[var(--muted)]">תאריך: {aiResult.date ?? "—"}</p>
              <p className="text-[var(--muted)]">עסק: {aiResult.businessName ?? "—"}</p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">סכום (₪) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full input-dark px-4 py-3 min-h-[48px] tap-target"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">מי שילם *</label>
            <select
              value={paidById}
              onChange={(e) => setPaidById(e.target.value)}
              className="w-full input-dark px-4 py-3 min-h-[48px] tap-target"
              required
            >
              <option value="">בחר משתתף</option>
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nickname || p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">תיאור (אופציונלי)</label>
            <input
              type="text"
              placeholder="דלק, אוכל, לינה..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full input-dark px-4 py-3 min-h-[48px] tap-target"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">הערה (אופציונלי)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full input-dark px-4 py-3 min-h-[48px] tap-target"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">תאריך תשלום</label>
            <input
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="w-full input-dark px-4 py-3 min-h-[48px] tap-target"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-ghost py-3 tap-target"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 btn-neon-green py-3 tap-target disabled:opacity-50"
            >
              {saving ? "שומר..." : "שמור הוצאה"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ExpensesList({
  payments,
  onDelete,
}: {
  payments: PaymentWithPayer[];
  onDelete: () => void;
}) {
  const supabase = getSupabaseClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function deletePayment(id: string) {
    if (!confirm("למחוק תשלום זה?")) return;
    if (!supabase) return;
    setDeletingId(id);
    await supabase.from("payments").delete().eq("id", id);
    setDeletingId(null);
    onDelete();
  }

  if (payments.length === 0) return null;
  return (
    <div className="mt-6 glass-card overflow-hidden animate-fade-in opacity-0 animate-delay-4 [animation-fill-mode:forwards]">
      <h3 className="p-3 sm:p-4 font-semibold border-b border-white/10 text-sm sm:text-base text-[var(--foreground)]">רשימת הוצאות</h3>
      <ul className="divide-y divide-white/10">
        {payments.map((p) => (
          <li key={p.id} className="p-4 flex justify-between items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-base sm:text-lg text-[var(--foreground)]">{Number(p.amount).toFixed(2)} ₪</p>
              <p className="text-[var(--muted)] text-sm sm:text-base">{p.payer.nickname || p.payer.name}</p>
              {p.description && <p className="text-sm text-[var(--muted)] truncate">{p.description}</p>}
              <p className="text-xs text-[var(--muted)]">
                {new Date(p.paid_at).toLocaleDateString("he-IL")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => deletePayment(p.id)}
              disabled={deletingId === p.id}
              className="text-red-400 hover:text-red-300 text-sm underline py-2 px-1 min-h-[44px] min-w-[44px] flex items-center justify-center tap-target shrink-0 disabled:opacity-50 transition-colors"
            >
              מחק
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
