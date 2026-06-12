# Bug Hunter — Design Tokens Reference

Source of truth for all visual styling. Always import [`testsigma-tokens.css`](testsigma-tokens.css) as the first stylesheet and use the variables below — never hardcode colors, spacing, fonts, or radii.

---

## Design Personality

- **Dark-mode first** — deep purple backdrop, light text, high contrast
- **Arcade energy** — teal + pink accents pop against the dark surface
- **QA-flavored** — status colors (passed/failed/pending) map naturally to game states
- **Clean and legible** — Inter font, generous spacing, glass-effect panels for the HUD
- **TV-ready** — all sizing choices should remain legible from several feet away

---

## Game Element → Token Mapping

### Player & Movement
| Element | Token | Value |
|---|---|---|
| Player character | `--color-primary` | `#00B2BD` teal |
| Player hover / press | `--color-primary-hover` | `#00A0AA` |
| Covered path (eaten dot) | `--color-status-passed` | `#22C55E` green |
| Uncovered dot | `--color-text-muted` | `#94A3B8` |

### Bugs
| Element | Token | Value |
|---|---|---|
| Bug body | `--color-error` | `#EF4444` red |
| Bug caught / destroyed | `--color-status-passed` | `#22C55E` green flash |
| Bug warning (close proximity) | `--color-warning` | `#F59E0B` amber |

### Bombs
| Element | Token | Value |
|---|---|---|
| Bomb (placed, armed) | `--color-accent` | `#E58086` pink |
| Bomb pulse / live indicator | `--gradient-action` | pink → purple |
| Blast radius flash | `--color-secondary` | `#5C27F5` purple |

### HUD (Heads-Up Display)
| Element | Token | Value |
|---|---|---|
| HUD background | `--glass-bg` + `--glass-blur` | semi-transparent panel |
| HUD border | `--glass-border` | subtle dark border |
| Timer (normal) | `--color-text` | `#FFFFFF` |
| Timer (last 10s warning) | `--color-warning` | `#F59E0B` amber |
| Timer (last 5s danger) | `--color-error` | `#EF4444` red |
| Lives indicator | `--color-primary` | teal filled circles |
| Lives lost | `--color-text-dim` | `#64748B` grey circles |
| Bomb count | `--color-accent` | pink |

### Maze & Surfaces
| Element | Token | Value |
|---|---|---|
| Game backdrop | `--color-background` | `#1A0B2E` deep purple |
| Maze walls | `--color-surface` | `#2D1B4E` raised purple |
| Panel / card surfaces | `--color-surface-card` | `#1E293B` |
| Panel borders | `--color-border` | `#475569` |
| Background glow effect | `--gradient-glow` | radial purple + pink |

### Scoring & Leaderboard
| Element | Token | Value |
|---|---|---|
| Score number | `--gradient-action` | pink → purple gradient text |
| Score label | `--color-text-muted` | `#94A3B8` |
| Rank #1 | `--color-warning` | `#F59E0B` gold |
| Rank #2 / #3 | `--color-text-muted` | muted silver |
| Leaderboard surface | `--color-surface-card` + `--glass-bg` | glass card |
| "Passed" result | `--color-status-passed` | `#22C55E` |
| "Failed" result | `--color-status-failed` | `#EF4444` |

### Screens & Overlays
| Element | Token | Value |
|---|---|---|
| Landing / game-over title | `--font-size-display` + `--gradient-action` | 48px gradient text |
| Body text | `--font-size-base` + `--color-text` | 15px white |
| Muted / secondary text | `--color-text-muted` | `#94A3B8` |
| Primary CTA button | `--gradient-action` + `--radius-pill` | gradient pill |
| Disabled / limit-reached state | `--color-text-dim` | `#64748B` |
| Overlay backdrop | `rgba(26, 11, 46, 0.85)` | dark purple tint |

---

## Typography Rules

| Use | Family | Size | Weight |
|---|---|---|---|
| Game title / hero | Inter | `--font-size-display` (48px) | `--font-weight-bold` (700) |
| Section headings | Inter | `--font-size-heading` (32px) | `--font-weight-semibold` (600) |
| HUD values (score, timer) | Courier New mono | `--font-size-large` (20px) | `--font-weight-bold` (700) |
| Body / instructions | Inter | `--font-size-base` (15px) | `--font-weight-regular` (400) |
| Labels / eyebrows | Inter | `--font-size-small` (13px) | `--font-weight-medium` (500) + `--letter-spacing-eyebrow` |

---

## Spacing & Radius Defaults

- Default padding inside panels: `--space-4` (16px)
- Gap between HUD elements: `--space-3` (12px)
- Default border radius: `--radius-md` (8px)
- Buttons and pills: `--radius-pill` (999px)
- Cards / leaderboard rows: `--radius-lg` (12px)

---

## Shadows

| Use | Token |
|---|---|
| Leaderboard cards | `--shadow-pop` |
| Modal / game-over overlay | `--shadow-modal` |
| HUD panels | `--shadow-card` |
