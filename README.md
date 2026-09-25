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
| 4 | Miss next county posting | Live stub (watch registration) |

## App features

- Demo + live CSV research (≤100)
- Buy box + max-bid settings (localStorage)
- Impact: % noise cut / hours saved
- County rule packs (GA Clayton, FL/TX patterns)
- Pre-bid diligence checklist
- Overbid guard
- Auction **bid sheet** export
- CSV template download
- County watch signup

## Run

```bash
npm install
npm run dev
```
