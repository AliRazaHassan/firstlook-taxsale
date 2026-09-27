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

function localAnswer(
  question: string,
  property?: Record<string, unknown>,
  providerReason = "AI provider is temporarily unavailable",
) {
  if (!property) {
    return `I can still help with FirstLook's deterministic results. ${providerReason}. Select a property for score, bid, valuation, risk and diligence context.`;
  }

  const q = question.toLowerCase();
  const truth = property.dealTruth as Record<string, unknown> | undefined;
  if (q.includes("truth") || q.includes("score")) {
    return `Deal Truth is ${truth?.overall ?? "not available"}/100 with ${truth?.confidence ?? "unknown"} confidence. It separates opportunity, valuation, title/legal, auction safety and liquidity so one attractive number does not hide an unresolved risk. ${providerReason}.`;
  }
  if (q.includes("max") || q.includes("bid")) {
    return `Modeled max bid is $${Number(property.maxBid ?? 0).toLocaleString()} versus a cry-out of $${Number(property.cry_out_bid ?? 0).toLocaleString()}. Treat the max as a ceiling based on current assumptions, not a guarantee; verify title, liens, condition and county rules before bidding. ${providerReason}.`;
  }
  if (q.includes("risk") || q.includes("flag")) {
    return `Automated flags: ${Array.isArray(property.redFlags) && property.redFlags.length ? property.redFlags.join("; ") : "none currently detected"}. No automated flag does not mean title, lien, occupancy or condition risk is cleared. ${providerReason}.`;
  }
  return `I can explain this parcel's score, max bid, valuation, red flags and diligence steps from FirstLook's deterministic results. ${providerReason}; the dashboard calculations still work.`;
}

function providerReason(status: number) {
  if (status === 401) return "OpenAI rejected the configured API key";
  if (status === 429) return "OpenAI API quota/rate limit was reached";
  if (status >= 500) return "OpenAI is temporarily unavailable";
  return `OpenAI returned HTTP ${status}`;
}

export async function POST(request: Request) {
  try {
    const body = Body.parse(await request.json());
    const keyConfigured = Boolean(process.env.OPENAI_API_KEY);
    console.info("Concierge request", {
      keyConfigured,
      model: process.env.OPENAI_CONCIERGE_MODEL || "gpt-5-mini",
      hasProperty: Boolean(body.property),
      hasAnalysis: Boolean(body.analysis),
    });

    if (!keyConfigured) {
      return NextResponse.json(
        {
          answer: localAnswer(body.question, body.property, "OpenAI is not configured for this runtime"),
          fallback: true,
          providerStatus: "missing-key",
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const context = JSON.stringify({
      property: body.property,
      diligence: body.diligence,
      analysis: body.analysis,
      portfolio: body.portfolio,
    }).slice(0, 22000);

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_CONCIERGE_MODEL || "gpt-5-mini",
        instructions:
          "You are FirstLook Copilot, a real-estate and tax-sale decision-support assistant. Explain the supplied FirstLook results in plain English and use the supplied analyzer inputs/results when the question is about a calculation. Be concise and practical. Never invent property facts, liens, title status, county law, comps, occupancy, condition, rent, taxes, insurance, or redemption facts. Clearly distinguish modeled estimates from verified facts and user assumptions. Never guarantee safety or profit. When evidence is missing, name exactly what must be verified. You may explain calculations and suggest diligence steps, but do not present yourself as a lawyer, title examiner, appraiser, or financial adviser.",
        input: `FIRSTLOOK CONTEXT:\n${context}\n\nUSER QUESTION:\n${body.question}`,
        max_output_tokens: 650,
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("Concierge provider error", response.status, detail.slice(0, 500));
      const reason = providerReason(response.status);
      return NextResponse.json(
        {
          answer: localAnswer(body.question, body.property, reason),
          fallback: true,
          providerStatus: response.status,
          providerReason: reason,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const json = await response.json() as {
      output_text?: string;
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    };
    const answer =
      json.output_text ||
      json.output?.flatMap((o) => o.content ?? []).find((c) => c.type === "output_text")?.text;

    console.info("Concierge provider success");
    return NextResponse.json(
      {
        answer: answer || localAnswer(body.question, body.property, "OpenAI returned an empty response"),
        providerStatus: answer ? "ok" : "empty",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Concierge request failed";
    console.error("Concierge request failure", message);
    return NextResponse.json({ error: message }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
