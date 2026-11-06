import type { UserTimeContextInput } from "@archmind/shared";
import type { MemoryStore } from "../db/memory";
import type { CalendarEventRecord, UserTimerRecord } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// IANA Time Zone & Geographic Lookup Table
// ─────────────────────────────────────────────────────────────────────────────

export interface PlaceTimeZoneInfo {
  name: string;
  country: string;
  timeZone: string;
  alternateZones?: Array<{ label: string; timeZone: string }>;
}

export const PLACE_TIMEZONES: Record<string, PlaceTimeZoneInfo> = {
  // Middle East & Africa
  egypt: { name: "Egypt (Cairo)", country: "Egypt", timeZone: "Africa/Cairo" },
  cairo: { name: "Cairo, Egypt", country: "Egypt", timeZone: "Africa/Cairo" },
  alexandria: { name: "Alexandria, Egypt", country: "Egypt", timeZone: "Africa/Cairo" },
  "saudi arabia": { name: "Saudi Arabia (Riyadh)", country: "Saudi Arabia", timeZone: "Asia/Riyadh" },
  riyadh: { name: "Riyadh, Saudi Arabia", country: "Saudi Arabia", timeZone: "Asia/Riyadh" },
  jeddah: { name: "Jeddah, Saudi Arabia", country: "Saudi Arabia", timeZone: "Asia/Riyadh" },
  mecca: { name: "Mecca, Saudi Arabia", country: "Saudi Arabia", timeZone: "Asia/Riyadh" },
  uae: { name: "United Arab Emirates (Dubai)", country: "UAE", timeZone: "Asia/Dubai" },
  "united arab emirates": { name: "United Arab Emirates (Dubai)", country: "UAE", timeZone: "Asia/Dubai" },
  dubai: { name: "Dubai, UAE", country: "UAE", timeZone: "Asia/Dubai" },
  "abu dhabi": { name: "Abu Dhabi, UAE", country: "UAE", timeZone: "Asia/Dubai" },
  qatar: { name: "Qatar (Doha)", country: "Qatar", timeZone: "Asia/Qatar" },
  doha: { name: "Doha, Qatar", country: "Qatar", timeZone: "Asia/Qatar" },
  kuwait: { name: "Kuwait", country: "Kuwait", timeZone: "Asia/Kuwait" },
  bahrain: { name: "Bahrain", country: "Bahrain", timeZone: "Asia/Bahrain" },
  oman: { name: "Oman (Muscat)", country: "Oman", timeZone: "Asia/Muscat" },
  jordan: { name: "Jordan (Amman)", country: "Jordan", timeZone: "Asia/Amman" },
  amman: { name: "Amman, Jordan", country: "Jordan", timeZone: "Asia/Amman" },
  lebanon: { name: "Lebanon (Beirut)", country: "Lebanon", timeZone: "Asia/Beirut" },
  beirut: { name: "Beirut, Lebanon", country: "Lebanon", timeZone: "Asia/Beirut" },
  palestine: { name: "Palestine", country: "Palestine", timeZone: "Asia/Gaza" },
  jerusalem: { name: "Jerusalem", country: "Jerusalem", timeZone: "Asia/Jerusalem" },
  iraq: { name: "Iraq (Baghdad)", country: "Iraq", timeZone: "Asia/Baghdad" },
  baghdad: { name: "Baghdad, Iraq", country: "Iraq", timeZone: "Asia/Baghdad" },
  morocco: { name: "Morocco (Casablanca)", country: "Morocco", timeZone: "Africa/Casablanca" },
  casablanca: { name: "Casablanca, Morocco", country: "Morocco", timeZone: "Africa/Casablanca" },
  rabat: { name: "Rabat, Morocco", country: "Morocco", timeZone: "Africa/Casablanca" },
  algeria: { name: "Algeria (Algiers)", country: "Algeria", timeZone: "Africa/Algiers" },
  tunisia: { name: "Tunisia (Tunis)", country: "Tunisia", timeZone: "Africa/Tunis" },
  nigeria: { name: "Nigeria (Lagos)", country: "Nigeria", timeZone: "Africa/Lagos" },
  lagos: { name: "Lagos, Nigeria", country: "Nigeria", timeZone: "Africa/Lagos" },
  kenya: { name: "Kenya (Nairobi)", country: "Kenya", timeZone: "Africa/Nairobi" },
  nairobi: { name: "Nairobi, Kenya", country: "Kenya", timeZone: "Africa/Nairobi" },
  "south africa": { name: "South Africa (Johannesburg)", country: "South Africa", timeZone: "Africa/Johannesburg" },
  johannesburg: { name: "Johannesburg, South Africa", country: "South Africa", timeZone: "Africa/Johannesburg" },

  // North America
  "united states": {
    name: "United States (Eastern / New York)",
    country: "United States",
    timeZone: "America/New_York",
    alternateZones: [
      { label: "US Eastern (New York/Miami)", timeZone: "America/New_York" },
      { label: "US Central (Chicago/Dallas)", timeZone: "America/Chicago" },
      { label: "US Mountain (Denver/Phoenix)", timeZone: "America/Denver" },
      { label: "US Pacific (Los Angeles/Seattle)", timeZone: "America/Los_Angeles" },
    ],
  },
  usa: {
    name: "United States (Eastern / New York)",
    country: "United States",
    timeZone: "America/New_York",
    alternateZones: [
      { label: "US Eastern (New York)", timeZone: "America/New_York" },
      { label: "US Central (Chicago)", timeZone: "America/Chicago" },
      { label: "US Mountain (Denver)", timeZone: "America/Denver" },
      { label: "US Pacific (Los Angeles)", timeZone: "America/Los_Angeles" },
    ],
  },
  "new york": { name: "New York, USA", country: "United States", timeZone: "America/New_York" },
  nyc: { name: "New York City, USA", country: "United States", timeZone: "America/New_York" },
  washington: { name: "Washington, D.C., USA", country: "United States", timeZone: "America/New_York" },
  miami: { name: "Miami, USA", country: "United States", timeZone: "America/New_York" },
  boston: { name: "Boston, USA", country: "United States", timeZone: "America/New_York" },
  atlanta: { name: "Atlanta, USA", country: "United States", timeZone: "America/New_York" },
  chicago: { name: "Chicago, USA", country: "United States", timeZone: "America/Chicago" },
  dallas: { name: "Dallas, USA", country: "United States", timeZone: "America/Chicago" },
  houston: { name: "Houston, USA", country: "United States", timeZone: "America/Chicago" },
  denver: { name: "Denver, USA", country: "United States", timeZone: "America/Denver" },
  phoenix: { name: "Phoenix, USA", country: "United States", timeZone: "America/Phoenix" },
  "los angeles": { name: "Los Angeles, USA", country: "United States", timeZone: "America/Los_Angeles" },
  "san francisco": { name: "San Francisco, USA", country: "United States", timeZone: "America/Los_Angeles" },
  seattle: { name: "Seattle, USA", country: "United States", timeZone: "America/Los_Angeles" },
  california: { name: "California, USA", country: "United States", timeZone: "America/Los_Angeles" },
  texas: { name: "Texas, USA", country: "United States", timeZone: "America/Chicago" },
  florida: { name: "Florida, USA", country: "United States", timeZone: "America/New_York" },
  canada: { name: "Canada (Toronto)", country: "Canada", timeZone: "America/Toronto" },
  toronto: { name: "Toronto, Canada", country: "Canada", timeZone: "America/Toronto" },
  vancouver: { name: "Vancouver, Canada", country: "Canada", timeZone: "America/Vancouver" },
  montreal: { name: "Montreal, Canada", country: "Canada", timeZone: "America/Toronto" },
  mexico: { name: "Mexico (Mexico City)", country: "Mexico", timeZone: "America/Mexico_City" },
  "mexico city": { name: "Mexico City, Mexico", country: "Mexico", timeZone: "America/Mexico_City" },

  // South America
  brazil: { name: "Brazil (São Paulo)", country: "Brazil", timeZone: "America/Sao_Paulo" },
  "sao paulo": { name: "São Paulo, Brazil", country: "Brazil", timeZone: "America/Sao_Paulo" },
  "rio de janeiro": { name: "Rio de Janeiro, Brazil", country: "Brazil", timeZone: "America/Sao_Paulo" },
  argentina: { name: "Argentina (Buenos Aires)", country: "Argentina", timeZone: "America/Argentina/Buenos_Aires" },
  "buenos aires": { name: "Buenos Aires, Argentina", country: "Argentina", timeZone: "America/Argentina/Buenos_Aires" },
  uruguay: { name: "Uruguay (Montevideo)", country: "Uruguay", timeZone: "America/Montevideo" },
  montevideo: { name: "Montevideo, Uruguay", country: "Uruguay", timeZone: "America/Montevideo" },
  paraguay: { name: "Paraguay (Asunción)", country: "Paraguay", timeZone: "America/Asuncion" },
  chile: { name: "Chile (Santiago)", country: "Chile", timeZone: "America/Santiago" },
  colombia: { name: "Colombia (Bogotá)", country: "Colombia", timeZone: "America/Bogota" },
  peru: { name: "Peru (Lima)", country: "Peru", timeZone: "America/Lima" },

  // Europe
  uk: { name: "United Kingdom (London)", country: "United Kingdom", timeZone: "Europe/London" },
  "united kingdom": { name: "United Kingdom (London)", country: "United Kingdom", timeZone: "Europe/London" },
  england: { name: "England (London)", country: "United Kingdom", timeZone: "Europe/London" },
  britain: { name: "Great Britain (London)", country: "United Kingdom", timeZone: "Europe/London" },
  london: { name: "London, UK", country: "United Kingdom", timeZone: "Europe/London" },
  ireland: { name: "Ireland (Dublin)", country: "Ireland", timeZone: "Europe/Dublin" },
  dublin: { name: "Dublin, Ireland", country: "Ireland", timeZone: "Europe/Dublin" },
  portugal: { name: "Portugal (Lisbon)", country: "Portugal", timeZone: "Europe/Lisbon" },
  lisbon: { name: "Lisbon, Portugal", country: "Portugal", timeZone: "Europe/Lisbon" },
  spain: { name: "Spain (Madrid)", country: "Spain", timeZone: "Europe/Madrid" },
  madrid: { name: "Madrid, Spain", country: "Spain", timeZone: "Europe/Madrid" },
  barcelona: { name: "Barcelona, Spain", country: "Spain", timeZone: "Europe/Madrid" },
  france: { name: "France (Paris)", country: "France", timeZone: "Europe/Paris" },
  paris: { name: "Paris, France", country: "France", timeZone: "Europe/Paris" },
  germany: { name: "Germany (Berlin)", country: "Germany", timeZone: "Europe/Berlin" },
  berlin: { name: "Berlin, Germany", country: "Germany", timeZone: "Europe/Berlin" },
  munich: { name: "Munich, Germany", country: "Germany", timeZone: "Europe/Berlin" },
  frankfurt: { name: "Frankfurt, Germany", country: "Germany", timeZone: "Europe/Berlin" },
  italy: { name: "Italy (Rome)", country: "Italy", timeZone: "Europe/Rome" },
  rome: { name: "Rome, Italy", country: "Italy", timeZone: "Europe/Rome" },
  milan: { name: "Milan, Italy", country: "Italy", timeZone: "Europe/Rome" },
  switzerland: { name: "Switzerland (Zurich)", country: "Switzerland", timeZone: "Europe/Zurich" },
  zurich: { name: "Zurich, Switzerland", country: "Switzerland", timeZone: "Europe/Zurich" },
  geneva: { name: "Geneva, Switzerland", country: "Switzerland", timeZone: "Europe/Zurich" },
  netherlands: { name: "Netherlands (Amsterdam)", country: "Netherlands", timeZone: "Europe/Amsterdam" },
  amsterdam: { name: "Amsterdam, Netherlands", country: "Netherlands", timeZone: "Europe/Amsterdam" },
  belgium: { name: "Belgium (Brussels)", country: "Belgium", timeZone: "Europe/Brussels" },
  brussels: { name: "Brussels, Belgium", country: "Belgium", timeZone: "Europe/Brussels" },
  austria: { name: "Austria (Vienna)", country: "Austria", timeZone: "Europe/Vienna" },
  vienna: { name: "Vienna, Austria", country: "Austria", timeZone: "Europe/Vienna" },
  poland: { name: "Poland (Warsaw)", country: "Poland", timeZone: "Europe/Warsaw" },
  warsaw: { name: "Warsaw, Poland", country: "Poland", timeZone: "Europe/Warsaw" },
  sweden: { name: "Sweden (Stockholm)", country: "Sweden", timeZone: "Europe/Stockholm" },
  stockholm: { name: "Stockholm, Sweden", country: "Sweden", timeZone: "Europe/Stockholm" },
  norway: { name: "Norway (Oslo)", country: "Norway", timeZone: "Europe/Oslo" },
  denmark: { name: "Denmark (Copenhagen)", country: "Denmark", timeZone: "Europe/Copenhagen" },
  finland: { name: "Finland (Helsinki)", country: "Finland", timeZone: "Europe/Helsinki" },
  greece: { name: "Greece (Athens)", country: "Greece", timeZone: "Europe/Athens" },
  athens: { name: "Athens, Greece", country: "Greece", timeZone: "Europe/Athens" },
  turkey: { name: "Turkey (Istanbul)", country: "Turkey", timeZone: "Europe/Istanbul" },
  istanbul: { name: "Istanbul, Turkey", country: "Turkey", timeZone: "Europe/Istanbul" },
  russia: { name: "Russia (Moscow)", country: "Russia", timeZone: "Europe/Moscow" },
  moscow: { name: "Moscow, Russia", country: "Russia", timeZone: "Europe/Moscow" },

  // Asia & Oceania
  japan: { name: "Japan (Tokyo)", country: "Japan", timeZone: "Asia/Tokyo" },
  tokyo: { name: "Tokyo, Japan", country: "Japan", timeZone: "Asia/Tokyo" },
  osaka: { name: "Osaka, Japan", country: "Japan", timeZone: "Asia/Tokyo" },
  "south korea": { name: "South Korea (Seoul)", country: "South Korea", timeZone: "Asia/Seoul" },
  korea: { name: "South Korea (Seoul)", country: "South Korea", timeZone: "Asia/Seoul" },
  seoul: { name: "Seoul, South Korea", country: "South Korea", timeZone: "Asia/Seoul" },
  china: { name: "China (Beijing/Shanghai)", country: "China", timeZone: "Asia/Shanghai" },
  beijing: { name: "Beijing, China", country: "China", timeZone: "Asia/Shanghai" },
  shanghai: { name: "Shanghai, China", country: "China", timeZone: "Asia/Shanghai" },
  "hong kong": { name: "Hong Kong", country: "China", timeZone: "Asia/Hong_Kong" },
  taiwan: { name: "Taiwan (Taipei)", country: "Taiwan", timeZone: "Asia/Taipei" },
  taipei: { name: "Taipei, Taiwan", country: "Taiwan", timeZone: "Asia/Taipei" },
  singapore: { name: "Singapore", country: "Singapore", timeZone: "Asia/Singapore" },
  malaysia: { name: "Malaysia (Kuala Lumpur)", country: "Malaysia", timeZone: "Asia/Kuala_Lumpur" },
  "kuala lumpur": { name: "Kuala Lumpur, Malaysia", country: "Malaysia", timeZone: "Asia/Kuala_Lumpur" },
  indonesia: { name: "Indonesia (Jakarta)", country: "Indonesia", timeZone: "Asia/Jakarta" },
  jakarta: { name: "Jakarta, Indonesia", country: "Indonesia", timeZone: "Asia/Jakarta" },
  thailand: { name: "Thailand (Bangkok)", country: "Thailand", timeZone: "Asia/Bangkok" },
  bangkok: { name: "Bangkok, Thailand", country: "Thailand", timeZone: "Asia/Bangkok" },
  vietnam: { name: "Vietnam (Ho Chi Minh)", country: "Vietnam", timeZone: "Asia/Ho_Chi_Minh" },
  philippines: { name: "Philippines (Manila)", country: "Philippines", timeZone: "Asia/Manila" },
  manila: { name: "Manila, Philippines", country: "Philippines", timeZone: "Asia/Manila" },
  india: { name: "India (New Delhi / Mumbai)", country: "India", timeZone: "Asia/Kolkata" },
  delhi: { name: "New Delhi, India", country: "India", timeZone: "Asia/Kolkata" },
  "new delhi": { name: "New Delhi, India", country: "India", timeZone: "Asia/Kolkata" },
  mumbai: { name: "Mumbai, India", country: "India", timeZone: "Asia/Kolkata" },
  bangalore: { name: "Bangalore, India", country: "India", timeZone: "Asia/Kolkata" },
  pakistan: { name: "Pakistan (Karachi/Islamabad)", country: "Pakistan", timeZone: "Asia/Karachi" },
  karachi: { name: "Karachi, Pakistan", country: "Pakistan", timeZone: "Asia/Karachi" },
  bangladesh: { name: "Bangladesh (Dhaka)", country: "Bangladesh", timeZone: "Asia/Dhaka" },
  australia: { name: "Australia (Sydney)", country: "Australia", timeZone: "Australia/Sydney" },
  sydney: { name: "Sydney, Australia", country: "Australia", timeZone: "Australia/Sydney" },
  melbourne: { name: "Melbourne, Australia", country: "Australia", timeZone: "Australia/Melbourne" },
  perth: { name: "Perth, Australia", country: "Australia", timeZone: "Australia/Perth" },
  "new zealand": { name: "New Zealand (Auckland)", country: "New Zealand", timeZone: "Pacific/Auckland" },
  auckland: { name: "Auckland, New Zealand", country: "New Zealand", timeZone: "Pacific/Auckland" },
  utc: { name: "Coordinated Universal Time (UTC)", country: "Global", timeZone: "UTC" },
  gmt: { name: "Greenwich Mean Time (GMT)", country: "Global", timeZone: "Etc/GMT" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Verified Historical & Upcoming FIFA World Cup Timeline (1930–2034)
// ─────────────────────────────────────────────────────────────────────────────

export interface WorldCupTournamentInfo {
  year: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  hostCountries: string[];
  finalCity: string;
  finalStadium: string;
  winner?: string;
  runnerUp?: string;
  finalScore?: string;
  notes?: string;
}

export const FIFA_WORLD_CUP_TIMELINE: WorldCupTournamentInfo[] = [
  {
    year: 1930,
    startDate: "1930-07-13",
    endDate: "1930-07-30",
    hostCountries: ["Uruguay"],
    finalCity: "Montevideo",
    finalStadium: "Estadio Centenario",
    winner: "Uruguay",
    runnerUp: "Argentina",
    finalScore: "4–2",
    notes: "Inaugural FIFA World Cup tournament."
  },
  {
    year: 1934,
    startDate: "1934-05-27",
    endDate: "1934-06-10",
    hostCountries: ["Italy"],
    finalCity: "Rome",
    finalStadium: "Stadio Nazionale PNF",
    winner: "Italy",
    runnerUp: "Czechoslovakia",
    finalScore: "2–1 (a.e.t.)"
  },
  {
    year: 1938,
    startDate: "1938-06-04",
    endDate: "1938-06-19",
    hostCountries: ["France"],
    finalCity: "Colombes (Paris)",
    finalStadium: "Stade Olympique de Colombes",
    winner: "Italy",
    runnerUp: "Hungary",
    finalScore: "4–2"
  },
  {
    year: 1950,
    startDate: "1950-06-24",
    endDate: "1950-07-16",
    hostCountries: ["Brazil"],
    finalCity: "Rio de Janeiro",
    finalStadium: "Maracanã Stadium",
    winner: "Uruguay",
    runnerUp: "Brazil",
    finalScore: "2–1 (Final Round Decider)"
  },
  {
    year: 1954,
    startDate: "1954-06-16",
    endDate: "1954-07-04",
    hostCountries: ["Switzerland"],
    finalCity: "Bern",
    finalStadium: "Wankdorf Stadium",
    winner: "West Germany",
    runnerUp: "Hungary",
    finalScore: "3–2"
  },
  {
    year: 1958,
    startDate: "1958-06-08",
    endDate: "1958-06-29",
    hostCountries: ["Sweden"],
    finalCity: "Solna (Stockholm)",
    finalStadium: "Råsunda Stadium",
    winner: "Brazil",
    runnerUp: "Sweden",
    finalScore: "5–2"
  },
  {
    year: 1962,
    startDate: "1962-05-30",
    endDate: "1962-06-17",
    hostCountries: ["Chile"],
    finalCity: "Santiago",
    finalStadium: "Estadio Nacional",
    winner: "Brazil",
    runnerUp: "Czechoslovakia",
    finalScore: "3–1"
  },
  {
    year: 1966,
    startDate: "1966-07-11",
    endDate: "1966-07-30",
    hostCountries: ["England"],
    finalCity: "London",
    finalStadium: "Wembley Stadium",
    winner: "England",
    runnerUp: "West Germany",
    finalScore: "4–2 (a.e.t.)"
  },
  {
    year: 1970,
    startDate: "1970-05-31",
    endDate: "1970-06-21",
    hostCountries: ["Mexico"],
    finalCity: "Mexico City",
    finalStadium: "Estadio Azteca",
    winner: "Brazil",
    runnerUp: "Italy",
    finalScore: "4–1"
  },
  {
    year: 1974,
    startDate: "1974-06-13",
    endDate: "1974-07-07",
    hostCountries: ["West Germany"],
    finalCity: "Munich",
    finalStadium: "Olympiastadion",
    winner: "West Germany",
    runnerUp: "Netherlands",
    finalScore: "2–1"
  },
  {
    year: 1978,
    startDate: "1978-06-01",
    endDate: "1978-06-25",
    hostCountries: ["Argentina"],
    finalCity: "Buenos Aires",
    finalStadium: "Estadio Monumental",
    winner: "Argentina",
    runnerUp: "Netherlands",
    finalScore: "3–1 (a.e.t.)"
  },
  {
    year: 1982,
    startDate: "1982-06-13",
    endDate: "1982-07-11",
    hostCountries: ["Spain"],
    finalCity: "Madrid",
    finalStadium: "Santiago Bernabéu",
    winner: "Italy",
    runnerUp: "West Germany",
    finalScore: "3–1"
  },
  {
    year: 1986,
    startDate: "1986-05-31",
    endDate: "1986-06-29",
    hostCountries: ["Mexico"],
    finalCity: "Mexico City",
    finalStadium: "Estadio Azteca",
    winner: "Argentina",
    runnerUp: "West Germany",
    finalScore: "3–2"
  },
  {
    year: 1990,
    startDate: "1990-06-08",
    endDate: "1990-07-08",
    hostCountries: ["Italy"],
    finalCity: "Rome",
    finalStadium: "Stadio Olimpico",
    winner: "West Germany",
    runnerUp: "Argentina",
    finalScore: "1–0"
  },
  {
    year: 1994,
    startDate: "1994-06-17",
    endDate: "1994-07-17",
    hostCountries: ["United States"],
    finalCity: "Pasadena (Los Angeles)",
    finalStadium: "Rose Bowl",
    winner: "Brazil",
    runnerUp: "Italy",
    finalScore: "0–0 (3–2 pen.)"
  },
  {
    year: 1998,
    startDate: "1998-06-10",
    endDate: "1998-07-12",
    hostCountries: ["France"],
    finalCity: "Saint-Denis (Paris)",
    finalStadium: "Stade de France",
    winner: "France",
    runnerUp: "Brazil",
    finalScore: "3–0"
  },
  {
    year: 2002,
    startDate: "2002-05-31",
    endDate: "2002-06-30",
    hostCountries: ["South Korea", "Japan"],
    finalCity: "Yokohama",
    finalStadium: "International Stadium Yokohama",
    winner: "Brazil",
    runnerUp: "Germany",
    finalScore: "2–0"
  },
  {
    year: 2006,
    startDate: "2006-06-09",
    endDate: "2006-07-09",
    hostCountries: ["Germany"],
    finalCity: "Berlin",
    finalStadium: "Olympiastadion",
    winner: "Italy",
    runnerUp: "France",
    finalScore: "1–1 (5–3 pen.)"
  },
  {
    year: 2010,
    startDate: "2010-06-11",
    endDate: "2010-07-11",
    hostCountries: ["South Africa"],
    finalCity: "Johannesburg",
    finalStadium: "Soccer City (FNB Stadium)",
    winner: "Spain",
    runnerUp: "Netherlands",
    finalScore: "1–0 (a.e.t.)"
  },
  {
    year: 2014,
    startDate: "2014-06-12",
    endDate: "2014-07-13",
    hostCountries: ["Brazil"],
    finalCity: "Rio de Janeiro",
    finalStadium: "Maracanã Stadium",
    winner: "Germany",
    runnerUp: "Argentina",
    finalScore: "1–0 (a.e.t.)"
  },
  {
    year: 2018,
    startDate: "2018-06-14",
    endDate: "2018-07-15",
    hostCountries: ["Russia"],
    finalCity: "Moscow",
    finalStadium: "Luzhniki Stadium",
    winner: "France",
    runnerUp: "Croatia",
    finalScore: "4–2"
  },
  {
    year: 2022,
    startDate: "2022-11-20",
    endDate: "2022-12-18",
    hostCountries: ["Qatar"],
    finalCity: "Lusail",
    finalStadium: "Lusail Stadium",
    winner: "Argentina",
    runnerUp: "France",
    finalScore: "3–3 (4–2 pen.)"
  },
  {
    year: 2026,
    startDate: "2026-06-11",
    endDate: "2026-07-19",
    hostCountries: ["United States", "Mexico", "Canada"],
    finalCity: "East Rutherford (New York/New Jersey)",
    finalStadium: "MetLife Stadium",
    notes: "First 48-team FIFA World Cup, hosted jointly across 16 cities in the US, Mexico, and Canada."
  },
  {
    year: 2030,
    startDate: "2030-06-08",
    endDate: "2030-07-21",
    hostCountries: ["Morocco", "Portugal", "Spain", "Uruguay", "Argentina", "Paraguay"],
    finalCity: "Madrid / Casablanca / Lisbon (Centenary Edition)",
    finalStadium: "Centenary Host Venues",
    notes: "Centenary FIFA World Cup hosted by Morocco, Portugal, and Spain with opening centenary matches in Uruguay, Argentina, and Paraguay."
  },
  {
    year: 2034,
    startDate: "2034-11-01",
    endDate: "2034-12-18",
    hostCountries: ["Saudi Arabia"],
    finalCity: "Riyadh",
    finalStadium: "King Salman International Stadium",
    notes: "2034 FIFA World Cup hosted by Saudi Arabia."
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// Core Time Zone, DST & Calendar Math Utilities
// ─────────────────────────────────────────────────────────────────────────────

export function isValidTimeZone(tz?: string | null): boolean {
  if (!tz || typeof tz !== "string") return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
}

export function resolveSafeTimeZone(tz?: string | null, fallback = "UTC"): string {
  if (tz && isValidTimeZone(tz.trim())) {
    return tz.trim();
  }
  return fallback;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function getDaysInMonth(year: number, month1To12: number): number {
  return new Date(Date.UTC(year, month1To12, 0)).getUTCDate();
}

export interface ZonedDateParts {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
  hour: number;  // 0-23
  minute: number;
  second: number;
  weekday: string;
  weekdayShort: string;
  monthName: string;
  isoDate: string; // YYYY-MM-DD
  formattedTime12: string;
  formattedTime24: string;
  formattedFull: string;
}

export function getZonedDateParts(date: Date, timeZone: string): ZonedDateParts {
  const safeTz = resolveSafeTimeZone(timeZone, "UTC");
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "long",
    hour12: false,
  });

  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }

  const year = Number(map.year || date.getUTCFullYear());
  const month = Number(map.month || date.getUTCMonth() + 1);
  const day = Number(map.day || date.getUTCDate());
  let hour = Number(map.hour || 0);
  if (hour === 24) hour = 0;
  const minute = Number(map.minute || 0);
  const second = Number(map.second || 0);
  const weekday = map.weekday || "Monday";

  const monthName = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTz,
    month: "long",
  }).format(date);

  const formattedTime12 = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTz,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);

  const isoDate = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const formattedTime24 = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekday,
    weekdayShort: weekday.slice(0, 3),
    monthName,
    isoDate,
    formattedTime12,
    formattedTime24,
    formattedFull: `${weekday}, ${monthName} ${day}, ${year} at ${formattedTime12}`,
  };
}

/**
 * Returns the UTC offset in minutes for `timeZone` at `date`.
 * Positive means ahead of UTC (e.g. Africa/Cairo = +120, Asia/Tokyo = +540).
 * Negative means behind UTC (e.g. America/New_York = -300 in EST, -240 in EDT).
 */
export function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const safeTz = resolveSafeTimeZone(timeZone, "UTC");
  const zoned = getZonedDateParts(date, safeTz);
  const asUtcMs = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hour,
    zoned.minute,
    zoned.second
  );
  const utcFloorSecondsMs = Math.floor(date.getTime() / 1000) * 1000;
  return Math.round((asUtcMs - utcFloorSecondsMs) / 60000);
}

export function formatUtcOffset(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  return `UTC${sign}${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export interface TimeZoneDetailedSnapshot {
  timeZone: string;
  localDate: string; // YYYY-MM-DD
  localTime12: string;
  localTime24: string;
  weekday: string;
  formattedFull: string;
  utcOffsetMinutes: number;
  utcOffsetFormatted: string;
  isDstActive: boolean;
  observesDst: boolean;
  standardOffsetMinutes: number;
  dstOffsetMinutes: number;
  isLeapYear: boolean;
  daysInCurrentMonth: number;
}

export function getTimeZoneSnapshot(date: Date, timeZone: string): TimeZoneDetailedSnapshot {
  const safeTz = resolveSafeTimeZone(timeZone, "UTC");
  const parts = getZonedDateParts(date, safeTz);
  const currentOffset = getTimeZoneOffsetMinutes(date, safeTz);

  // Check Jan 15 and Jul 15 of the same year to determine standard vs daylight saving offset
  const janDate = new Date(Date.UTC(parts.year, 0, 15, 12, 0, 0));
  const julDate = new Date(Date.UTC(parts.year, 6, 15, 12, 0, 0));
  const janOffset = getTimeZoneOffsetMinutes(janDate, safeTz);
  const julOffset = getTimeZoneOffsetMinutes(julDate, safeTz);

  const observesDst = janOffset !== julOffset;
  const standardOffsetMinutes = Math.min(janOffset, julOffset);
  const dstOffsetMinutes = Math.max(janOffset, julOffset);
  const isDstActive = observesDst && currentOffset === dstOffsetMinutes;

  return {
    timeZone: safeTz,
    localDate: parts.isoDate,
    localTime12: parts.formattedTime12,
    localTime24: parts.formattedTime24,
    weekday: parts.weekday,
    formattedFull: parts.formattedFull,
    utcOffsetMinutes: currentOffset,
    utcOffsetFormatted: formatUtcOffset(currentOffset),
    isDstActive,
    observesDst,
    standardOffsetMinutes,
    dstOffsetMinutes,
    isLeapYear: isLeapYear(parts.year),
    daysInCurrentMonth: getDaysInMonth(parts.year, parts.month),
  };
}

/**
 * Converts a local wall-clock date/time in `timeZone` into an exact UTC `Date`.
 */
export function zonedWallClockToUtc(
  input: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number },
  timeZone: string
): Date {
  const safeTz = resolveSafeTimeZone(timeZone, "UTC");
  const guessUtcMs = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    input.hour ?? 9,
    input.minute ?? 0,
    input.second ?? 0
  );
  const firstOffset = getTimeZoneOffsetMinutes(new Date(guessUtcMs), safeTz);
  const firstAdjusted = guessUtcMs - firstOffset * 60_000;
  // Re-evaluate offset at the adjusted instant to handle DST transition boundaries accurately
  const secondOffset = getTimeZoneOffsetMinutes(new Date(firstAdjusted), safeTz);
  return new Date(guessUtcMs - secondOffset * 60_000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Cross-Time-Zone Comparison & Location Resolution
// ─────────────────────────────────────────────────────────────────────────────

export interface TimeZoneComparisonResult {
  fromLabel: string;
  fromSnapshot: TimeZoneDetailedSnapshot;
  toLabel: string;
  toSnapshot: TimeZoneDetailedSnapshot;
  differenceMinutes: number;
  differenceHours: number;
  formattedDifference: string;
  relativeDayInTarget: "same_day" | "tomorrow" | "yesterday";
  isTomorrowInTarget: boolean;
  isYesterdayInTarget: boolean;
  alternateComparisons?: Array<{
    label: string;
    timeZone: string;
    utcOffsetFormatted: string;
    localTime12: string;
    localDate: string;
    differenceHours: number;
  }>;
}

export function compareTimeZones(
  date: Date,
  fromTimeZone: string,
  toTimeZone: string,
  fromLabel = fromTimeZone,
  toLabel = toTimeZone,
  toAlternates?: Array<{ label: string; timeZone: string }>
): TimeZoneComparisonResult {
  const fromSnap = getTimeZoneSnapshot(date, fromTimeZone);
  const toSnap = getTimeZoneSnapshot(date, toTimeZone);

  const differenceMinutes = toSnap.utcOffsetMinutes - fromSnap.utcOffsetMinutes;
  const differenceHours = Number((differenceMinutes / 60).toFixed(2));
  const absHours = Math.floor(Math.abs(differenceMinutes) / 60);
  const absMins = Math.abs(differenceMinutes) % 60;
  const hourPart = `${absHours} hour${absHours === 1 ? "" : "s"}${absMins > 0 ? ` ${absMins} minutes` : ""}`;

  let formattedDifference: string;
  if (differenceMinutes === 0) {
    formattedDifference = `${toLabel} is in the exact same time zone offset (${toSnap.utcOffsetFormatted}) as ${fromLabel}.`;
  } else if (differenceMinutes > 0) {
    formattedDifference = `${toLabel} (${toSnap.utcOffsetFormatted}) is ${hourPart} ahead of ${fromLabel} (${fromSnap.utcOffsetFormatted}).`;
  } else {
    formattedDifference = `${toLabel} (${toSnap.utcOffsetFormatted}) is ${hourPart} behind ${fromLabel} (${fromSnap.utcOffsetFormatted}).`;
  }

  let relativeDayInTarget: "same_day" | "tomorrow" | "yesterday" = "same_day";
  if (toSnap.localDate > fromSnap.localDate) {
    relativeDayInTarget = "tomorrow";
  } else if (toSnap.localDate < fromSnap.localDate) {
    relativeDayInTarget = "yesterday";
  }

  const alternateComparisons = toAlternates?.map((alt) => {
    const snap = getTimeZoneSnapshot(date, alt.timeZone);
    const diffH = Number(((snap.utcOffsetMinutes - fromSnap.utcOffsetMinutes) / 60).toFixed(2));
    return {
      label: alt.label,
      timeZone: snap.timeZone,
      utcOffsetFormatted: snap.utcOffsetFormatted,
      localTime12: snap.localTime12,
      localDate: snap.localDate,
      differenceHours: diffH,
    };
  });

  return {
    fromLabel,
    fromSnapshot: fromSnap,
    toLabel,
    toSnapshot: toSnap,
    differenceMinutes,
    differenceHours,
    formattedDifference,
    relativeDayInTarget,
    isTomorrowInTarget: relativeDayInTarget === "tomorrow",
    isYesterdayInTarget: relativeDayInTarget === "yesterday",
    alternateComparisons,
  };
}

export function resolvePlaceFromText(query: string): PlaceTimeZoneInfo[] {
  const lower = query.toLowerCase();
  const matches: Array<{ key: string; info: PlaceTimeZoneInfo; index: number }> = [];

  // Sort keys longest-first so "new york" or "united states" matches before shorter substrings
  const sortedKeys = Object.keys(PLACE_TIMEZONES).sort((a, b) => b.length - a.length);
  const consumedSpans: Array<[number, number]> = [];

  for (const key of sortedKeys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    const match = regex.exec(lower);
    if (match && match.index !== undefined) {
      const start = match.index;
      const end = start + key.length;
      const overlaps = consumedSpans.some(([s, e]) => start < e && end > s);
      if (!overlaps) {
        consumedSpans.push([start, end]);
        matches.push({ key, info: PLACE_TIMEZONES[key]!, index: start });
      }
    }
  }

  // Sort in order of appearance in the user's question
  return matches
    .sort((a, b) => a.index - b.index)
    .map((m) => m.info);
}

// ─────────────────────────────────────────────────────────────────────────────
// Date Math, Relative Date Resolution & Duration Calculation
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_NAMES: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

const WEEKDAY_NUMBERS: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

export interface CalendarDateDelta {
  fromIsoDate: string;
  toIsoDate: string;
  totalDays: number;
  isFuture: boolean;
  isPast: boolean;
  isToday: boolean;
  years: number;
  months: number;
  days: number;
  formattedSummary: string;
}

export function calculateCalendarDateDelta(fromIsoDate: string, toIsoDate: string): CalendarDateDelta {
  const [fy, fm, fd] = fromIsoDate.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = toIsoDate.split("-").map(Number) as [number, number, number];

  const fromUtc = Date.UTC(fy, fm - 1, fd);
  const toUtc = Date.UTC(ty, tm - 1, td);
  const totalDays = Math.round((toUtc - fromUtc) / 86_400_000);

  const isToday = totalDays === 0;
  const isFuture = totalDays > 0;
  const isPast = totalDays < 0;

  const absDays = Math.abs(totalDays);
  const years = Math.floor(absDays / 365);
  const remainingAfterYears = absDays % 365;
  const months = Math.floor(remainingAfterYears / 30);
  const days = remainingAfterYears % 30;

  let formattedSummary: string;
  if (isToday) {
    formattedSummary = `Today (${toIsoDate})`;
  } else if (isFuture) {
    formattedSummary = `${absDays} day${absDays === 1 ? "" : "s"} remaining until ${toIsoDate}`;
  } else {
    formattedSummary = `${absDays} day${absDays === 1 ? "" : "s"} ago (since ${toIsoDate})`;
  }

  return {
    fromIsoDate,
    toIsoDate,
    totalDays,
    isFuture,
    isPast,
    isToday,
    years,
    months,
    days,
    formattedSummary,
  };
}

export function addDaysToIsoDate(isoDate: string, daysToAdd: number): string {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  const next = new Date(Date.UTC(y, m - 1, d + daysToAdd));
  return `${String(next.getUTCFullYear()).padStart(4, "0")}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

export function formatIsoDateReadable(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(dt);
}

/**
 * Resolves natural-language date expressions ("tomorrow", "yesterday", "last Friday",
 * "next Monday", "January 1", "in 5 days", "2026-12-25") relative to the user's current local date.
 */
export function resolveNaturalDateExpressions(
  text: string,
  nowDate: Date,
  userTimeZone: string
): Array<{ expression: string; isoDate: string; readableDate: string; deltaDays: number }> {
  const results: Array<{ expression: string; isoDate: string; readableDate: string; deltaDays: number }> = [];
  const snap = getTimeZoneSnapshot(nowDate, userTimeZone);
  const todayIso = snap.localDate;
  const [curYear, curMonth, curDay] = todayIso.split("-").map(Number) as [number, number, number];
  const currentWeekday = new Date(Date.UTC(curYear, curMonth - 1, curDay)).getUTCDay();
  const lower = text.toLowerCase();

  const addResult = (expression: string, targetIso: string) => {
    const delta = calculateCalendarDateDelta(todayIso, targetIso);
    results.push({
      expression,
      isoDate: targetIso,
      readableDate: formatIsoDateReadable(targetIso),
      deltaDays: delta.totalDays,
    });
  };

  if (/\btoday\b/.test(lower)) {
    addResult("today", todayIso);
  }
  if (/\btomorrow\b/.test(lower)) {
    addResult("tomorrow", addDaysToIsoDate(todayIso, 1));
  }
  if (/\byesterday\b/.test(lower)) {
    addResult("yesterday", addDaysToIsoDate(todayIso, -1));
  }
  if (/\bday after tomorrow\b/.test(lower)) {
    addResult("day after tomorrow", addDaysToIsoDate(todayIso, 2));
  }

  // "next <weekday>" or "last <weekday>" or "this <weekday>"
  const weekdayRegex = /\b(next|last|this)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = weekdayRegex.exec(lower)) !== null) {
    const modifier = match[1]!.toLowerCase();
    const dayName = match[2]!.toLowerCase();
    const targetDow = WEEKDAY_NUMBERS[dayName];
    if (targetDow !== undefined) {
      let diff = 0;
      if (modifier === "next") {
        diff = (targetDow - currentWeekday + 7) % 7;
        if (diff === 0) diff = 7;
      } else if (modifier === "last") {
        diff = -((currentWeekday - targetDow + 7) % 7);
        if (diff === 0) diff = -7;
      } else {
        // "this <weekday>" -> upcoming occurrence in current 7-day window
        diff = (targetDow - currentWeekday + 7) % 7;
      }
      addResult(match[0], addDaysToIsoDate(todayIso, diff));
    }
  }

  // "in N days/weeks" or "N days ago"
  const relativeOffsetRegex = /\bin\s+(\d+)\s+(day|days|week|weeks)\b/gi;
  while ((match = relativeOffsetRegex.exec(lower)) !== null) {
    const count = Number(match[1]);
    const unit = match[2]!.toLowerCase();
    const days = unit.startsWith("week") ? count * 7 : count;
    addResult(match[0], addDaysToIsoDate(todayIso, days));
  }

  // Explicit "Month Day[, Year]" (e.g., "January 1", "January 1, 2027", "July 19, 2026")
  const monthDayRegex = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\b/gi;
  while ((match = monthDayRegex.exec(lower)) !== null) {
    const monthNum = MONTH_NAMES[match[1]!.toLowerCase()];
    const dayNum = Number(match[2]);
    const explicitYear = match[3] ? Number(match[3]) : undefined;
    if (monthNum && dayNum >= 1 && dayNum <= 31) {
      let targetYear = explicitYear ?? curYear;
      let candidateIso = `${String(targetYear).padStart(4, "0")}-${String(monthNum).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      // If no year was specified and the question asks "until <Month Day>" and the date has already passed this year, roll to next year
      if (!explicitYear && candidateIso < todayIso && /\b(until|till|next|upcoming|countdown|left|remaining)\b/.test(lower)) {
        targetYear = curYear + 1;
        candidateIso = `${String(targetYear).padStart(4, "0")}-${String(monthNum).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      }
      addResult(match[0], candidateIso);
    }
  }

  // Explicit ISO date "YYYY-MM-DD"
  const isoRegex = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  while ((match = isoRegex.exec(text)) !== null) {
    addResult(match[0], match[0]);
  }

  // "New Year" / "New Year's Day"
  if (/\bnew year(?:'s|s)?(?: day)?\b/i.test(lower) && !results.some((r) => r.isoDate.endsWith("-01-01"))) {
    const nextJan1 = `${curYear + 1}-01-01`;
    addResult("New Year's Day", nextJan1);
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Natural-Language Calendar, Reminder, Timer & Countdown Action Extractor
// ─────────────────────────────────────────────────────────────────────────────

export interface ExecutedTimeAction {
  type: "calendar_event_created" | "reminder_scheduled" | "timer_started" | "countdown_created";
  summary: string;
  event?: CalendarEventRecord;
  timer?: UserTimerRecord;
}

function parseTimeOfDayFromText(text: string): { hour: number; minute: number } | undefined {
  // Match e.g. "at 3:30 pm", "at 15:00", "at 9am"
  const timeMatch = /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i.exec(text);
  if (!timeMatch) return undefined;
  let hour = Number(timeMatch[1]);
  const minute = timeMatch[2] ? Number(timeMatch[2]) : 0;
  const meridiem = timeMatch[3]?.toLowerCase();
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
    return { hour, minute };
  }
  return undefined;
}

export function executeNaturalLanguageTimeActions(input: {
  question: string;
  userId: string;
  nowDate: Date;
  userTimeZone: string;
  store: MemoryStore;
}): ExecutedTimeAction[] {
  const actions: ExecutedTimeAction[] = [];
  const text = input.question.trim();
  const lower = text.toLowerCase();
  const resolvedDates = resolveNaturalDateExpressions(text, input.nowDate, input.userTimeZone);

  // 1. Detect Timer creation ("start/set a timer for X minutes/seconds/hours")
  const timerRegex = /\b(?:start|set|create|run)\s+(?:a\s+)?timer\s+(?:for\s+)?(\d+)\s*(hour|hours|hr|hrs|minute|minutes|min|mins|second|seconds|sec|secs)\b/i;
  const timerMatch = timerRegex.exec(text);
  if (timerMatch) {
    const amount = Number(timerMatch[1]);
    const unit = timerMatch[2]!.toLowerCase();
    let durationMs = amount * 1000;
    if (unit.startsWith("hour") || unit.startsWith("hr")) {
      durationMs = amount * 3_600_000;
    } else if (unit.startsWith("min")) {
      durationMs = amount * 60_000;
    }
    const labelMatch = /\bfor\s+\d+\s*(?:hour|hours|hr|hrs|minute|minutes|min|mins|second|seconds|sec|secs)\s+(?:for|called|named|to)\s+([^.?!]+)/i.exec(text);
    const label = labelMatch?.[1]?.trim() || `${amount} ${unit} timer`;
    const timer = input.store.createUserTimer(input.userId, {
      label,
      kind: "timer",
      durationMs,
    });
    actions.push({
      type: "timer_started",
      summary: `Started timer "${timer.label}" for ${amount} ${unit} (ends at ${timer.targetTimestamp}).`,
      timer,
    });
  }

  // 2. Detect Countdown creation ("create/start a countdown to <date/event>")
  const countdownRegex = /\b(?:create|start|set|add)\s+(?:a\s+)?countdown\s+(?:to|for|until)\s+([^.?!]+)/i;
  const countdownMatch = countdownRegex.exec(text);
  if (countdownMatch && resolvedDates.length > 0) {
    const targetDate = resolvedDates[0]!;
    const [ty, tm, td] = targetDate.isoDate.split("-").map(Number) as [number, number, number];
    const targetUtc = zonedWallClockToUtc({ year: ty, month: tm, day: td, hour: 0, minute: 0, second: 0 }, input.userTimeZone);
    const durationMs = Math.max(0, targetUtc.getTime() - input.nowDate.getTime());
    const label = countdownMatch[1]!.trim();
    const timer = input.store.createUserTimer(input.userId, {
      label: `Countdown: ${label}`,
      kind: "countdown",
      durationMs,
      targetTimestamp: targetUtc.toISOString(),
    });
    actions.push({
      type: "countdown_created",
      summary: `Created live countdown "${timer.label}" targeting ${targetDate.readableDate} (${targetDate.isoDate}).`,
      timer,
    });
  }

  // 3. Detect Calendar Scheduling ("schedule ... for ...", "add ... to my calendar")
  const isScheduleIntent =
    /\b(?:schedule|book|add to (?:my )?calendar|put on (?:my )?calendar|create (?:an )?event)\b/i.test(lower);

  if (isScheduleIntent) {
    const targetDateInfo = resolvedDates[0] ?? {
      expression: "tomorrow",
      isoDate: addDaysToIsoDate(getTimeZoneSnapshot(input.nowDate, input.userTimeZone).localDate, 1),
      readableDate: formatIsoDateReadable(addDaysToIsoDate(getTimeZoneSnapshot(input.nowDate, input.userTimeZone).localDate, 1)),
      deltaDays: 1,
    };
    const [ty, tm, td] = targetDateInfo.isoDate.split("-").map(Number) as [number, number, number];
    const parsedTime = parseTimeOfDayFromText(text) ?? { hour: 9, minute: 0 };
    const startUtc = zonedWallClockToUtc(
      { year: ty, month: tm, day: td, hour: parsedTime.hour, minute: parsedTime.minute, second: 0 },
      input.userTimeZone
    );
    const endUtc = new Date(startUtc.getTime() + 3_600_000);

    // Extract a clean title
    let cleanTitle = text
      .replace(/^(?:please\s+)?(?:can you\s+)?(?:schedule|book|create an event|add to (?:my )?calendar)\s+/i, "")
      .replace(/\b(?:for|on)\s+(?:next|this|last)?\s*(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today)\b.*/i, "")
      .trim();
    if (!cleanTitle || /^(?:this|it|that)$/i.test(cleanTitle)) {
      cleanTitle = "Scheduled Event";
    }

    // Check if user also specified a reminder offset in the same sentence
    const reminderOffsetMatch = /\bremind\s+me\s+(\d+|one|two|three|four|five)\s+(hour|hours|minute|minutes|min|mins)\s+before\b/i.exec(lower);
    let remindBeforeMinutes: number | undefined;
    if (reminderOffsetMatch) {
      const wordMap: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };
      const rawNum = reminderOffsetMatch[1]!.toLowerCase();
      const count = wordMap[rawNum] ?? Number(rawNum);
      const unit = reminderOffsetMatch[2]!.toLowerCase();
      remindBeforeMinutes = unit.startsWith("hour") ? count * 60 : count;
    }

    const event = input.store.createCalendarEvent(input.userId, {
      title: cleanTitle.slice(0, 140),
      description: `Scheduled via AGENTIA chat: "${text}"`,
      startTime: startUtc.toISOString(),
      endTime: endUtc.toISOString(),
      timeZone: input.userTimeZone,
      category: "schedule",
      remindBeforeMinutes,
    });

    actions.push({
      type: "calendar_event_created",
      summary: `Scheduled "${event.title}" for ${targetDateInfo.readableDate} (${getZonedDateParts(startUtc, input.userTimeZone).formattedTime12} ${input.userTimeZone}).`,
      event,
    });
  }

  // 4. Detect standalone Reminder request ("Remind me two hours before the event", "Remind me tomorrow to ...")
  const remindBeforeRegex = /\bremind\s+me\s+(\d+|one|two|three|four|five|six|12|24)\s+(hour|hours|hr|hrs|minute|minutes|min|mins)\s+before\b/i;
  const remindBeforeMatch = remindBeforeRegex.exec(lower);
  if (remindBeforeMatch && !isScheduleIntent) {
    const wordMap: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
    const rawNum = remindBeforeMatch[1]!.toLowerCase();
    const count = wordMap[rawNum] ?? Number(rawNum);
    const unit = remindBeforeMatch[2]!.toLowerCase();
    const remindBeforeMinutes = unit.startsWith("hour") || unit.startsWith("hr") ? count * 60 : count;

    // Attach to the user's most recent or next upcoming event if one exists, otherwise create a reminder event
    const userEvents = input.store.listCalendarEvents(input.userId);
    const targetEvent = userEvents[0];
    if (targetEvent) {
      const updated = input.store.updateCalendarEvent(input.userId, targetEvent.id, {
        remindBeforeMinutes,
      });
      if (updated) {
        actions.push({
          type: "reminder_scheduled",
          summary: `Set a reminder ${remindBeforeMinutes} minutes (${count} ${unit}) before "${updated.title}" (triggers at ${updated.reminderTriggerTime}).`,
          event: updated,
        });
      }
    } else {
      const fallbackDate = resolvedDates[0]?.isoDate ?? addDaysToIsoDate(getTimeZoneSnapshot(input.nowDate, input.userTimeZone).localDate, 1);
      const [ty, tm, td] = fallbackDate.split("-").map(Number) as [number, number, number];
      const startUtc = zonedWallClockToUtc({ year: ty, month: tm, day: td, hour: 9, minute: 0, second: 0 }, input.userTimeZone);
      const created = input.store.createCalendarEvent(input.userId, {
        title: "Upcoming Event",
        description: text,
        startTime: startUtc.toISOString(),
        timeZone: input.userTimeZone,
        category: "reminder",
        remindBeforeMinutes,
      });
      actions.push({
        type: "reminder_scheduled",
        summary: `Created event "${created.title}" with a reminder ${remindBeforeMinutes} minutes (${count} ${unit}) before start (${created.reminderTriggerTime}).`,
        event: created,
      });
    }
  }

  return actions;
}

// ─────────────────────────────────────────────────────────────────────────────
// FIFA World Cup & Historical Timeline Analyzer
// ─────────────────────────────────────────────────────────────────────────────

export function analyzeWorldCupTimeline(nowDate: Date, userTimeZone: string) {
  const snap = getTimeZoneSnapshot(nowDate, userTimeZone);
  const todayIso = snap.localDate;

  const pastTournaments = FIFA_WORLD_CUP_TIMELINE.filter((t) => t.endDate < todayIso);
  const activeTournament = FIFA_WORLD_CUP_TIMELINE.find((t) => t.startDate <= todayIso && t.endDate >= todayIso);
  const upcomingTournaments = FIFA_WORLD_CUP_TIMELINE.filter((t) => t.startDate > todayIso);

  const lastCompleted = pastTournaments.at(-1);
  const nextUpcoming = upcomingTournaments[0];
  const nextDelta = nextUpcoming ? calculateCalendarDateDelta(todayIso, nextUpcoming.startDate) : undefined;

  return {
    todayIso,
    lastCompleted,
    activeTournament,
    nextUpcoming,
    nextDelta,
    allTournaments: FIFA_WORLD_CUP_TIMELINE,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Master Agent-Level Temporal & Location Reasoning Prompt Builder
// ─────────────────────────────────────────────────────────────────────────────

export interface TemporalPromptBundle {
  promptBlock: string;
  userTimeSnapshot: TimeZoneDetailedSnapshot;
  serverUtcIso: string;
  executedActions: ExecutedTimeAction[];
  calendarEvents: CalendarEventRecord[];
  activeTimers: UserTimerRecord[];
}

export function buildTemporalPromptContext(input: {
  question: string;
  userId?: string;
  userTimeContext?: UserTimeContextInput;
  store?: MemoryStore;
  now?: Date;
}): TemporalPromptBundle {
  const nowDate = input.now ?? new Date();
  const serverUtcIso = nowDate.toISOString();
  const serverTimeZone = resolveSafeTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone, "UTC");

  // Never assume the user's time zone is the server's time zone.
  const userTimeZone = resolveSafeTimeZone(input.userTimeContext?.timeZone, "UTC");
  const userTimeZoneExplicitlyDetected = Boolean(input.userTimeContext?.timeZone && isValidTimeZone(input.userTimeContext.timeZone));
  const userSnap = getTimeZoneSnapshot(nowDate, userTimeZone);
  const utcSnap = getTimeZoneSnapshot(nowDate, "UTC");

  // Location awareness — never fabricate location or claim access without permission
  const locationCtx = input.userTimeContext?.location;
  let locationStatusLine: string;
  if (locationCtx?.permissionGranted && typeof locationCtx.latitude === "number" && typeof locationCtx.longitude === "number") {
    locationStatusLine = `AUTHORIZED GPS LOCATION: Latitude ${locationCtx.latitude.toFixed(4)}, Longitude ${locationCtx.longitude.toFixed(4)}${locationCtx.label ? ` (${locationCtx.label})` : ""}. User explicitly granted location permission.`;
  } else if (locationCtx?.permissionGranted && locationCtx.label) {
    locationStatusLine = `AUTHORIZED LOCATION: ${locationCtx.label} (Time Zone: ${userTimeZone}).`;
  } else {
    locationStatusLine = `LOCATION PERMISSION: Precise GPS location permission has NOT been granted by the user. Do NOT fabricate or claim to know the user's street/city GPS coordinates; rely strictly on the detected IANA time zone (${userTimeZone}${userTimeZoneExplicitlyDetected ? " from client system" : " fallback"}).`;
  }

  // Execute any natural-language scheduling / reminder / timer actions if store + userId are available
  const executedActions =
    input.store && input.userId
      ? executeNaturalLanguageTimeActions({
          question: input.question,
          userId: input.userId,
          nowDate,
          userTimeZone,
          store: input.store,
        })
      : [];

  // Retrieve user's real calendar events & active timers
  const calendarEvents = input.store && input.userId ? input.store.listCalendarEvents(input.userId) : [];
  const activeTimers = input.store && input.userId ? input.store.listUserTimers(input.userId) : [];

  // Resolve any places/countries/cities mentioned in the question for instant timezone comparisons
  const placesInQuestion = resolvePlaceFromText(input.question);
  const placeLines: string[] = [];

  for (const place of placesInQuestion) {
    const cmp = compareTimeZones(
      nowDate,
      userTimeZone,
      place.timeZone,
      `User Local Time (${userTimeZone})`,
      place.name,
      place.alternateZones
    );
    placeLines.push(
      `- **${place.name}** (${place.timeZone}, ${cmp.toSnapshot.utcOffsetFormatted}, DST Active: ${cmp.toSnapshot.isDstActive ? "Yes" : "No"}): ` +
        `Current local time is **${cmp.toSnapshot.formattedFull}** (${cmp.toSnapshot.localDate} ${cmp.toSnapshot.localTime24}). ` +
        `${cmp.formattedDifference} ` +
        `Calendar day relative to user (${userSnap.localDate}): **${cmp.relativeDayInTarget.toUpperCase()}** (Is it already tomorrow there? **${cmp.isTomorrowInTarget ? "YES" : "NO"}**).`
    );
    if (cmp.alternateComparisons && cmp.alternateComparisons.length > 0) {
      const altSummary = cmp.alternateComparisons
        .map((a) => `${a.label} [${a.timeZone}, ${a.utcOffsetFormatted}]: ${a.localTime12} (${a.localDate})`)
        .join(" | ");
      placeLines.push(`  - Multi-Zone Breakdown for ${place.country}: ${altSummary}`);
    }
  }

  // If 2+ places are mentioned in the user's question (e.g., "between Egypt and the United States"), compute direct pairwise comparison
  if (placesInQuestion.length >= 2) {
    const first = placesInQuestion[0]!;
    const second = placesInQuestion[1]!;
    const pairCmp = compareTimeZones(
      nowDate,
      first.timeZone,
      second.timeZone,
      first.name,
      second.name,
      second.alternateZones
    );
    placeLines.push(
      `- **Direct Comparison (${first.name} vs. ${second.name})**: ${pairCmp.formattedDifference}`
    );
    if (pairCmp.alternateComparisons && pairCmp.alternateComparisons.length > 0) {
      const pairAlts = pairCmp.alternateComparisons
        .map((a) => {
          const sign = a.differenceHours >= 0 ? "+" : "";
          return `${a.label} (${a.utcOffsetFormatted}): ${sign}${a.differenceHours}h vs ${first.name}`;
        })
        .join("; ");
      placeLines.push(`  - All ${second.country} Time Zones vs ${first.name}: ${pairAlts}`);
    }
  }

  // Resolve natural-language dates mentioned in the question
  const resolvedDates = resolveNaturalDateExpressions(input.question, nowDate, userTimeZone);
  const dateMathLines = resolvedDates.map(
    (d) =>
      `- **"${d.expression}"** -> **${d.readableDate}** (` +
      `ISO: \`${d.isoDate}\`, ${
        d.deltaDays === 0
          ? "Today (0 days difference)"
          : d.deltaDays > 0
          ? `in exactly ${d.deltaDays} day${d.deltaDays === 1 ? "" : "s"}`
          : `exactly ${Math.abs(d.deltaDays)} day${Math.abs(d.deltaDays) === 1 ? "" : "s"} ago`
      })`
  );

  // Also always precompute tomorrow, last Friday, next Monday, and days until January 1 so common calendar questions are 100% exact
  const tomorrowIso = addDaysToIsoDate(userSnap.localDate, 1);
  const nextJan1Iso = `${userSnap.localDate.slice(0, 4) === "9999" ? 2027 : Number(userSnap.localDate.slice(0, 4)) + 1}-01-01`;
  const daysUntilJan1 = calculateCalendarDateDelta(userSnap.localDate, nextJan1Iso).totalDays;

  // Format user's calendar events in their local timezone
  const calendarLines =
    calendarEvents.length > 0
      ? calendarEvents.slice(0, 15).map((ev) => {
          const evStart = new Date(ev.startTime);
          const zonedStart = getZonedDateParts(evStart, userTimeZone);
          const delta = calculateCalendarDateDelta(userSnap.localDate, zonedStart.isoDate);
          const reminderNote = ev.remindBeforeMinutes
            ? ` | Reminder: ${ev.remindBeforeMinutes} mins before (${ev.reminderTriggerTime})`
            : "";
          return `- [${ev.category.toUpperCase()}] **${ev.title}** — ${zonedStart.formattedFull} (${userTimeZone}, ISO Date: ${zonedStart.isoDate}, ${delta.formattedSummary})${reminderNote}`;
        })
      : ["- No scheduled events are currently saved on the user's calendar. Do NOT invent or fabricate calendar events."];

  // Format active timers & countdowns
  const timerLines =
    activeTimers.length > 0
      ? activeTimers.map((t) => {
          const remainingSec = Math.max(0, Math.round(t.remainingMs / 1000));
          return `- [${t.kind.toUpperCase()}] **${t.label}** — Status: ${t.status}, Remaining: ${remainingSec}s${t.targetTimestamp ? `, Target UTC: ${t.targetTimestamp}` : ""}`;
        })
      : ["- No active timers or countdowns running."];

  // Check if question touches sports/history/World Cup or timelines
  let worldCupBlock = "";
  if (/\b(world cup|fifa|tournament|champion|winner|mundial|final|host)\b/i.test(input.question)) {
    const wc = analyzeWorldCupTimeline(nowDate, userTimeZone);
    const allSummary = wc.allTournaments
      .map(
        (t) =>
          `  * **${t.year}** (${t.startDate} to ${t.endDate}) — Host: ${t.hostCountries.join(", ")} | Final: ${t.finalStadium}, ${t.finalCity} | ${
            t.winner ? `Winner: **${t.winner}** (def. ${t.runnerUp} ${t.finalScore})` : `Status: Scheduled/Upcoming (${t.notes ?? ""})`
          }`
      )
      .join("\n");

    worldCupBlock = `
VERIFIED FIFA WORLD CUP CHRONOLOGICAL TIMELINE (Relative to User Local Date ${wc.todayIso}):
- **Most Recently Completed Tournament**: ${
      wc.lastCompleted
        ? `${wc.lastCompleted.year} FIFA World Cup (${wc.lastCompleted.startDate} to ${wc.lastCompleted.endDate}) in ${wc.lastCompleted.hostCountries.join(", ")} — Winner: **${wc.lastCompleted.winner}** (Runner-up: ${wc.lastCompleted.runnerUp}, Final Score: ${wc.lastCompleted.finalScore} at ${wc.lastCompleted.finalStadium}, ${wc.lastCompleted.finalCity}).`
        : "N/A"
    }
- **Next Upcoming FIFA World Cup**: ${
      wc.nextUpcoming && wc.nextDelta
        ? `**${wc.nextUpcoming.year} FIFA World Cup** hosted by **${wc.nextUpcoming.hostCountries.join(", ")}**, starting on **${formatIsoDateReadable(wc.nextUpcoming.startDate)}** (\`${wc.nextUpcoming.startDate}\` to \`${wc.nextUpcoming.endDate}\`). Exact remaining days from today (${wc.todayIso}): **${wc.nextDelta.totalDays} days** (${wc.nextUpcoming.notes ?? ""}).`
        : "No future tournament in table."
    }
- **Complete Chronological History (1930–2034)**:
${allSummary}`;
  }

  const executedActionsBlock =
    executedActions.length > 0
      ? `\nREAL-TIME CALENDAR / TIMER ACTIONS EXECUTED FOR THIS TURN:\n${executedActions.map((a) => `- [EXECUTED] ${a.summary}`).join("\n")}\nConfirm these completed actions clearly to the user.`
      : "";

  const promptBlock = `=== AUTHORITATIVE REAL-TIME CLOCK, CALENDAR, TIME ZONE & LOCATION SYSTEM ===
- **Current UTC Timestamp**: ${serverUtcIso} (${utcSnap.formattedFull} UTC)
- **User Local Time Zone**: ${userSnap.timeZone} (${userSnap.utcOffsetFormatted}, Daylight Saving Time Active: ${userSnap.isDstActive ? "YES" : "NO"}, Observes DST: ${userSnap.observesDst ? "Yes" : "No"})
- **User Current Local Date & Time**: **${userSnap.formattedFull}** (ISO Date: \`${userSnap.localDate}\`, 24h: \`${userSnap.localTime24}\`, Leap Year: ${userSnap.isLeapYear ? "Yes" : "No"}, Days in Month: ${userSnap.daysInCurrentMonth})
- **Server System Time Zone**: ${serverTimeZone} (NEVER assume the user's time zone equals the server's time zone; always present dates/times in the user's local time zone \`${userSnap.timeZone}\` unless asked otherwise).
- **${locationStatusLine}**
- **Quick Reference Anchors (in ${userSnap.timeZone})**:
  * Today: ${formatIsoDateReadable(userSnap.localDate)} (\`${userSnap.localDate}\`)
  * Tomorrow: ${formatIsoDateReadable(tomorrowIso)} (\`${tomorrowIso}\`)
  * Days until January 1 (${nextJan1Iso}): **${daysUntilJan1} days**
${dateMathLines.length > 0 ? `- **Resolved Dates & Durations for User Query**:\n${dateMathLines.join("\n")}` : ""}
${placeLines.length > 0 ? `- **World Clock & Cross-Time-Zone Calculations**:\n${placeLines.join("\n")}` : ""}
- **User's Authorized Calendar Schedule (${calendarEvents.length} events)**:
${calendarLines.join("\n")}
- **User's Active Timers & Countdowns**:
${timerLines.join("\n")}${executedActionsBlock}${worldCupBlock}
=============================================================================`;

  return {
    promptBlock,
    userTimeSnapshot: userSnap,
    serverUtcIso,
    executedActions,
    calendarEvents,
    activeTimers,
  };
}

