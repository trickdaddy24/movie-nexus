export default function RatingBadge({ rating, label }: { rating: number | null; label?: string }) {
  if (rating === null || rating === undefined) return null;

  const color =
    rating >= 7.5
      ? "bg-green-500/20 text-green-400"
      : rating >= 5
        ? "bg-yellow-500/20 text-yellow-400"
        : "bg-red-500/20 text-red-400";

  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${color}`}>
      {label && <span className="opacity-70">{label}</span>}
      {rating.toFixed(1)}
    </span>
  );
}
