import { NextRequest, NextResponse } from "next/server";

export type ReceiptAnalysis = {
  amount: number | null;
  date: string | null;
  businessName: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || !file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "נא להעלות קובץ תמונה (קבלה)" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          amount: null,
          date: null,
          businessName: null,
          message: "ניתוח IA לא מוגדר. הזן סכום, תאריך ותיאור ידנית.",
        },
        { status: 200 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mime = file.type;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this receipt image. Reply in JSON only, with keys: amount (number, total paid in ILS), date (YYYY-MM-DD or null), businessName (string or null). If you cannot read something use null. Example: {"amount": 125.50, "date": "2025-02-01", "businessName": "Super"}`,
              },
              {
                type: "image_url",
                image_url: { url: `data:${mime};base64,${base64}` },
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("OpenAI error", res.status, err);
      return NextResponse.json(
        {
          amount: null,
          date: null,
          businessName: null,
          message: "ניתוח IA נכשל. הזן נתונים ידנית.",
        },
        { status: 200 }
      );
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim() || "";
    let result: ReceiptAnalysis = { amount: null, date: null, businessName: null };

    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      if (typeof parsed.amount === "number") result.amount = parsed.amount;
      if (typeof parsed.date === "string") result.date = parsed.date;
      if (typeof parsed.businessName === "string")
        result.businessName = parsed.businessName || null;
    } catch {
      // keep defaults
    }

    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      {
        amount: null,
        date: null,
        businessName: null,
        message: "שגיאה בניתוח קבלה.",
      },
      { status: 200 }
    );
  }
}
