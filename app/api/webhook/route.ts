import { NextResponse } from "next/server";

// In-memory buffer: sessionId -> rows[]
const buffer = new Map<string, Record<string, string>[]>();

// Clean old sessions after 10 minutes
function cleanup() {
  // Simple: just cap total buffer size
  if (buffer.size > 100) {
    const keys = Array.from(buffer.keys());
    for (let i = 0; i < keys.length - 50; i++) {
      buffer.delete(keys[i]);
    }
  }
}

// POST: Push rows into buffer
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { rows, sessionId } = body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "Body must include 'rows' array" }, { status: 400 });
    }

    const sid = sessionId || `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const existing = buffer.get(sid) || [];
    buffer.set(sid, [...existing, ...rows]);
    cleanup();

    return NextResponse.json({ received: rows.length, sessionId: sid, total: buffer.get(sid)!.length });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}

// GET: Poll for new rows
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId param" }, { status: 400 });
  }

  const rows = buffer.get(sessionId) || [];
  buffer.delete(sessionId); // Drain on read

  return NextResponse.json({ rows, count: rows.length });
}
