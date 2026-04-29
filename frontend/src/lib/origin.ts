export const COUNTRY_MAP: Record<string, { name: string; flag: string; color: string; bg: string }> = {
  US: { name: "USA",      flag: "\u{1F1FA}\u{1F1F8}", color: "#00F5FF", bg: "rgba(0,245,255,0.1)" },
  JP: { name: "Japan",    flag: "\u{1F1EF}\u{1F1F5}", color: "#FF4DE6", bg: "rgba(255,77,230,0.1)" },
  KR: { name: "Korea",    flag: "\u{1F1F0}\u{1F1F7}", color: "#6E8CFF", bg: "rgba(110,140,255,0.1)" },
  IN: { name: "India",    flag: "\u{1F1EE}\u{1F1F3}", color: "#FFB800", bg: "rgba(255,184,0,0.1)" },
  GB: { name: "UK",       flag: "\u{1F1EC}\u{1F1E7}", color: "#39FFEE", bg: "rgba(57,255,238,0.1)" },
  FR: { name: "France",   flag: "\u{1F1EB}\u{1F1F7}", color: "#E06CFF", bg: "rgba(224,108,255,0.1)" },
  DE: { name: "Germany",  flag: "\u{1F1E9}\u{1F1EA}", color: "#FF6B6B", bg: "rgba(255,107,107,0.1)" },
  ES: { name: "Spain",    flag: "\u{1F1EA}\u{1F1F8}", color: "#FF9F43", bg: "rgba(255,159,67,0.1)" },
  IT: { name: "Italy",    flag: "\u{1F1EE}\u{1F1F9}", color: "#4DFFB8", bg: "rgba(77,255,184,0.1)" },
  MX: { name: "Mexico",   flag: "\u{1F1F2}\u{1F1FD}", color: "#FFD93D", bg: "rgba(255,217,61,0.1)" },
  BR: { name: "Brazil",   flag: "\u{1F1E7}\u{1F1F7}", color: "#4DFF4D", bg: "rgba(77,255,77,0.1)" },
  CN: { name: "China",    flag: "\u{1F1E8}\u{1F1F3}", color: "#FF4D4D", bg: "rgba(255,77,77,0.1)" },
  TH: { name: "Thailand", flag: "\u{1F1F9}\u{1F1ED}", color: "#C084FC", bg: "rgba(192,132,252,0.1)" },
  TR: { name: "Turkey",   flag: "\u{1F1F9}\u{1F1F7}", color: "#FF6B8A", bg: "rgba(255,107,138,0.1)" },
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
