# FirstLook — Tax-Sale Deal Screener MVP

**Product:** FirstLook  
**Job:** Tell investors which tax-sale properties to look at first.

Not a chatbot. An automated research workflow that ranks parcels and exports a usable sheet.

## What the MVP includes

- Landing page (`/`)
- Investor app (`/app`)
- Clayton County demo (instant, pre-researched)
- Live CSV research (up to 30 parcels) via Census Geocoder + ACS
- Score / rank / red flags / research links
- Max-bid calculator (ARV − rehab − holding − closings − profit)
- CSV export for Google Sheets

## Quick start

```bash
cd E:\taxsale-agent
npm install
npm run dev
```

Open http://localhost:3000

## Demo

1. Go to `/app`
2. Demo loads automatically (Clayton County, GA — July 2026 sample)
3. Click **Look first** filter
4. Export CSV → import to Google Sheets

## Live research CSV format

```csv
sale_date,parcel_id,owner,address,tax_years,assessed_fmv,cry_out_bid,property_type_hint,county,state,city_hint
07/07/2026,05176A D012,LOREDO GORGE,10341 CANYON TRL,2024|2025,253500,10727.16,residential,Clayton,GA,Jonesboro
```

Sample file: `data/clayton-ga-july-2026-sample.csv`

## Pricing (suggested)

| Plan | Price | Includes |
|------|-------|----------|
| Prototype | $125 | One list, 20–30 parcels, ranked sheet |
| Monthly AI employee | $149/mo | Ongoing lists, buy-box tuning, max-bid |

## Stack

- Next.js 15 + React 19
- Census Geocoder + Census Reporter ACS
- Buy-box scoring engine in `lib/engine/`
- Optional CLI still available: `npm run research`

## Honest limits (Phase 1)

- Values = assessed FMV + ACS tract medians (not MLS comps)
- Live research is rate-limited politely (~1–2 min for 27 parcels)
- Assessor deep-links currently tuned for Clayton County qPublic
