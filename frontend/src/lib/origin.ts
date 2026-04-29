export const COUNTRY_MAP: Record<string, { name: string; flag: string; color: string; bg: string }> = {
  US: { name: "USA",      flag: "🇺🇸", color: "#A78BFA", bg: "rgba(138,77,255,0.1)" },
  JP: { name: "Japan",    flag: "🇯🇵", color: "#2EC7FF", bg: "rgba(46,199,255,0.1)" },
  KR: { name: "Korea",    flag: "🇰🇷", color: "#2EC7FF", bg: "rgba(46,199,255,0.1)" },
  IN: { name: "India",    flag: "🇮🇳", color: "#FCA5A5", bg: "rgba(230,57,70,0.1)" },
  GB: { name: "UK",       flag: "🇬🇧", color: "#94A3B8", bg: "rgba(148,163,184,0.1)" },
  FR: { name: "France",   flag: "🇫🇷", color: "#94A3B8", bg: "rgba(148,163,184,0.1)" },
  DE: { name: "Germany",  flag: "🇩🇪", color: "#94A3B8", bg: "rgba(148,163,184,0.1)" },
  ES: { name: "Spain",    flag: "🇪🇸", color: "#94A3B8", bg: "rgba(148,163,184,0.1)" },
  IT: { name: "Italy",    flag: "🇮🇹", color: "#94A3B8", bg: "rgba(148,163,184,0.1)" },
  MX: { name: "Mexico",   flag: "🇲🇽", color: "#94A3B8", bg: "rgba(148,163,184,0.1)" },
  BR: { name: "Brazil",   flag: "🇧🇷", color: "#94A3B8", bg: "rgba(148,163,184,0.1)" },
  CN: { name: "China",    flag: "🇨🇳", color: "#94A3B8", bg: "rgba(148,163,184,0.1)" },
  TH: { name: "Thailand", flag: "🇹🇭", color: "#94A3B8", bg: "rgba(148,163,184,0.1)" },
  TR: { name: "Turkey",   flag: "🇹🇷", color: "#94A3B8", bg: "rgba(148,163,184,0.1)" },
};

export const LANGUAGE_MAP: Record<string, string> = {
  en: "English", ja: "Japanese", ko: "Korean",
  hi: "Hindi",   fr: "French",   de: "German",
  es: "Spanish", it: "Italian",  pt: "Portuguese",
  zh: "Mandarin", th: "Thai",    tr: "Turkish",
};

const KIDS_RATINGS = ["G", "PG", "TV-Y", "TV-Y7", "TV-Y7-FV", "TV-G", "TV-PG"];

export function getCategoryLabel(
  originCountry: string,
  originalLanguage: string,
  genres: { name: string }[],
  contentRating?: string | null
): string {
  const codes = originCountry.split(",").map((s) => s.trim());
  const genreNames = genres.map((g) => g.name);
  if (codes.includes("US")) {
    const isKidsRating = contentRating ? KIDS_RATINGS.includes(contentRating) : false;
    if (isKidsRating || genreNames.includes("Family")) return "Kids";
    return "USA";
  }
  if (originalLanguage === "ja" && genreNames.includes("Animation")) return "Anime";
  if (codes.includes("KR")) return "Korean";
  if (codes.includes("IN")) return "Indian";
  if (genreNames.includes("Documentary")) return "Documentary";
  return "Foreign";
}
