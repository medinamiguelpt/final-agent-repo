import { NextResponse } from "next/server";

const BASE = "https://api.elevenlabs.io/v1";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const EL_KEY = process.env.ELEVENLABS_API_KEY;
  if (!EL_KEY) return NextResponse.json({ error: "No API key" }, { status: 500 });

  const { id } = await params;

  try {
    const res = await fetch(`${BASE}/convai/conversations/${id}`, {
      headers: { "xi-api-key": EL_KEY },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ error: `ElevenLabs error: ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
