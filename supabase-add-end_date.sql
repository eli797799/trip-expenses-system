-- הוסף את העמודה end_date לטבלת trips ב-Supabase
-- הרץ את הסקריפט הזה ב-Supabase: SQL Editor → New query → הדבק והרץ

ALTER TABLE trips
ADD COLUMN IF NOT EXISTS end_date date;

-- אם PostgreSQL גרסה ישנה (ללא IF NOT EXISTS), השתמש ב:
-- ALTER TABLE trips ADD COLUMN end_date date;
