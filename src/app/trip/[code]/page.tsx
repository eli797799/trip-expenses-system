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

function computeSummary(participants: ParticipantRow[], payments: PaymentWithPayer[]): Summary {
  const total = payments.reduce((s, p) => s + Number(p.amount), 0);
  const paidByParticipant = participants.map((p) => ({
    participantId: p.id,
    name: p.name,
    nickname: p.nickname,
    sum: payments.filter((pay) => pay.paid_by_id === p.id).reduce((s, pay) => s + Number(pay.amount), 0),
  }));
  const balances = computeBalances(total, participants.length, paidByParticipant);
  const settlements = computeSettlements(balances).map((s) => ({
    fromName: s.fromName,
    toName: s.toName,
    amount: s.amount,
  }));
  return {
    total: Math.round(total * 100) / 100,
    participantCount: participants.length,
    averagePerPerson:
      participants.length > 0 ? Math.round((total / participants.length) * 100) / 100 : 0,
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
        .select("*")
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
        computeSummary(participantsList, paymentsWithPayer)
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
    refresh();
  }, [code]);

  if (loading && !trip) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <p className="text-gray-500">טוען...</p>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen p-4 max-w-lg mx-auto">
        <p className="text-red-600 mb-4">{error || "טיול לא נמצא"}</p>
        <Link href="/" className="text-slate-700 underline min-h-[44px] inline-flex items-center tap-target">
          חזרה לדף הבית
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 pb-8 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
        <Link href="/" className="text-slate-600 text-sm underline py-2 tap-target shrink-0">
          ← דף הבית
        </Link>
        <span className="text-slate-500 text-sm font-mono truncate" dir="ltr">
          קוד: {trip.trip_code}
        </span>
      </div>

      <h1 className="text-lg sm:text-xl font-bold mb-1 sm:mb-2 break-words">{trip.name}</h1>
      {(trip.start_date || trip.end_date) && (
        <p className="text-gray-500 text-sm mb-4">
          {trip.start_date && new Date(trip.start_date).toLocaleDateString("he-IL")}
          {trip.start_date && trip.end_date && " – "}
          {trip.end_date && new Date(trip.end_date).toLocaleDateString("he-IL")}
        </p>
      )}

      <TripHomeSummary summary={summary} />
      <WhoPaysWhom settlements={summary?.settlements ?? []} />

      <AddParticipantSection tripId={trip.id} participants={trip.participants} onAdded={refresh} />

      <div className="mt-6">
        <button
          type="button"
          onClick={() => setShowAddExpense(true)}
          className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-medium min-h-[48px] tap-target"
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
    <div className="bg-white rounded-xl shadow p-4 grid grid-cols-3 gap-2 sm:gap-4 text-center mb-4">
      <div>
        <p className="text-lg sm:text-2xl font-bold">{summary.total.toFixed(2)} ₪</p>
        <p className="text-xs sm:text-sm text-gray-500">סך ההוצאות</p>
      </div>
      <div>
        <p className="text-lg sm:text-2xl font-bold">{summary.participantCount}</p>
        <p className="text-xs sm:text-sm text-gray-500">משתתפים</p>
      </div>
      <div>
        <p className="text-lg sm:text-2xl font-bold">{summary.averagePerPerson.toFixed(2)} ₪</p>
        <p className="text-xs sm:text-sm text-gray-500">למשתתף</p>
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
  const [saving, setSaving] = useState(false);
  const supabase = getSupabaseClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !supabase) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("participants").insert({
        trip_id: tripId,
        name: name.trim(),
        nickname: nickname.trim() || null,
        is_admin: false,
      });
      if (error) {
        alert(error.message);
        return;
      }
      setName("");
      setNickname("");
      setShowForm(false);
      onAdded();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 bg-white rounded-xl shadow p-4">
      <h3 className="font-semibold mb-2 text-sm sm:text-base">משתתפים ({participants.length})</h3>
      {participants.length > 0 && (
        <ul className="text-sm text-gray-600 mb-3">
          {participants.map((p) => (
            <li key={p.id}>{p.nickname || p.name}</li>
          ))}
        </ul>
      )}
      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="text-emerald-600 font-medium text-sm"
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
            className="w-full border rounded-lg px-3 py-2 min-h-[44px]"
            required
          />
          <input
            type="text"
            placeholder="כינוי (אופציונלי)"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 min-h-[44px]"
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border rounded-lg">
              ביטול
            </button>
            <button type="submit" disabled={saving} className="flex-1 bg-slate-800 text-white py-2 rounded-lg disabled:opacity-50">
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
      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="font-semibold mb-3 text-sm sm:text-base">מי משלם למי</h2>
        <p className="text-gray-500 text-sm">אין חובות לסגור – הכל מאוזן.</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h2 className="font-semibold mb-3 text-sm sm:text-base">מי משלם למי</h2>
      <ul className="space-y-3">
        {settlements.map((s, i) => (
          <li
            key={i}
            className="flex justify-between items-center py-3 border-b last:border-0 gap-2 min-h-[44px]"
          >
            <span className="text-sm sm:text-base break-words">
              <strong>{s.fromName}</strong> משלם ל־<strong>{s.toName}</strong>
            </span>
            <span className="font-bold text-base sm:text-lg shrink-0">{s.amount.toFixed(2)} ₪</span>
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">הוספת הוצאה</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-2 tap-target"
            aria-label="סגור"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-1">העלאת קבלה (ניתוח AI)</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                setReceiptFile(e.target.files?.[0] ?? null);
                setAiResult(null);
              }}
              className="flex-1 border rounded-xl px-4 py-3 min-h-[48px] file:mr-2 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-700"
            />
            <button
              type="button"
              onClick={analyzeReceipt}
              disabled={!receiptFile || analyzing}
              className="bg-slate-600 text-white px-4 py-3 rounded-xl text-sm min-h-[48px] tap-target disabled:opacity-50 shrink-0"
            >
              {analyzing ? "מנתח..." : "נתח קבלה"}
            </button>
          </div>
          {aiResult && (
            <div className="mt-2 p-3 bg-slate-50 rounded-lg text-sm">
              <p className="font-medium mb-1">תוצאות ניתוח – בדוק וערוך:</p>
              <p>סכום: {aiResult.amount != null ? `${aiResult.amount} ₪` : "—"}</p>
              <p>תאריך: {aiResult.date ?? "—"}</p>
              <p>עסק: {aiResult.businessName ?? "—"}</p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">סכום (₪) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border rounded-xl px-4 py-3 min-h-[48px]"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">מי שילם *</label>
            <select
              value={paidById}
              onChange={(e) => setPaidById(e.target.value)}
              className="w-full border rounded-xl px-4 py-3 min-h-[48px]"
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
            <label className="block text-sm text-gray-600 mb-1">תיאור (אופציונלי)</label>
            <input
              type="text"
              placeholder="דלק, אוכל, לינה..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border rounded-xl px-4 py-3 min-h-[48px]"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">הערה (אופציונלי)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full border rounded-xl px-4 py-3 min-h-[48px]"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">תאריך תשלום</label>
            <input
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="w-full border rounded-xl px-4 py-3 min-h-[48px]"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-gray-300 font-medium"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-medium disabled:opacity-50"
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
    <div className="mt-6 bg-white rounded-xl shadow overflow-hidden">
      <h3 className="p-3 sm:p-4 font-semibold border-b text-sm sm:text-base">רשימת הוצאות</h3>
      <ul className="divide-y">
        {payments.map((p) => (
          <li key={p.id} className="p-4 flex justify-between items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-base sm:text-lg">{Number(p.amount).toFixed(2)} ₪</p>
              <p className="text-gray-600 text-sm sm:text-base">{p.payer.nickname || p.payer.name}</p>
              {p.description && <p className="text-sm text-gray-500 truncate">{p.description}</p>}
              <p className="text-xs text-gray-400">
                {new Date(p.paid_at).toLocaleDateString("he-IL")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => deletePayment(p.id)}
              disabled={deletingId === p.id}
              className="text-red-600 text-sm underline py-2 px-1 min-h-[44px] min-w-[44px] flex items-center justify-center tap-target shrink-0 disabled:opacity-50"
            >
              מחק
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
