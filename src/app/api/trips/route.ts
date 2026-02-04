import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase";

function randomCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function GET() {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("trips")
      .select("id, trip_code, name, start_date, end_date, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data ?? []);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "שגיאה בטעינת טיולים" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, startDate, endDate } = body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "שם טיול חובה" }, { status: 400 });
    }

    let code: string;
    let exists = true;
    do {
      code = randomCode();
      const t = await prisma.trip.findUnique({ where: { code } });
      exists = !!t;
    } while (exists);

    const trip = await prisma.trip.create({
      data: {
        name: name.trim(),
        code,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    });

    return NextResponse.json(trip);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "שגיאה ביצירת טיול" }, { status: 500 });
  }
}
