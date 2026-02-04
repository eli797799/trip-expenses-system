-- הוסף עמודת ימים בטיול למשתתפים – Supabase
-- הרץ ב-Supabase: SQL Editor → New query → הדבק והרץ

ALTER TABLE participants
ADD COLUMN IF NOT EXISTS days_in_trip integer;
