import path from "node:path";
import { loadBuyBox, ROOT } from "./config.js";
import { exportCsv } from "./exportCsv.js";
import { exportToGoogleSheets } from "./exportSheets.js";
import { loadTaxSaleCsv } from "./ingest.js";
import { researchProperties } from "./research.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const wantSheets = args.includes("--sheets");
  const inputArg = args.find((a) => !a.startsWith("--"));
  const inputPath = path.resolve(
    inputArg ?? path.join(ROOT, "data", "clayton-ga-july-2026-sample.csv"),
  );

  console.log("Tax-Sale Research Agent — Phase 1");
  console.log(`Input: ${inputPath}`);

  const buyBox = loadBuyBox();
  const properties = loadTaxSaleCsv(inputPath);
  console.log(`Loaded ${properties.length} properties`);
  console.log(`Buy box: ${buyBox.name}`);

  const results = await researchProperties(properties, buyBox, (done, total, parcelId) => {
    console.log(`[${done}/${total}] researched ${parcelId}`);
  });

  const csvPath = exportCsv(results, path.join(ROOT, "output"));
  console.log(`\nWrote sheet-ready CSV: ${csvPath}`);

  const top = results.filter((r) => r.lookAtFirst);
  console.log("\nLook at first:");
  for (const row of top) {
    console.log(
      `  #${row.rank} score=${row.score} | ${row.cleanAddress} | bid=$${row.cry_out_bid.toLocaleString()} | FMV=$${row.assessed_fmv.toLocaleString()}`,
    );
  }

  if (wantSheets) {
    const url = await exportToGoogleSheets(results);
    console.log(`\nGoogle Sheet updated: ${url}`);
  } else {
    console.log("\nTip: run `npm run research:sheets` after setting Google credentials in .env");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
