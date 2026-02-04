import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeBalances, computeSettlements } from "@/lib/balance";

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
        payments: { include: { paidBy: true } },
      },
    });
    if (!trip) {
      return NextResponse.json({ error: "טיול לא נמצא" }, { status: 404 });
    }

    const total = trip.payments.reduce((s, p) => s + p.amount, 0);
    const paidByParticipant = trip.participants.map((p) => ({
      participantId: p.id,
      name: p.name,
      nickname: p.nickname,
      sum: trip.payments
        .filter((pay) => pay.paidById === p.id)
        .reduce((s, pay) => s + pay.amount, 0),
    }));

    const balances = computeBalances(
      total,
      trip.participants.length,
      paidByParticipant
    );
    const settlements = computeSettlements(balances);

    return NextResponse.json({
      trip: {
        id: trip.id,
        name: trip.name,
        code: trip.code,
        startDate: trip.startDate,
        endDate: trip.endDate,
      },
      total: Math.round(total * 100) / 100,
      participantCount: trip.participants.length,
      averagePerPerson:
        trip.participants.length > 0
          ? Math.round((total / trip.participants.length) * 100) / 100
          : 0,
      balances: balances.map((b) => ({
        ...b,
        paid: Math.round(b.paid * 100) / 100,
        expected: Math.round(b.expected * 100) / 100,
        diff: Math.round(b.diff * 100) / 100,
      })),
      settlements,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "שגיאה" }, { status: 500 });
  }
}
