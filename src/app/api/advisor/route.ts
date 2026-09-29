import { NextResponse } from "next/server";

/**
 * Server seam for a future AI-backed DeckAdvisor. The client posts a
 * structured DeckContext here; a real implementation would call a model with
 * server-side credentials and return structured recommendations. Until one
 * is configured this reports that honestly instead of fabricating advice.
 */
export async function GET() {
  return NextResponse.json({ configured: false, provider: null, message: "No AI advisor is configured. The deterministic local analysis is used instead." });
}

export async function POST() {
  return NextResponse.json({ configured: false, error: "No AI advisor is configured on this server." }, { status: 501 });
}
