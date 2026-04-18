# MovieNexus Brand Theme Design Spec

> **For agentic workers:** Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this spec task-by-task.

**Goal:** Apply the Login X brand palette to MovieNexus — full dual dark/light mode with neon cyberpunk dark and clean Stripe-like light, matching the shared brand identity across both apps.

**Default mode:** Dark (media apps default to dark; user can toggle).

---

## Brand Palette

Shared tokens across both modes:

| Name | Hex | Role |
|---|---|---|
| Electric Purple | `#8A4DFF` | Primary accent — buttons, active states, stat values |
| Sky Blue | `#2EC7FF` | Logo gradient start, secondary glow |
| Neon Cyan | `#00E0FF` | Dark mode glow, hover borders |
| Soft Lavender | `#BFA4FF` | Light mode tints, genre pills |
| Deep Navy | `#0B0F2A` | Dark background, light mode text |

---

## Token Mapping

`tailwind.config.ts` defines `nexus.*` tokens as **light mode defaults**. Dark mode overrides are applied via `dark:` prefix classes in components.

| Token | Light value | Dark value |
|---|---|---|
| `nexus-bg` | `#FFFFFF` | `#0B0F2A` |
| `nexus-card` | `#F9F9FB` | `#121840` |
| `nexus-border` | `#E5E7EB` | `#1E2A5A` |
| `nexus-accent` | `#8A4DFF` | `#8A4DFF` |
| `nexus-accent-hover` | `#7A3DEF` | `#00E0FF` |
| `nexus-muted` | `#6B7280` | `#64748B` |
| `nexus-text` | `#0B0F2A` | `#FFFFFF` |
| `nexus-cyan` | `#2EC7FF` | `#00E0FF` |

---

## Architecture

### New dependencies
- `next-themes` — same library used by Login X. Provides `ThemeProvider` and `useTheme`.
- `lucide-react` — icon library for Moon/Sun toggle icons (not currently installed in MovieNexus).
- Install both: `npm install next-themes lucide-react`
- Config: `attribute="class"`, `defaultTheme="dark"`, `enableSystem={false}`.

### New files
| File | Purpose |
|---|---|
| `src/components/LogoBrand.tsx` | ▶ play button + "MovieNexus" wordmark — CSS gradient, transparent bg, glow in dark |
| `src/components/ThemeToggle.tsx` | Moon/Sun icon button using `useTheme` — `"use client"` |

### Modified files
| File | Changes |
|---|---|
| `frontend/package.json` | Add `next-themes` and `lucide-react` dependencies |
| `tailwind.config.ts` | Update `nexus.*` token values to brand palette (light defaults); add `nexus-cyan` token |
| `src/app/globals.css` | Update body background, scrollbar colors; add neon animation keyframes from Login X |
| `src/app/layout.tsx` | Wrap in `ThemeProvider`; add `dark` class to `<html>`; swap text logo for `LogoBrand`; add `ThemeToggle` to nav |
| `src/components/MediaCard.tsx` | Add `dark:` overrides for card bg, border, glow hover, title color |
| `src/components/SearchBar.tsx` | Add `dark:` overrides for input bg, border, text |
| `src/app/page.tsx` | Add `dark:` overrides for stat cards, genre pills, section titles |
| `src/app/movies/page.tsx` | Add `dark:` overrides for pagination buttons |
| `src/app/shows/page.tsx` | Add `dark:` overrides for pagination buttons |
| `src/app/search/page.tsx` | Add `dark:` overrides for result rows, media type badges |
| `src/app/movies/[nexusId]/page.tsx` | Add `dark:` overrides for detail items, genre pills, metadata row |
| `src/app/shows/[nexusId]/page.tsx` | Add `dark:` overrides for detail items, genre pills, metadata row |

---

## Component Specs

### LogoBrand (`src/components/LogoBrand.tsx`)
Pure CSS, transparent background — same technique as Login X's ♠ spade.

```tsx
export default function LogoBrand() {
  return (
    <div className="flex items-center gap-2 select-none">
      <span
        style={{ fontSize: "22px", lineHeight: 1 }}
        className="bg-gradient-to-br from-[#2EC7FF] to-[#8A4DFF] bg-clip-text text-transparent
          [filter:drop-shadow(0_0_6px_rgba(46,199,255,0.4))]
          dark:[filter:drop-shadow(0_0_10px_rgba(0,224,255,0.8))_drop-shadow(0_0_20px_rgba(138,77,255,0.5))]
          dark:animate-[text-glow_2s_ease-in-out_infinite]"
        aria-hidden="true"
      >
        ▶
      </span>
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
```

### ThemeToggle (`src/components/ThemeToggle.tsx`)
```tsx
"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-1.5 rounded-lg hover:bg-[#F3F0FF] dark:hover:bg-[#1E2A5A] transition-colors"
      aria-label="Toggle theme"
    >
      {theme === "dark"
        ? <Sun className="h-4 w-4 text-[#2EC7FF]" />
        : <Moon className="h-4 w-4 text-[#8A4DFF]" />}
    </button>
  );
}
```

### MediaCard hover treatment
- **Dark:** `dark:hover:border-[#00E0FF] dark:hover:shadow-[0_0_20px_rgba(0,224,255,0.35)]`
- **Light:** `hover:border-[#8A4DFF] hover:shadow-[0_4px_12px_rgba(138,77,255,0.15)]`
- Poster placeholder bg: `bg-[#F3F0FF] dark:bg-[#1E2A5A]`
- Genre pills: `bg-[#F3F0FF] text-[#8A4DFF] dark:bg-[#1E2A5A] dark:text-nexus-muted`

### Nav (`layout.tsx`)
- `border-b border-[#E5E7EB] dark:border-[#1E2A5A]`
- `bg-white/90 dark:bg-[#0B0F2A]/90 backdrop-blur-md`
- Nav links: `text-nexus-muted hover:text-nexus-text dark:hover:text-white`

### Stat cards (`page.tsx` — StatCard)
- `bg-[#F9F9FB] dark:bg-[#121840] border-[#E5E7EB] dark:border-[#1E2A5A]`
- Value: `text-nexus-accent` (same in both modes — `#8A4DFF`)

### Genre pills (home, detail pages)
- `border-[#E5E7EB] bg-[#F3F0FF] text-[#8A4DFF] dark:border-[#1E2A5A] dark:bg-[#121840] dark:text-nexus-muted`

### Pagination buttons (`movies/page.tsx`, `shows/page.tsx`)
- `border-[#E5E7EB] bg-[#F9F9FB] dark:border-[#1E2A5A] dark:bg-[#121840] hover:border-nexus-accent dark:hover:border-[#00E0FF]`

### Search results (`search/page.tsx`)
- Row: `border-[#E5E7EB] bg-white dark:border-[#1E2A5A] dark:bg-[#121840] hover:border-nexus-accent/50 dark:hover:border-[#00E0FF]/50`
- Movie badge: `bg-blue-500/20 text-blue-400` (unchanged — semantic color, not brand)
- TV badge: `bg-[#8A4DFF]/20 text-[#8A4DFF]` (align with brand)

### Detail pages (movie + show)
- `DetailItem`: `bg-[#F9F9FB] dark:bg-[#121840] border-[#E5E7EB] dark:border-[#1E2A5A]`
- Footer divider: `border-[#E5E7EB] dark:border-[#1E2A5A]`
- Content rating badge: `border-[#E5E7EB] dark:border-[#1E2A5A]`

---

## CSS Animations (`globals.css`)

Copy the `text-glow` keyframe from Login X's `neon-theme.css` — used by `LogoBrand` in dark mode:

```css
@keyframes text-glow {
  0%, 100% {
    filter: drop-shadow(0 0 10px rgba(0, 224, 255, 0.8)) drop-shadow(0 0 25px rgba(138, 77, 255, 0.5));
  }
  50% {
    filter: drop-shadow(0 0 18px rgba(0, 224, 255, 1)) drop-shadow(0 0 40px rgba(138, 77, 255, 0.8));
  }
}
```

Update scrollbar to match brand:
```css
::-webkit-scrollbar-thumb {
  background: #1E2A5A;
}
```

---

## `tailwind.config.ts` — Full Updated Token Block

```ts
colors: {
  nexus: {
    bg: "#FFFFFF",
    card: "#F9F9FB",
    border: "#E5E7EB",
    accent: "#8A4DFF",
    "accent-hover": "#7A3DEF",
    muted: "#6B7280",
    text: "#0B0F2A",
    cyan: "#2EC7FF",
  },
},
```

---

## `layout.tsx` — ThemeProvider Wrapper

```tsx
import { ThemeProvider } from "next-themes";

// In RootLayout:
<html lang="en" suppressHydrationWarning>
  <body className="min-h-screen bg-white dark:bg-[#0B0F2A] text-nexus-text dark:text-white">
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <nav ...>
        ...
        <ThemeToggle />
      </nav>
      <main ...>{children}</main>
    </ThemeProvider>
  </body>
</html>
```

---

## Out of Scope
- No changes to FastAPI backend
- No changes to Docker/deployment config
- No changes to `RatingBadge` color logic (green/yellow/red are semantic — correct to keep)
- No Tailwind v4 upgrade
