import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const Body = z.object({
  question: z.string().trim().min(1).max(1200),
  property: z.record(z.unknown()).optional(),
  diligence: z.record(z.unknown()).nullable().optional(),
  analysis: z.record(z.unknown()).optional(),
  portfolio: z.object({
    total: z.number().optional(),
    lookFirstCount: z.number().optional(),
  }).optional(),
});

function localAnswer(question: string, property?: Record<string, unknown>) {
  if (!property) return "Select a property first. I can then explain its Deal Truth score, max bid, red flags, valuation and next diligence steps.";
  const q = question.toLowerCase();
  const truth = property.dealTruth as Record<string, unknown> | undefined;
  if (q.includes("truth") || q.includes("score")) return `Deal Truth is ${truth?.overall ?? "not available"}/100 with ${truth?.confidence ?? "unknown"} confidence. It separates opportunity, valuation, title/legal, auction safety and liquidity so one attractive number does not hide an unresolved risk.`;
  if (q.includes("max") || q.includes("bid")) return `Modeled max bid is $${Number(property.maxBid ?? 0).toLocaleString()} versus a cry-out of $${Number(property.cry_out_bid ?? 0).toLocaleString()}. Treat the max as a ceiling based on current assumptions, not a guarantee; verify title, liens, condition and county rules before bidding.`;
  if (q.includes("risk") || q.includes("flag")) return `Automated flags: ${Array.isArray(property.redFlags) && property.redFlags.length ? property.redFlags.join("; ") : "none currently detected"}. No automated flag does not mean title, lien, occupancy or condition risk is cleared.`;
  return "I can explain this parcel's score, max bid, valuation, red flags and diligence steps. AI answers are disabled until OPENAI_API_KEY is configured; the dashboard's deterministic calculations still work.";
}

export async function POST(request: Request) {
  try {
    const body = Body.parse(await request.json());
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ answer: localAnswer(body.question, body.property) });
    }

    const context = JSON.stringify({ property: body.property, diligence: body.diligence, portfolio: body.portfolio }).slice(0, 18000);
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_CONCIERGE_MODEL || "gpt-5-mini",
        instructions: "You are FirstLook AI Concierge, a tax-sale decision-support assistant. Explain the supplied FirstLook results in plain English. Be concise and practical. Never invent property facts, liens, title status, county law, comps, occupancy, condition, or redemption facts. Clearly distinguish modeled estimates from verified facts. Never tell a user that a property is safe or guarantee profit. When evidence is missing, name exactly what must be verified before bidding. You may explain calculations and suggest diligence steps, but do not present yourself as a lawyer, title examiner, appraiser, or financial adviser.",
        input: `FIRSTLOOK CONTEXT:\n${context}\n\nUSER QUESTION:\n${body.question}`,
        max_output_tokens: 500,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("Concierge provider error", response.status, detail.slice(0, 500));
      return NextResponse.json({ answer: localAnswer(body.question, body.property), fallback: true });
    }
    const json = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    const answer = json.output_text || json.output?.flatMap((o) => o.content ?? []).find((c) => c.type === "output_text")?.text;
    return NextResponse.json({ answer: answer || localAnswer(body.question, body.property) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Concierge request failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
