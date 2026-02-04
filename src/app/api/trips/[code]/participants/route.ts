import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const trip = await prisma.trip.findUnique({ where: { code } });
  if (!trip) return NextResponse.json({ error: "טיול לא נמצא" }, { status: 404 });
  const participants = await prisma.participant.findMany({
    where: { tripId: trip.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(participants);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const trip = await prisma.trip.findUnique({ where: { code } });
  if (!trip) return NextResponse.json({ error: "טיול לא נמצא" }, { status: 404 });
  const body = await request.json();
  const { name, nickname, isAdmin } = body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "שם משתתף חובה" }, { status: 400 });
  }
  const participant = await prisma.participant.create({
    data: {
      tripId: trip.id,
      name: name.trim(),
      nickname: nickname && typeof nickname === "string" ? nickname.trim() || null : null,
      isAdmin: !!isAdmin,
    },
  });
  return NextResponse.json(participant);
}
