import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const trip = await prisma.trip.findUnique({
      where: { code },
      include: {
        participants: true,
        payments: { include: { paidBy: true }, orderBy: { paidAt: "desc" } },
      },
    });
    if (!trip) {
      return NextResponse.json({ error: "טיול לא נמצא" }, { status: 404 });
    }
    return NextResponse.json(trip);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}

/** עדכון שם טיול (Supabase) */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const body = await request.json();
    const { name } = body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "שם טיול חובה" }, { status: 400 });
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("trips")
      .update({ name: name.trim() })
      .eq("trip_code", code)
      .select("id, trip_code, name")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "טיול לא נמצא" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "שגיאה בעדכון" }, { status: 500 });
  }
}
