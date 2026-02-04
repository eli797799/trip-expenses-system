import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import webpush from "web-push";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    if (!vapidPrivate) {
      return NextResponse.json({ error: "VAPID_PRIVATE_KEY לא מוגדר" }, { status: 500 });
    }

    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublic) {
      return NextResponse.json({ error: "NEXT_PUBLIC_VAPID_PUBLIC_KEY לא מוגדר" }, { status: 500 });
    }

    webpush.setVapidDetails("mailto:admin@trip-app.local", vapidPublic, vapidPrivate);

    const body = await request.json();
    const { tripCode, viewCode, title, body: messageBody } = body as {
      tripCode?: string;
      viewCode?: string;
      title?: string;
      body?: string;
    };

    if (!tripCode) {
      return NextResponse.json({ error: "חסר קוד טיול" }, { status: 400 });
    }

    const supabase = createClient();
    const { data: trip, error: tripErr } = await supabase
      .from("trips")
      .select("id, view_code")
      .eq("trip_code", tripCode)
      .single();

    if (tripErr || !trip) {
      return NextResponse.json({ error: "טיול לא נמצא" }, { status: 404 });
    }

    const storedViewCode = (trip as { view_code: string | null }).view_code;
    if (storedViewCode && storedViewCode !== "" && viewCode !== storedViewCode) {
      return NextResponse.json({ error: "קוד צפייה לא תקין" }, { status: 403 });
    }

    const { data: subs, error: subsErr } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("trip_id", (trip as { id: string }).id);

    if (subsErr || !subs || subs.length === 0) {
      return NextResponse.json({ sent: 0, message: "אין מנויים להתראות" }, { status: 200 });
    }

    const payload = JSON.stringify({
      title: title || "הוצאות טיול",
      body: messageBody || "",
      tag: "trip-" + tripCode,
      data: { url: `/trip/${tripCode}` },
    });

    let sent = 0;
    const failedEndpoints: string[] = [];

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
        sent++;
      } catch {
        failedEndpoints.push(sub.endpoint);
      }
    }

    if (failedEndpoints.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", failedEndpoints);
    }

    return NextResponse.json({ sent, total: subs.length });
  } catch (e) {
    console.error("push send error", e);
    return NextResponse.json({ error: "שגיאה בשליחת התראות" }, { status: 500 });
  }
}
