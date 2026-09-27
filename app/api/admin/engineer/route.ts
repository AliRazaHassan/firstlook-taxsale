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
  const findings:string[] = [];
  if (n("arv") <= 0) findings.push("ARV is missing, so profit/MAO cannot be decision-ready.");
  if (body.strategy !== "flip" && n("monthlyRent") <= 0) findings.push("Rent is missing, so rental cash flow and cash-on-cash are not decision-ready.");
  if (n("purchasePrice") < 0 || n("rehab") < 0) findings.push("Negative acquisition/rehab input detected.");
  if (body.strategy === "flip" && rn("flipProfit") > n("arv")) findings.push("Projected flip profit exceeds ARV; inspect the formula or inputs.");
  if (rn("cashNeeded") < 0 || rn("mortgage") < 0) findings.push("A calculated financing output is negative; inspect formula bounds.");
  if (n("refiLtvPct") > 100) findings.push("Refinance LTV exceeds 100% and should be clamped/validated.");
  return findings;
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Admin authorization required." }, { status: 401 });
  try {
    const body = Body.parse(await request.json());
    const deterministicFindings = deterministicAudit(body);
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ status:"diagnosed", deterministicFindings, analysis:"AI code diagnosis requires OPENAI_API_KEY. Deterministic anomaly checks completed.", canAutoApply:false });
    }
    const context = JSON.stringify({module:body.module,strategy:body.strategy,inputs:body.inputs,results:body.results,property:body.property,deterministicFindings},null,2).slice(0,20000);
    const response = await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{"Content-Type":"application/json",Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},
      body:JSON.stringify({
        model:process.env.OPENAI_CONCIERGE_MODEL || "gpt-5-mini",
        instructions:`You are FirstLook AI Engineer, an admin-only diagnostic agent for a real-estate investment application. Analyze calculation or UI bug reports against the supplied deterministic inputs/results. Recompute important arithmetic independently and identify likely formula, assumption, data-provenance, or UI problems. Never invent source data. Distinguish a software bug from a bad/missing user assumption. Return concise sections: VERDICT, RECOMPUTATION, LIKELY CAUSE, PROPOSED FIX, TESTS. If evidence is insufficient, say exactly what is missing. You may propose code-level fixes, but this endpoint does not directly modify production.`,
        input:`CURRENT APP STATE:\n${context}\n\nADMIN REPORT:\n${body.request}`,
        max_output_tokens:900
      })
    });
    if(!response.ok){const detail=await response.text(); console.error("AI Engineer provider error",response.status,detail.slice(0,400)); return NextResponse.json({error:"AI Engineer provider unavailable.",deterministicFindings},{status:502});}
    const json=await response.json() as {output_text?:string;output?:Array<{content?:Array<{type?:string;text?:string}>}>};
    const analysis=json.output_text || json.output?.flatMap(o=>o.content??[]).find(x=>x.type==="output_text")?.text || "No analysis returned.";
    return NextResponse.json({status:"diagnosed",deterministicFindings,analysis,canAutoApply:false,nextStep:"Review the diagnosis, then use the controlled Fix workflow to create and test a code patch."});
  } catch(err){return NextResponse.json({error:err instanceof Error?err.message:"AI Engineer request failed"},{status:400});}
}
