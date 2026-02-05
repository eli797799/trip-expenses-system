"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import type { TripMessageRow } from "@/types/database";

function getSupabaseClient() {
  try {
    return createClient();
  } catch {
    return null;
  }
}

export default function TripChatPage() {
  const params = useParams();
  const code = params?.code as string;
  const [tripName, setTripName] = useState<string>("");
  const [tripId, setTripId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TripMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [senderName, setSenderName] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!code) return;
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError("Supabase לא מוגדר");
      setLoading(false);
      return;
    }

    let mounted = true;
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
    const db = supabase;

    async function load() {
      if (!db) return;
      const { data: tripRow, error: tripErr } = await db
        .from("trips")
        .select("id, name")
        .eq("trip_code", code)
        .single();

      if (tripErr || !tripRow) {
        if (mounted) {
          setError("טיול לא נמצא");
          setTripId(null);
        }
        setLoading(false);
        return;
      }

      const tid = (tripRow as { id: string }).id;
      const tname = (tripRow as { name: string }).name;

      if (mounted) {
        setTripId(tid);
        setTripName(tname);
      }

      const { data: msgs = [], error: msgErr } = await db
        .from("trip_messages")
        .select("*")
        .eq("trip_id", tid)
        .order("created_at", { ascending: true });

      if (msgErr) {
        if (mounted) setError(msgErr.message);
      } else if (mounted) {
        setMessages((msgs as TripMessageRow[]) || []);
      }

      setLoading(false);

      channel = db
        .channel(`trip_messages:${tid}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "trip_messages",
            filter: `trip_id=eq.${tid}`,
          },
          (payload) => {
            const newMsg = payload.new as TripMessageRow;
            if (mounted) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });
            }
          }
        )
        .subscribe();
    }

    load();

    return () => {
      mounted = false;
      if (channel && db) db.removeChannel(channel);
    };
  }, [code]);

  useEffect(() => {
    if (typeof window !== "undefined" && code) {
      const saved = localStorage.getItem(`chat_sender_${code}`);
      if (saved) setSenderName(saved);
      // Mark chat as visited
      localStorage.setItem(`chat_last_visit_${code}`, new Date().toISOString());
    }
  }, [code]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!tripId || !content.trim()) return;
    const name = senderName.trim() || "אלמוני";
    const supabase = getSupabaseClient();
    if (!supabase) return;

    setSending(true);
    try {
      const { data: inserted, error: insertErr } = await supabase
        .from("trip_messages")
        .insert({
          trip_id: tripId,
          sender_name: name,
          content: content.trim(),
        })
        .select()
        .single();

      if (insertErr) {
        alert(insertErr.message || "שגיאה בשמירה");
        return;
      }

      if (typeof window !== "undefined" && code) {
        localStorage.setItem(`chat_sender_${code}`, name);
      }

      setContent("");

      const pushBody = `${name}: ${content.trim()}`;
      const viewCode = typeof window !== "undefined" ? localStorage.getItem("trip_view_code_" + code) : null;
      try {
        await fetch("/api/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tripCode: code,
            viewCode: viewCode || "",
            title: tripName,
            body: pushBody,
          }),
        });
      } catch {
        // התראות אופציונליות
      }

      if (inserted) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === (inserted as TripMessageRow).id)) return prev;
          return [...prev, inserted as TripMessageRow];
        });
      }
    } finally {
      setSending(false);
    }
  }

  if (loading && !tripId) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--muted)] animate-fade-in">טוען...</p>
      </div>
    );
  }

  if (error || !tripId) {
    return (
      <div className="min-h-screen p-4 max-w-lg mx-auto bg-[var(--background)]">
        <p className="text-red-400 mb-4">{error || "טיול לא נמצא"}</p>
        <Link
          href={code ? `/trip/${code}` : "/"}
          className="text-[var(--neon-blue)] hover:text-[var(--neon-purple)] underline min-h-[44px] inline-flex tap-target transition-colors"
        >
          חזרה לדף הטיול
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      <header className="sticky top-0 z-10 p-4 border-b border-white/10 bg-[var(--background)]/95 backdrop-blur">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link
            href={`/trip/${code}`}
            className="text-[var(--muted)] hover:text-[var(--foreground)] p-2 -mr-2 tap-target transition-colors"
            aria-label="חזרה לדף הטיול"
          >
            ←
          </Link>
          <h1 className="text-lg font-semibold text-[var(--foreground)] truncate flex-1">
            עדכונים לוגיסטיים - {tripName}
          </h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-2">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <p className="text-center text-[var(--muted)] py-8">אין הודעות עדיין. התחל את השיחה!</p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className="glass-card p-4 animate-fade-in"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-[var(--foreground)]">{m.sender_name}</span>
                  <span className="text-xs text-[var(--muted)]" dir="ltr">
                    {new Date(m.created_at).toLocaleString("he-IL")}
                  </span>
                </div>
                <p className="text-[var(--foreground)] whitespace-pre-wrap break-words">{m.content}</p>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <footer className="sticky bottom-0 p-4 border-t border-white/10 bg-[var(--background)]/95 backdrop-blur">
        <form onSubmit={handleSend} className="max-w-2xl mx-auto flex flex-col gap-2">
          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              placeholder="השם שלך"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              className="input-dark px-4 py-3 min-h-[44px] tap-target w-32 sm:w-40"
            />
            <input
              type="text"
              placeholder="כתוב הודעה..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 min-w-[120px] input-dark px-4 py-3 min-h-[44px] tap-target"
            />
            <button
              type="submit"
              disabled={sending || !content.trim()}
              className="btn-neon px-4 py-3 min-h-[44px] tap-target disabled:opacity-50 shrink-0"
            >
              {sending ? "שולח..." : "שלח"}
            </button>
          </div>
        </form>
      </footer>
    </div>
  );
}
