import { config as loadEnv } from "dotenv";
import { readFileSync } from "node:fs";
import path from "node:path";
import { BuyBoxSchema, type BuyBox } from "./types.js";

loadEnv();

export const ROOT = path.resolve(process.cwd());

export function loadBuyBox(filePath = path.join(ROOT, "data", "buy-box.json")): BuyBox {
  const raw = JSON.parse(readFileSync(filePath, "utf8"));
  return BuyBoxSchema.parse(raw);
}

export const env = {
  defaultState: process.env.DEFAULT_STATE ?? "GA",
  defaultCounty: process.env.DEFAULT_COUNTY ?? "Clayton",
  defaultCity: process.env.DEFAULT_CITY ?? "Jonesboro",
  sheetsId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID ?? "",
  serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "",
  serviceAccountKey: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  llmProvider: process.env.LLM_PROVIDER ?? "none",
  openaiKey: process.env.OPENAI_API_KEY ?? "",
  anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
  googleApiKey: process.env.GOOGLE_API_KEY ?? "",
};
