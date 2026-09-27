import assert from "node:assert/strict";
import { parseTaxSaleCsv, type ScoredProperty } from "../lib/engine";
import { GET as demoGET } from "../app/api/demo/route";
import { POST as maxBidPOST } from "../app/api/max-bid/route";
import { POST as rescorePOST } from "../app/api/rescore/route";
import { POST as diligencePOST } from "../app/api/diligence/route";
import { GET as exportGET, POST as exportPOST } from "../app/api/export/route";
import { GET as healthGET } from "../app/api/health/route";
import { POST as monitorPOST } from "../app/api/monitor/route";
import { POST as sessionsPOST } from "../app/api/sessions/route";
import { POST as researchPOST } from "../app/api/research/route";
import { POST as conciergePOST } from "../app/api/concierge/route";

let ipCounter = 10;
function jsonRequest(url: string, body: unknown, headers: Record<string,string> = {}) {
  ipCounter += 1;
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `198.51.100.${ipCounter % 240 + 1}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function jsonBody<T = any>(response: Response): Promise<T> {
  return await response.json() as T;
}

function seededCsv(count: number) {
  const rows = ["sale_date,parcel_id,owner,address,tax_years,assessed_fmv,cry_out_bid,property_type_hint,county,state,city_hint"];
  for (let i = 1; i <= count; i++) {
    const assessed = 80000 + (i * 7919) % 320000;
    const cry = 3000 + (i * 3571) % Math.max(4000, Math.floor(assessed * 0.35));
    const owner = i % 7 === 0 ? `Seed Investments ${i} LLC` : `Seed Owner ${i}`;
    const type = i % 9 === 0 ? "vacant" : "residential";
    const years = i % 11 === 0 ? "" : i % 3 === 0 ? "2023|2024|2025" : "2024|2025";
    rows.push(`2026-10-01,SEED-${i},${owner},${100 + i} QA ST,"${years}",${assessed},${cry},${type},Clayton,GA,Jonesboro`);
  }
  return rows.join("\n");
}

async function run() {
  const scoreAnswer = await conciergePOST(jsonRequest("https://qa.local/api/concierge", { question: "Does checking diligence boxes change the score?" }));
  assert.equal(scoreAnswer.status, 200);
  assert.match((await jsonBody<{answer:string}>(scoreAnswer)).answer, /does not read checklist marks/i);
  // Seed/upload-style CSV ingestion.
  const seeded = parseTaxSaleCsv(seededCsv(50));
  assert.equal(seeded.length, 50, "50-row seeded CSV should parse");
  assert.equal(new Set(seeded.map((p) => p.parcel_id)).size, 50, "seeded parcel IDs should remain unique");
  assert(seeded.every((p) => p.county === "Clayton" && p.state === "GA"), "jurisdiction should survive CSV ingestion");

  const adversarialCsv = [
    "parcel_id,address,assessed_fmv,cry_out_bid,county,state",
    "BAD-1,1 BAD ST,100000,10000,,GA",
  ].join("\n");
  assert.throws(() => parseTaxSaleCsv(adversarialCsv), /county/i, "missing county must reject upload");

  const demoRes = await demoGET();
  assert.equal(demoRes.status, 200, "demo API should respond");
  const demo = await jsonBody<{ properties: ScoredProperty[]; total: number }>(demoRes);
  assert(demo.total > 0 && demo.properties.length === demo.total, "demo response should contain properties");

  // Max-bid route: valid and invalid boundaries.
  const maxBidRes = await maxBidPOST(jsonRequest("https://qa.local/api/max-bid", {
    arv: 250000,
    rehab: 30000,
    holdingMonths: 6,
    monthlyHolding: 600,
    closingBuyPct: 0.02,
    closingSellPct: 0.08,
    desiredProfit: 37500,
    contingency: 3000,
    titleLegal: 5000,
    survivingLiens: 7500,
    auctionFees: 1000,
  }));
  assert.equal(maxBidRes.status, 200, "valid max-bid route should succeed");
  const maxBid = await jsonBody<{ maxBid: number; projectedProfit: number }>(maxBidRes);
  assert(maxBid.maxBid > 0 && Number.isFinite(maxBid.projectedProfit), "max-bid output must be finite");

  const badPctRes = await maxBidPOST(jsonRequest("https://qa.local/api/max-bid", {
    arv: 250000, closingBuyPct: 1.5,
  }));
  assert.equal(badPctRes.status, 400, "percentages above 100% must reject");

  // Rescore route: normal, 100 max, 101 reject.
  const normalRescore = await rescorePOST(jsonRequest("https://qa.local/api/rescore", {
    properties: demo.properties.slice(0, Math.min(10, demo.properties.length)),
    buyBox: { minLookFirstScore: 0, maxLookFirst: 3 },
    bidDefaults: { rehab: 25000, desiredProfitPct: 0.15, titleLegal: 5000 },
  }));
  assert.equal(normalRescore.status, 200, "normal rescore should succeed");
  const rescored = await jsonBody<{ properties: ScoredProperty[]; lookFirstCount: number }>(normalRescore);
  assert(rescored.lookFirstCount <= 3, "rescore must obey maxLookFirst");

  const hundred = Array.from({ length: 100 }, (_, i) => ({ ...demo.properties[0], parcel_id: `R-${i}` }));
  const hundredRes = await rescorePOST(jsonRequest("https://qa.local/api/rescore", { properties: hundred }));
  assert.equal(hundredRes.status, 200, "100 properties should be accepted");

  const hundredOne = [...hundred, { ...demo.properties[0], parcel_id: "R-100" }];
  const hundredOneRes = await rescorePOST(jsonRequest("https://qa.local/api/rescore", { properties: hundredOne }));
  assert.equal(hundredOneRes.status, 413, "101 properties should be rejected");

  // Diligence: missing body and unknown jurisdiction.
  const missingDiligence = await diligencePOST(jsonRequest("https://qa.local/api/diligence", {}));
  assert.equal(missingDiligence.status, 400, "diligence requires a property");

  const unknownProperty = { ...demo.properties[0], county: "Mystery", state: "ZZ" };
  const unknownDiligence = await diligencePOST(jsonRequest("https://qa.local/api/diligence", { property: unknownProperty }));
  assert.equal(unknownDiligence.status, 200, "unknown jurisdiction should return an explicit unverified rule pack");
  const unknown = await jsonBody<{ rules: { id: string; label: string } }>(unknownDiligence);
  assert(unknown.rules.id.startsWith("unverified-"), "unknown jurisdiction must never inherit another county's rules");
  assert(/rules not loaded/i.test(unknown.rules.label), "unknown jurisdiction label should say rules are not loaded");

  // Export routes: template, valid CSV, invalid format and size ceiling.
  const template = await exportGET();
  assert.equal(template.status, 200, "CSV template should download");
  assert((template.headers.get("content-type") ?? "").includes("text/csv"), "template content type should be CSV");

  const exportRes = await exportPOST(jsonRequest("https://qa.local/api/export", {
    properties: [{ ...demo.properties[0], owner: "=2+2", address: "@SUM(1,1)", cleanAddress: "@SUM(1,1)" }],
    format: "full",
  }));
  assert.equal(exportRes.status, 200, "valid export should succeed");
  const exportedCsv = await exportRes.text();
  assert(exportedCsv.includes("'=2+2") && exportedCsv.includes("'@SUM"), "route export must neutralize spreadsheet formulas");

  const badFormat = await exportPOST(jsonRequest("https://qa.local/api/export", {
    properties: [demo.properties[0]], format: "pdf",
  }));
  assert.equal(badFormat.status, 400, "unsupported export format should reject");

  const exportTooMany = await exportPOST(jsonRequest("https://qa.local/api/export", {
    properties: Array.from({ length: 1001 }, (_, i) => ({ ...demo.properties[0], parcel_id: `E-${i}` })),
  }));
  assert.equal(exportTooMany.status, 413, "export over 1000 rows should reject");

  // Health should never expose secrets, only capability state.
  const healthRes = await healthGET();
  assert.equal(healthRes.status, 200, "health should respond");
  const health = await jsonBody<any>(healthRes);
  assert.equal(health.ok, true, "health should report ok");
  assert(health.capabilities && !("OPENAI_API_KEY" in health.capabilities), "health must not expose secret values");

  // Watch validation before DB work.
  const invalidWatch = await monitorPOST(jsonRequest("https://qa.local/api/monitor", {
    email: "not-an-email", county: "Clayton", state: "GA",
  }));
  assert.equal(invalidWatch.status, 400, "invalid watch email should reject before persistence");

  // Sessions must reject anonymous writes even if DB is later configured.
  const anonymousSession = await sessionsPOST(jsonRequest("https://qa.local/api/sessions", {
    label: "Unauthorized QA", payload: { a: 1 },
  }));
  assert.equal(anonymousSession.status, 401, "anonymous session writes must be blocked");

  // Research input validation without hitting external Census services.
  const emptyResearch = await researchPOST(jsonRequest("https://qa.local/api/research", { csv: "" }));
  assert.equal(emptyResearch.status, 400, "empty research CSV should reject");

  const badJurisdictionResearch = await researchPOST(jsonRequest("https://qa.local/api/research", {
    csv: adversarialCsv,
  }));
  assert.equal(badJurisdictionResearch.status, 400, "research route must reject CSV rows with missing jurisdiction before external enrichment");

  const oversizedCsv = "x".repeat(1_000_001);
  const oversizedResearch = await researchPOST(jsonRequest("https://qa.local/api/research", { csv: oversizedCsv }));
  assert.equal(oversizedResearch.status, 413, "research payload over 1 MB should reject");

  console.log("FirstLook route QA: seeded upload + API smoke tests passed.");
}

void run();
