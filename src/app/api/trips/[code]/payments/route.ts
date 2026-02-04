import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await context.params;
    const trip = await prisma.trip.findUnique({ where: { code } });
    if (!trip) return NextResponse.json({ error: "טיול לא נמצא" }, { status: 404 });
    const body = await request.json();
    const { amount, paidById, description, note, paidAt } = body;
    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "סכום חובה וחייב להיות חיובי" }, { status: 400 });
    }
    if (!paidById || typeof paidById !== "string") {
      return NextResponse.json({ error: "מי שילם חובה" }, { status: 400 });
    }
    const participant = await prisma.participant.findFirst({
      where: { id: paidById, tripId: trip.id },
    });
    if (!participant) return NextResponse.json({ error: "משתתף לא נמצא" }, { status: 404 });
    const payment = await prisma.payment.create({
      data: {
        tripId: trip.id,
        amount: Math.round(amount * 100) / 100,
        paidById,
        description: description && typeof description === "string" ? description.trim() || null : null,
        note: note && typeof note === "string" ? note.trim() || null : null,
        paidAt: paidAt ? new Date(paidAt) : undefined,
      },
      include: { paidBy: true },
    });
    return NextResponse.json(payment);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "שגיאה בהוספת תשלום" }, { status: 500 });
  }
}
