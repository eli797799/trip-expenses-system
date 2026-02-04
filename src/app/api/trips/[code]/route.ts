import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
