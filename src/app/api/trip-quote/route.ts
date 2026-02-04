import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const FRIENDS_CONTEXT = `הרקע על החברים (לשימוש בהומור בלבד):
- אלי: בנה את התוכנה ומצלם הכל.
- אהרון: מארצות הברית, חייב סדר בכל דבר (הוא זה שאומר "בטיול לא מחשבנים כסף, בטיול נהנים").
- חריר: נהג אמבולנס במד"א.
- יאיר: "המתקן" – מתקן כל דבר.
- פיני: תמיד רוצה ללכת לאילת.
- מאיר: בריטי, מעשן כבד (אם אין פילטר – המצב לא טוב).
- שוע: מעשן.`;

const SYSTEM_PROMPT = `אתה כותב משפט אחד מצחיק ובהומור על טיול קבוצתי, בהתבסס על נתוני ההוצאות ועל הרקע של החברים.
כתוב רק משפט אחד בעברית. אל תשנה שום נתון – זה להומור בלבד. אין לשמור או לעדכן שום דבר בבסיס נתונים.
המשפט צריך להיות קצר, שנון ומצחיק.`;

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { quote: "בטיול לא מחשבנים כסף, בטיול נהנים! – אהרון גרנובסקי" },
        { status: 200 }
      );
    }

    const body = await request.json();
    const { total = 0, participants = [] } = body as {
      total?: number;
      participants?: { name: string; nickname?: string | null; paid: number }[];
    };

    const sorted = [...participants].sort((a, b) => b.paid - a.paid);
    const topPayer = sorted[0];
    const zeroPayers = participants.filter((p) => p.paid < 0.01);
    const participantNames = participants.map((p) => p.nickname || p.name).filter(Boolean);

    const dataContext = `
נתוני הטיול:
- סכום כולל: ${total.toFixed(2)} ₪
- שילם הכי הרבה: ${topPayer ? `${topPayer.nickname || topPayer.name} (${topPayer.paid.toFixed(2)} ₪)` : "אין נתונים"}
- לא שילם כלום: ${zeroPayers.length > 0 ? zeroPayers.map((p) => p.nickname || p.name).join(", ") : "אין"}
- משתתפים: ${participantNames.join(", ") || "לא ידוע"}
`;

    const prompt = `${FRIENDS_CONTEXT}

${dataContext}

${SYSTEM_PROMPT}
החזר רק את המשפט המצחיק, ללא מרכאות חיצוניות וללא חתימה.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 150,
          temperature: 0.9,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Gemini trip-quote error", res.status, err);
      return NextResponse.json(
        { quote: "בטיול לא מחשבנים כסף, בטיול נהנים! – אהרון גרנובסקי" },
        { status: 200 }
      );
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    const quote = text
      .replace(/^["']|["']$/g, "")
      .replace(/\n/g, " ")
      .trim() || "בטיול לא מחשבנים כסף, בטיול נהנים! – אהרון גרנובסקי";

    return NextResponse.json({ quote });
  } catch (e) {
    console.error("trip-quote error", e);
    return NextResponse.json(
      { quote: "בטיול לא מחשבנים כסף, בטיול נהנים! – אהרון גרנובסקי" },
      { status: 200 }
    );
  }
}
