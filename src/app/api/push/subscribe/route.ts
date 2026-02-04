import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tripId, subscription } = body as {
      tripId?: string;
      subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    };

    if (!tripId || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: "חסרים פרטי מנוי" }, { status: 400 });
    }

    const supabase = createClient();
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        trip_id: tripId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      { onConflict: "trip_id,endpoint" }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("push subscribe error", e);
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}
