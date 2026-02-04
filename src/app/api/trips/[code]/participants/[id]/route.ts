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
    const participant = await prisma.participant.findFirst({
      where: { id, tripId: trip.id },
    });
    if (!participant) {
      return NextResponse.json({ error: "משתתף לא נמצא" }, { status: 404 });
    }
    const paymentsCount = await prisma.payment.count({ where: { paidById: id } });
    if (paymentsCount > 0) {
      return NextResponse.json(
        { error: "לא ניתן למחוק משתתף שיש לו תשלומים. מחק קודם את התשלומים." },
        { status: 400 }
      );
    }
    await prisma.participant.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "שגיאה במחיקת משתתף" }, { status: 500 });
  }
}
