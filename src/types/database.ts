/**
 * התאמה לסכמת Supabase שלך.
 * טבלאות: trips (trip_code UNIQUE), participants (קישור ל-Auth), payments (amount numeric 10,2).
 * אם שמות עמודות שונים (למשל paid_by במקום paid_by_id), עדכן כאן ובשאילתות.
 */
export type TripRow = {
  id: string;
  trip_code: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

export type ParticipantRow = {
  id: string;
  trip_id: string;
  user_id: string | null;
  name: string;
  nickname: string | null;
  is_admin: boolean;
  created_at: string;
};

export type PaymentRow = {
  id: string;
  trip_id: string;
  amount: number;
  /** אם ב-DB העמודה נקראת paid_by (UUID של participant), שנה גם ב-query ל-paid_by */
  paid_by_id: string;
  description: string | null;
  note: string | null;
  paid_at: string;
};
