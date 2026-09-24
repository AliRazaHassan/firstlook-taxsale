import { env } from "./config.js";
import { cleanStreetAddress } from "./ingest.js";
import type { AcsEnrichment, GeocodeResult, InputProperty } from "./types.js";

const GEOCODER =
  "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress";
const ACS_YEAR = "2024";
const USER_AGENT =
  "taxsale-agent/1.0 (phase1 research prototype; legitimate public-data enrichment)";

const CITY_FALLBACKS = [
  "Jonesboro",
  "Morrow",
  "Riverdale",
  "Forest Park",
  "Rex",
  "Ellenwood",
  "Lovejoy",
  "Lake City",
];

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.json();
}

function emptyGeocode(): GeocodeResult {
  return {
    matchedAddress: null,
    lat: null,
    lon: null,
    zip: null,
    city: null,
    state: null,
    tract: null,
    countyFips: null,
    stateFips: null,
    geocodeStatus: "unmatched",
  };
}

function parseGeocodePayload(payload: unknown): GeocodeResult {
  const matches =
    (payload as {
      result?: {
        addressMatches?: Array<{
          matchedAddress?: string;
          coordinates?: { x?: number; y?: number };
          addressComponents?: { zip?: string; city?: string; state?: string };
          geographies?: {
            "Census Tracts"?: Array<{
              TRACT?: string;
              COUNTY?: string;
              STATE?: string;
              NAME?: string;
            }>;
            Counties?: Array<{ COUNTY?: string; STATE?: string }>;
          };
        }>;
      };
    }).result?.addressMatches ?? [];

  if (!matches.length) return emptyGeocode();
  const hit = matches[0];
  const tractGeo = hit.geographies?.["Census Tracts"]?.[0];
  const countyGeo = hit.geographies?.Counties?.[0];

  return {
    matchedAddress: hit.matchedAddress ?? null,
    lat: hit.coordinates?.y ?? null,
    lon: hit.coordinates?.x ?? null,
    zip: hit.addressComponents?.zip ?? null,
    city: hit.addressComponents?.city ?? null,
    state: hit.addressComponents?.state ?? null,
    tract: tractGeo?.TRACT ?? null,
    countyFips: tractGeo?.COUNTY ?? countyGeo?.COUNTY ?? null,
    stateFips: tractGeo?.STATE ?? countyGeo?.STATE ?? null,
    geocodeStatus: "matched",
  };
}

export async function geocodeProperty(property: InputProperty): Promise<GeocodeResult> {
  const street = cleanStreetAddress(property.address);
  const cities = [
    property.city_hint,
    env.defaultCity,
    ...CITY_FALLBACKS,
  ].filter((c, i, arr): c is string => Boolean(c) && arr.indexOf(c) === i);

  for (const city of cities) {
    const oneLine = `${street}, ${city}, ${property.state}`;
    const url = `${GEOCODER}?address=${encodeURIComponent(oneLine)}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
    try {
      const payload = await fetchJson(url);
      const parsed = parseGeocodePayload(payload);
      if (parsed.geocodeStatus === "matched") return parsed;
    } catch {
      // try next city
    }
  }

  // Last attempt: county-level phrasing
  const countyLine = `${street}, ${property.county} County, ${property.state}`;
  try {
    const url = `${GEOCODER}?address=${encodeURIComponent(countyLine)}&benchmark=Public_AR.Current&vintage=Current_Current&format=json`.replace(
      "Public_AR.Current",
      "Public_AR_Current",
    );
    const payload = await fetchJson(url);
    return parseGeocodePayload(payload);
  } catch {
    return emptyGeocode();
  }
}

function emptyAcs(): AcsEnrichment {
  return {
    tractMedianHomeValue: null,
    tractMedianIncome: null,
    tractName: null,
    acsVintage: ACS_YEAR,
  };
}

/** Primary path: Census Reporter (public ACS), no API key required. */
async function enrichViaCensusReporter(geo: GeocodeResult): Promise<AcsEnrichment> {
  const geoId = `14000US${geo.stateFips}${geo.countyFips}${geo.tract}`;
  const url =
    `https://api.censusreporter.org/1.0/data/show/latest` +
    `?table_ids=B25077,B19013&geo_ids=${geoId}`;
  const payload = (await fetchJson(url)) as {
    data?: Record<
      string,
      {
        B25077?: { estimate?: { B25077001?: number } };
        B19013?: { estimate?: { B19013001?: number } };
      }
    >;
    geography?: Record<string, { name?: string }>;
    release?: { id?: string; years?: string };
  };

  const block = payload.data?.[geoId];
  if (!block) return emptyAcs();

  const medianValue = Number(block.B25077?.estimate?.B25077001);
  const medianIncome = Number(block.B19013?.estimate?.B19013001);
  return {
    tractName: payload.geography?.[geoId]?.name ?? null,
    tractMedianHomeValue: Number.isFinite(medianValue) && medianValue > 0 ? medianValue : null,
    tractMedianIncome: Number.isFinite(medianIncome) && medianIncome > 0 ? medianIncome : null,
    acsVintage: payload.release?.id ?? ACS_YEAR,
  };
}

/** Optional path when CENSUS_API_KEY is set. */
async function enrichViaCensusApi(geo: GeocodeResult): Promise<AcsEnrichment> {
  const key = process.env.CENSUS_API_KEY;
  if (!key) throw new Error("CENSUS_API_KEY not set");

  const vars = "NAME,B25077_001E,B19013_001E";
  const url =
    `https://api.census.gov/data/${ACS_YEAR}/acs/acs5?get=${vars}` +
    `&for=tract:${geo.tract}` +
    `&in=state:${geo.stateFips}%20county:${geo.countyFips}` +
    `&key=${encodeURIComponent(key)}`;

  const payload = (await fetchJson(url)) as Array<Array<string | null>>;
  if (!Array.isArray(payload) || payload.length < 2) return emptyAcs();
  const row = payload[1];
  const medianValue = Number(row[1]);
  const medianIncome = Number(row[2]);
  return {
    tractName: row[0] ?? null,
    tractMedianHomeValue: Number.isFinite(medianValue) && medianValue > 0 ? medianValue : null,
    tractMedianIncome: Number.isFinite(medianIncome) && medianIncome > 0 ? medianIncome : null,
    acsVintage: ACS_YEAR,
  };
}

export async function enrichWithAcs(geo: GeocodeResult): Promise<AcsEnrichment> {
  if (!geo.stateFips || !geo.countyFips || !geo.tract) return emptyAcs();

  try {
    return await enrichViaCensusReporter(geo);
  } catch {
    try {
      return await enrichViaCensusApi(geo);
    } catch {
      return emptyAcs();
    }
  }
}
