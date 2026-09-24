import { google } from "googleapis";
import { env } from "./config.js";
import type { ScoredProperty } from "./types.js";

function toSheetValues(properties: ScoredProperty[]): string[][] {
  const header = [
    "Rank",
    "Look at first",
    "Score",
    "Address",
    "Matched address",
    "Parcel/APN",
    "Owner",
    "Property type",
    "Assessed FMV",
    "Cry-out bid",
    "Equity spread %",
    "Est. market mid",
    "Tract median value",
    "Assessor",
    "Zillow",
    "Redfin",
    "Regrid",
    "Google Maps",
    "Red flags",
    "Notes",
  ];

  const rows = properties.map((p) => [
    String(p.rank),
    p.lookAtFirst ? "YES" : "",
    String(p.score),
    p.cleanAddress,
    p.matchedAddress ?? "",
    p.parcel_id,
    p.owner,
    p.propertyType,
    String(p.assessed_fmv),
    String(p.cry_out_bid),
    String(Math.round(p.equitySpread * 1000) / 10),
    p.estimatedMarketMid != null ? String(p.estimatedMarketMid) : "",
    p.tractMedianHomeValue != null ? String(p.tractMedianHomeValue) : "",
    p.assessorUrl,
    p.zillowUrl,
    p.redfinUrl,
    p.regridUrl,
    p.googleMapsUrl,
    p.redFlags.join(" | "),
    p.notes,
  ]);

  return [header, ...rows];
}

export async function exportToGoogleSheets(properties: ScoredProperty[]): Promise<string> {
  if (!env.sheetsId || !env.serviceAccountEmail || !env.serviceAccountKey) {
    throw new Error(
      "Google Sheets export requires GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    );
  }

  const auth = new google.auth.JWT({
    email: env.serviceAccountEmail,
    key: env.serviceAccountKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const values = toSheetValues(properties);
  const tab = "TaxSale Research";

  await sheets.spreadsheets.values.clear({
    spreadsheetId: env.sheetsId,
    range: `${tab}!A:Z`,
  }).catch(async () => {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: env.sheetsId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tab } } }],
      },
    });
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: env.sheetsId,
    range: `${tab}!A1`,
    valueInputOption: "RAW",
    requestBody: { values },
  });

  return `https://docs.google.com/spreadsheets/d/${env.sheetsId}`;
}
