import { cleanStreetAddress } from "./ingest.js";
import type { InputProperty, ResearchLinks } from "./types.js";

function encodeQuery(value: string): string {
  return encodeURIComponent(value);
}

export function buildResearchLinks(
  property: InputProperty,
  matchedAddress: string | null,
  lat: number | null,
  lon: number | null,
): ResearchLinks {
  const street = cleanStreetAddress(property.address);
  const city = property.city_hint || "Jonesboro";
  const state = property.state;
  const full = matchedAddress ?? `${street}, ${city}, ${state}`;
  const zillowSlug = full
    .toLowerCase()
    .replace(/,/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  const mapsQuery =
    lat != null && lon != null ? `${lat},${lon}` : full;

  return {
    assessorUrl: `https://qpublic.schneidercorp.com/Application.aspx?App=ClaytonCountyGA&Layer=Parcels&PageType=Search&KeyValue=${encodeQuery(property.parcel_id)}`,
    zillowUrl: `https://www.zillow.com/homes/${encodeQuery(zillowSlug)}_rb/`,
    redfinUrl: `https://www.redfin.com/stingray/do/location-autocomplete?location=${encodeQuery(full)}&v=2`,
    regridUrl:
      lat != null && lon != null
        ? `https://app.regrid.com/us/ga/clayton#b=map&lat=${lat}&lon=${lon}&zoom=18`
        : `https://app.regrid.com/search?query=${encodeQuery(full)}`,
    googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeQuery(mapsQuery)}`,
  };
}

/** Prefer a cleaner Redfin property search URL for humans. */
export function buildHumanRedfinUrl(fullAddress: string): string {
  return `https://www.redfin.com/search?q=${encodeQuery(fullAddress)}`;
}
