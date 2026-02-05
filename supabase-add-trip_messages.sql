-- ============================================================
-- הוספת טבלת trip_messages – צ'אט לוגיסטי לטיולים
-- הרץ ב-Supabase: SQL Editor → New query → הדבק והרץ
-- ============================================================
-- טבלה חדשה בלבד – לא משנה טבלאות או נתונים קיימים
-- ============================================================

CREATE TABLE IF NOT EXISTS trip_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  sender_name text NOT NULL,
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trip_messages_trip_id ON trip_messages(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_messages_created_at ON trip_messages(created_at);

-- ============================================================
-- הפעלת Realtime (אופציונלי)
-- הרץ בנפרד אם אתה רוצה הודעות בזמן אמת בלי רענון:
-- ALTER PUBLICATION supabase_realtime ADD TABLE trip_messages;
-- או הפעל ב-Dashboard: Database → Replication → בחר trip_messages
-- ============================================================

-- ============================================================
-- סיום – הטבלה trip_messages מוכנה
-- ============================================================
