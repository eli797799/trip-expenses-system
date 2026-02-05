import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `אתה כותב הודעת התראה קצרה ומצחיקה על תשלום חדש בטיול קבוצתי.
המידע שיש לך: שם המשלם, הסכום בשקלים, ומהות ההוצאה.
דוגמה לסגנון: "חברים, תורידו את הכובע! [שם] הרביץ תשלום של [סכום] שקלים על [תיאור]. [שם אחר], אולי תלמד ממנו?"
החזר רק את הטקסט של ההודעה, ללא מרכאות חיצוניות וללא חתימה. ההודעה צריכה להיות בעברית, קצרה (עד 2 משפטים), מצחיקה ומתאימה להתראה.`;

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      const body = await request.json();
      const { payerName, amount, description, otherNames } = body as {
        payerName?: string;
        amount?: number;
        description?: string;
        otherNames?: string[];
      };
      const desc = description?.trim() || "הוצאה";
      const other = otherNames?.[0];
      const fallback = other
        ? `${payerName || "מישהו"} שילם ${amount ?? 0} ₪ על ${desc}. ${other}, אולי תלמד ממנו?`
        : `${payerName || "מישהו"} שילם ${amount ?? 0} ₪ על ${desc}.`;
      return NextResponse.json({ message: fallback }, { status: 200 });
    }

    const body = await request.json();
    const {
      payerName = "מישהו",
      amount = 0,
      description = "הוצאה",
      otherNames = [],
    } = body as {
      payerName?: string;
      amount?: number;
      description?: string;
      otherNames?: string[];
    };

    const otherStr =
      otherNames.length > 0
        ? `שמות משתתפים אחרים בטיול (להזכרה בהומור): ${otherNames.join(", ")}`
        : "";

    const prompt = `
נתוני התשלום:
- שם המשלם: ${payerName}
- סכום: ${amount} שקלים
- מהות ההוצאה: ${description}
${otherStr ? `\n${otherStr}` : ""}

${SYSTEM_PROMPT}
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 120,
          temperature: 0.85,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Gemini funny-message error", res.status, err);
      const fallback =
        otherNames.length > 0
          ? `${payerName} שילם ${amount} ₪ על ${description}. ${otherNames[0]}, אולי תלמד ממנו?`
          : `${payerName} שילם ${amount} ₪ על ${description}.`;
      return NextResponse.json({ message: fallback }, { status: 200 });
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    const message =
      text.replace(/^["']|["']$/g, "").replace(/\n/g, " ").trim() ||
      (otherNames.length > 0
        ? `${payerName} שילם ${amount} ₪ על ${description}. ${otherNames[0]}, אולי תלמד ממנו?`
        : `${payerName} שילם ${amount} ₪ על ${description}.`);

    return NextResponse.json({ message });
  } catch (e) {
    console.error("funny-message error", e);
    return NextResponse.json(
      { message: "הוצאה חדשה נרשמה בטיול." },
      { status: 200 }
    );
  }
}
