export const COUNTRY_MAP: Record<string, { name: string; flag: string; color: string; bg: string }> = {
  US: { name: "USA",      flag: "🇺🇸", color: "#FF006E", bg: "rgba(255,0,110,0.1)" },
  JP: { name: "Japan",    flag: "🇯🇵", color: "#5EFF8C", bg: "rgba(94,255,140,0.1)" },
  KR: { name: "Korea",    flag: "🇰🇷", color: "#5EFF8C", bg: "rgba(94,255,140,0.1)" },
  IN: { name: "India",    flag: "🇮🇳", color: "#FFEB3B", bg: "rgba(255,235,59,0.1)" },
  GB: { name: "UK",       flag: "🇬🇧", color: "#A1A1A1", bg: "rgba(161,161,161,0.1)" },
  FR: { name: "France",   flag: "🇫🇷", color: "#A1A1A1", bg: "rgba(161,161,161,0.1)" },
  DE: { name: "Germany",  flag: "🇩🇪", color: "#A1A1A1", bg: "rgba(161,161,161,0.1)" },
  ES: { name: "Spain",    flag: "🇪🇸", color: "#A1A1A1", bg: "rgba(161,161,161,0.1)" },
  IT: { name: "Italy",    flag: "🇮🇹", color: "#A1A1A1", bg: "rgba(161,161,161,0.1)" },
  MX: { name: "Mexico",   flag: "🇲🇽", color: "#A1A1A1", bg: "rgba(161,161,161,0.1)" },
  BR: { name: "Brazil",   flag: "🇧🇷", color: "#A1A1A1", bg: "rgba(161,161,161,0.1)" },
  CN: { name: "China",    flag: "🇨🇳", color: "#A1A1A1", bg: "rgba(161,161,161,0.1)" },
  TH: { name: "Thailand", flag: "🇹🇭", color: "#A1A1A1", bg: "rgba(161,161,161,0.1)" },
  TR: { name: "Turkey",   flag: "🇹🇷", color: "#A1A1A1", bg: "rgba(161,161,161,0.1)" },
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
