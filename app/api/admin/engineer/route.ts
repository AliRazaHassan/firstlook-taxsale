import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash, timingSafeEqual } from "crypto";

export const runtime = "nodejs";

const Body = z.object({
  request: z.string().trim().min(3).max(2000),
  module: z.string().max(80).optional(),
  strategy: z.enum(["flip","rental","brrrr"]).optional(),
  inputs: z.record(z.unknown()).optional(),
  results: z.record(z.unknown()).optional(),
  property: z.record(z.unknown()).optional(),
});

function authorized(request: Request) {
  const expected = process.env.FIRSTLOOK_ADMIN_KEY;
  if (!expected) return false;
  const supplied = request.headers.get("x-firstlook-admin-key") ?? "";
  const a = createHash("sha256").update(expected).digest();
  const b = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(a,b);
}

function deterministicAudit(body: z.infer<typeof Body>) {
  const i = body.inputs ?? {};
  const r = body.results ?? {};
  const n = (k:string) => Number(i[k] ?? 0);
  const rn = (k:string) => Number(r[k] ?? 0);
  const pct = (k:string) => Math.max(0, Math.min(100, n(k))) / 100;
  const findings:string[] = [];

  if (n("arv") <= 0) findings.push("ARV is missing, so profit/MAO cannot be decision-ready.");
  if (body.strategy !== "flip" && n("monthlyRent") <= 0) findings.push("Rent is missing, so rental cash flow and cash-on-cash are not decision-ready.");
  if (n("purchasePrice") < 0 || n("rehab") < 0) findings.push("Negative acquisition/rehab input detected.");
  if (n("refiLtvPct") > 100) findings.push("Refinance LTV exceeds 100% and should be clamped/validated.");
  if (rn("cashNeeded") < 0 || rn("mortgage") < 0) findings.push("A calculated financing output is negative; inspect formula bounds.");

  if (n("arv") > 0 && n("purchasePrice") >= 0) {
    const buyClosing = n("purchasePrice") * pct("buyClosingPct");
    const sellClosing = n("arv") * pct("sellClosingPct");
    const contingency = n("rehab") * pct("contingencyPct");
    const holding = Math.max(0,n("holdingMonths")) * Math.max(0,n("monthlyHolding"));
    const expectedFlip = n("arv") - n("purchasePrice") - buyClosing - n("rehab") - contingency - holding - sellClosing;
    if (Number.isFinite(rn("flipProfit")) && Math.abs(rn("flipProfit") - expectedFlip) > 2) {
      findings.push(`Flip profit mismatch: UI ${rn("flipProfit").toFixed(2)} vs deterministic ${expectedFlip.toFixed(2)}.`);
    }
    const targetProfit = n("arv") * 0.15;
    const expectedMao = Math.max(0,(n("arv") - sellClosing - n("rehab") - contingency - holding - targetProfit) / (1 + pct("buyClosingPct")));
    if (Number.isFinite(rn("mao")) && Math.abs(rn("mao") - expectedMao) > 2) {
      findings.push(`MAO mismatch: UI ${rn("mao").toFixed(2)} vs deterministic ${expectedMao.toFixed(2)}.`);
    }
  }

  if (body.strategy === "brrrr" && rn("refiNet") > 0 && rn("remainingLoan") > 0 && rn("cashBackFromRefi") > Math.max(0, rn("refiNet") - rn("remainingLoan")) + 2) {
    findings.push("BRRRR cash-out appears to ignore acquisition-loan payoff.");
  }

  return findings;
}

function providerReason(status:number) {
  if (status === 401) return "OpenAI rejected the configured API key.";
  if (status === 429) return "OpenAI API quota/rate limit was reached.";
  if (status >= 500) return "OpenAI is temporarily unavailable.";
  return `OpenAI returned HTTP ${status}.`;
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Admin authorization required." }, { status: 401 });

  try {
    const body = Body.parse(await request.json());
    const deterministicFindings = deterministicAudit(body);
    const keyConfigured = Boolean(process.env.OPENAI_API_KEY);
    console.info("AI Engineer request", { keyConfigured, module: body.module, strategy: body.strategy });

    if (!keyConfigured) {
      return NextResponse.json({
        status:"diagnosed",
        deterministicFindings,
        analysis:"OpenAI is not configured for this runtime. Deterministic anomaly checks completed.",
        providerStatus:"missing-key",
        canAutoApply:false,
      }, { headers: { "Cache-Control":"no-store" } });
    }

    const context = JSON.stringify({
      module:body.module,
      strategy:body.strategy,
      inputs:body.inputs,
      results:body.results,
      property:body.property,
      deterministicFindings,
    },null,2).slice(0,22000);

    const response = await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{"Content-Type":"application/json",Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},
      body:JSON.stringify({
        model:process.env.OPENAI_CONCIERGE_MODEL || "gpt-5-mini",
        instructions:"You are FirstLook AI Engineer, an admin-only diagnostic agent for a real-estate investment application. Analyze calculation or UI bug reports against supplied deterministic inputs/results. Recompute important arithmetic independently and identify likely formula, assumption, data-provenance, or UI problems. Never invent source data. Distinguish a software bug from a bad/missing user assumption. Return concise sections: VERDICT, RECOMPUTATION, LIKELY CAUSE, PROPOSED FIX, TESTS. If evidence is insufficient, say exactly what is missing. You may propose code-level fixes, but this endpoint does not directly modify production.",
        input:`CURRENT APP STATE:\n${context}\n\nADMIN REPORT:\n${body.request}`,
        max_output_tokens:900
      }),
      signal: AbortSignal.timeout(25000),
    });

    if(!response.ok){
      const detail=await response.text();
      console.error("AI Engineer provider error",response.status,detail.slice(0,400));
      return NextResponse.json({
        status:"diagnosed",
        analysis:providerReason(response.status),
        providerStatus:response.status,
        deterministicFindings,
        canAutoApply:false,
      }, { headers: { "Cache-Control":"no-store" } });
    }

    const json=await response.json() as {output_text?:string;output?:Array<{content?:Array<{type?:string;text?:string}>}>};
    const analysis=json.output_text || json.output?.flatMap(o=>o.content??[]).find(x=>x.type==="output_text")?.text || "No analysis returned.";
    console.info("AI Engineer provider success");
    return NextResponse.json({
      status:"diagnosed",
      providerStatus:"ok",
      deterministicFindings,
      analysis,
      canAutoApply:false,
      nextStep:"Review the diagnosis, then use the controlled Fix workflow to create and test a code patch."
    }, { headers: { "Cache-Control":"no-store" } });
  } catch(err){
    const message=err instanceof Error?err.message:"AI Engineer request failed";
    console.error("AI Engineer request failure", message);
    return NextResponse.json({error:message},{status:400, headers: { "Cache-Control":"no-store" }});
  }
}
