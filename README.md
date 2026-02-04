# ניהול הוצאות טיול קבוצתי

מערכת לניהול הוצאות משותפות בטיול של קבוצת חברים: הזנת משתתפים, רישום תשלומים, ניתוח קבלות באמצעות IA, וחישוב אוטומטי של מי חייב למי.

## התקנה והרצה מקומית

```bash
cd trip-app
npm install
```

צור קובץ `.env` (או העתק מ-`.env.example`):

```
DATABASE_URL="file:./dev.db"
```

יצירת בסיס הנתונים והרצה:

```bash
npx prisma migrate dev --name init
npm run dev
```

פתח בדפדפן: [http://localhost:3000](http://localhost:3000).

## העלאה לענן (Vercel + PostgreSQL)

ב־Vercel לא ניתן להשתמש ב־SQLite. יש להשתמש ב־PostgreSQL (למשל [Neon](https://neon.tech) או [Supabase](https://supabase.com)).

### שלב 1: בסיס נתונים בענן

1. צור פרויקט ב־Neon או Supabase.
2. העתק את מחרוזת החיבור ל־PostgreSQL (connection string).

### שלב 2: התאמת Prisma ל־PostgreSQL

בקובץ `prisma/schema.prisma` שנה את ה־datasource:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

הרץ:

```bash
npx prisma migrate deploy
```

### שלב 3: פריסה ב־Vercel

1. דחוף את הקוד ל־GitHub.
2. ב־[Vercel](https://vercel.com) ייבא את הפרויקט מהמאגר.
3. ב־Project Settings → Environment Variables הוסף:
   - `DATABASE_URL` – מחרוזת החיבור ל־PostgreSQL מהשלב 1.

4. Deploy.

### ניתוח קבלות (IA)

לניתוח אוטומטי של תמונות קבלות הוסף ב־Vercel (או ב־`.env` מקומי):

- `OPENAI_API_KEY` – מפתח API מ־[OpenAI](https://platform.openai.com).

בלי המפתח – ניתן להזין סכום ותיאור ידנית בלבד.

## שימוש

- **דף הבית**: צור טיול חדש (שם, תאריכים) או הזן קוד טיול קיים כדי להיכנס.
- **לאחר כניסה**: לשוניות סיכום / תשלומים / משתתפים.
- **משתתפים**: הוסף משתתפים (שם, כינוי, מנהל).
- **תשלומים**: הוסף תשלום (סכום, מי שילם, תיאור). אפשר להעלות תמונת קבלה לניתוח IA.
- **סיכום**: סך הוצאות, חלוקה שווה, ומי משלם למי (ירוק = זכאי לקבל, אדום = חייב לשלם).

## מבנה טכני

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS, RTL לעברית.
- **Backend**: Next.js API Routes.
- **DB**: Prisma – SQLite (מקומי) או PostgreSQL (ענן).
- **IA**: OpenAI Vision (אופציונלי) לניתוח קבלות.
