import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ code: string; id: string }> }
) {
  try {
    const { code, id } = await context.params;
    const trip = await prisma.trip.findUnique({ where: { code } });
    if (!trip) {
      return NextResponse.json({ error: "טיול לא נמצא" }, { status: 404 });
    }
    const payment = await prisma.payment.findFirst({
      where: { id, tripId: trip.id },
    });
    if (!payment) {
      return NextResponse.json({ error: "תשלום לא נמצא" }, { status: 404 });
    }
    await prisma.payment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "שגיאה במחיקת תשלום" }, { status: 500 });
  }
}
