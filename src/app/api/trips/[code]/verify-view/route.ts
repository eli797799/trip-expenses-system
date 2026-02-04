import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const { code: tripCode } = await context.params;
    const body = await request.json();
    const entered = typeof body?.code === "string" ? body.code.trim() : "";

    const supabase = createClient();
    const { data: row, error } = await supabase
      .from("trips")
      .select("view_code")
      .eq("trip_code", tripCode)
      .single();

    if (error || !row) {
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    const viewCode = (row as { view_code: string | null }).view_code;
    if (viewCode == null || viewCode === "") {
      return NextResponse.json({ ok: true });
    }
    if (entered === viewCode) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
