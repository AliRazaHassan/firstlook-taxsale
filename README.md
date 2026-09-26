# FirstLook — Tax-sale Bid Discipline OS

**Positioning (from market research):**  
PropStream (~$99) = general data + outreach.  
FastLien (~$49) = sale list aggregation.  
**Gap:** auction-day decision + max-bid discipline on the *official* county list.

FirstLook fills that gap.

Live: https://firstlook-taxsale.onrender.com

## Why this sells

#1 money leak in tax deeds = **overbidding under adrenaline**.  
Investors also waste 10–20 hours/county cleaning junk parcels.  
FirstLook automates: rank → walk-away max bid → county rules → diligence checklist → bid sheet.

## Phases

| Phase | Problem killed | Status |
|-------|----------------|--------|
| 1 | Whole list feels urgent | Live |
| 2 | Scores ≠ how you buy | Live |
| 3 | Overbid / weak diligence | Live (rules + checklist + bid sheet + valuation confidence) |
| 4 | Miss next county posting | Persistence-ready; alert worker/adapters pending |

## App features

- Demo + live CSV research (≤100)
- Buy box + max-bid settings (localStorage)
- Impact: % noise cut / hours saved
- County rule packs (GA Clayton, FL/TX patterns)
- Pre-bid diligence checklist
- Overbid guard
- Auction **bid sheet** export
- CSV template download
- County watch persistence when `DATABASE_URL` is configured
- Research-session persistence API
- Fail-safe jurisdiction rules: unknown counties never inherit another state's rule pack
- Evidence-aware valuation confidence (ACS tract data is not treated as property comps)

## Run

```bash
npm install
npm run dev
```

## Production configuration

Set `DATABASE_URL` to a PostgreSQL database (Render Postgres or compatible). The app creates its minimal watch/session tables on first use. County-watch registration is persisted only when the database is configured. Actual outbound alerts intentionally remain disabled until a county ingestion worker and delivery provider are configured; the UI/API must not imply an alert was sent when no worker exists.

## Safety / diligence

FirstLook is a screening and bid-discipline tool, not legal, title, appraisal, or investment advice. County/state rule packs are informational and must be verified against current official auction notices and qualified local guidance before bidding. ACS tract medians provide neighborhood context and are not comparable-sales appraisals.
