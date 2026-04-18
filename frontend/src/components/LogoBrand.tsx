export default function LogoBrand() {
  return (
    <div className="flex items-center gap-2 select-none">
      {/* Play button — gradient fill, glow in dark mode */}
      <span
        style={{ fontSize: "20px", lineHeight: 1 }}
        className="bg-gradient-to-br from-[#2EC7FF] to-[#8A4DFF] bg-clip-text text-transparent
          [filter:drop-shadow(0_0_6px_rgba(46,199,255,0.4))]
          dark:[filter:drop-shadow(0_0_10px_rgba(0,224,255,0.8))_drop-shadow(0_0_20px_rgba(138,77,255,0.5))]
          dark:animate-[text-glow_2s_ease-in-out_infinite]"
        aria-hidden="true"
      >
        ▶
      </span>
      {/* Wordmark */}
      <span
        className="text-lg font-bold tracking-wide
          bg-gradient-to-r from-[#2EC7FF] to-[#8A4DFF] bg-clip-text text-transparent
          [filter:drop-shadow(0_0_4px_rgba(46,199,255,0.3))]
          dark:[filter:drop-shadow(0_0_8px_rgba(0,224,255,0.6))]"
      >
        MovieNexus
      </span>
    </div>
  );
}
