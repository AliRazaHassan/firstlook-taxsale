# Tax-Sale Research Agent — Phase 1 Prototype

Automated research workflow (not a chatbot) that takes a county tax-sale list, enriches each parcel with **legitimate public APIs**, builds investor research links, scores properties against a buy box, and writes a **Google-Sheets-ready CSV**.

## What Phase 1 answers

**Out of this tax-sale list, which properties should I look at first?**

## Demo data

Includes a real public sample from Clayton County, GA (July 7, 2026 tax sale posting): 27 parcels.

Source: [Clayton County July 2026 tax sale PDF](https://publicaccess.claytoncountyga.gov/content/PDF/july_2026_tax_sale.pdf)

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Runtime | Node.js + TypeScript | Maintainable, easy to host later |
| Geocoding | U.S. Census Geocoder | Official, free, no scraping |
| Neighborhood value | ACS via Census Reporter (`B25077` / `B19013`) | Official median home value & income by tract; optional `CENSUS_API_KEY` fallback |
| County assessor links | Clayton qPublic deep links | Legitimate county portal |
| Listing portals | Zillow / Redfin / Regrid / Google Maps search URLs | Human research shortcuts (no fragile scrape) |
| Output | CSV (+ optional Google Sheets API) | Matches Phase 1 deliverable |

Optional later: RentCast / ATTOM / Estated for paid AVMs, n8n/Make wrappers, LLM narrative notes.

## Quick start

```bash
cd E:\taxsale-agent
npm install
npm run research
```

Outputs:

- `output/taxsale-research-latest.csv` — import into Google Sheets
- `output/taxsale-research-latest.json` — full machine-readable results

### Optional Google Sheets upload

1. Create a Google Cloud service account with Sheets access
2. Share your spreadsheet with that service account email
3. Copy `.env.example` → `.env` and fill credentials
4. Run:

```bash
npm run research:sheets
```

## Input format

CSV columns:

`sale_date,parcel_id,owner,address,tax_years,assessed_fmv,cry_out_bid,property_type_hint,county,state,city_hint`

`tax_years` uses `|` separators, e.g. `2023|2024|2025`.

## Buy box

Edit `data/buy-box.json` to change scoring weights and red-flag thresholds.

Default Phase 1 heuristics:

- Prefer residential over vacant land
- Reward wide spread between assessed FMV and cry-out bid
- Penalize high tax burden ratio and long delinquency
- Blend assessed FMV with ACS tract median for a market range estimate
- Flag LLC/investor owners, incomplete addresses, and low-value parcels

## Architecture

```
tax-sale CSV
    → ingest / validate
    → Census geocode (lat/lon, tract, ZIP)
    → ACS tract enrichment
    → link builder (assessor, Zillow, Redfin, Regrid, Maps)
    → score + red flags + notes
    → ranked CSV / Google Sheet
```

## Phase 2+ roadmap

1. Full-list batching (hundreds of parcels) + queue/retries
2. Paid AVM + comps (RentCast / ATTOM)
3. Full client buy box + max bid calculator
4. Title/lien problem screening
5. Scheduled monitoring of new county postings
6. CRM / deal-tracker integration
7. Additional AI employees for GC / contracting ops

## Notes / limits (honest Phase 1)

- Market values are **estimates** from assessed FMV + ACS tract medians, not MLS comps
- Portal links open research pages; they do not scrape private listing payloads
- City hints help geocoding when the county list omits city/ZIP
- Replace the sample CSV with the client's real county list for production runs
