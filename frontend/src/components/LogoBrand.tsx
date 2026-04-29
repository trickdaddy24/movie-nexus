import React from 'react';

const flowingGradient: React.CSSProperties = {
  backgroundImage: 'linear-gradient(90deg, #FF006E, #FFE600, #3BFF6B, #FF3399, #FFEB3B, #5EFF8C, #FF006E)',
  backgroundSize: '600% 100%',
  animation: 'gradient-flow 38s linear infinite',
};

export default function LogoBrand() {
  return (
    <div className="flex items-center gap-2 select-none">
      {/* Play button — flowing gradient, glow in dark mode */}
      <span
        style={{ fontSize: '20px', lineHeight: 1, ...flowingGradient }}
        className="bg-clip-text text-transparent
          [filter:drop-shadow(0_0_6px_rgba(255,0,110,0.4))]
          dark:[filter:drop-shadow(0_0_10px_rgba(255,51,153,0.8))_drop-shadow(0_0_20px_rgba(255,235,59,0.5))]"
        aria-hidden="true"
      >
        ▶
      </span>
      {/* Wordmark */}
      <span
        style={flowingGradient}
        className="text-lg font-bold tracking-wide bg-clip-text text-transparent
          [filter:drop-shadow(0_0_4px_rgba(255,0,110,0.3))]
          dark:[filter:drop-shadow(0_0_8px_rgba(255,51,153,0.6))]"
      >
        MovieNexus
      </span>
    </div>
  );
}
