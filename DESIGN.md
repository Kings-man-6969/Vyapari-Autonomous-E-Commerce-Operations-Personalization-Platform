# Vyapari — Design System Specification
> Forged Titanium, Brushed Steel & Metallic Obsidian

**Theme:** Metallic Dark (Monochrome Titanium & Steel)

Vyapari's signature design language is rooted in industrial aerospace luxury: a deep obsidian graphite canvas layered with dark gunmetal, brushed titanium, and slate chrome surfaces. Hairline bevels with subtle chrome glints provide physical tactile depth without heavy drop shadows. High-contrast liquid platinum pill buttons serve as the primary interactive triggers, while icy steel highlights and brushed aluminum typography at whisper-light weights (330) with generous letter-spacing create calm, authoritative authority.

---

## Tokens — Colors (Metallic Grey & Steel Palette)

| Name | Hex Value | Token | Role |
|------|-----------|-------|------|
| **Obsidian Graphite** | `#090a0d` | `--color-obsidian-graphite` | Primary page canvas and deep hero background |
| **Dark Gunmetal** | `#12151b` | `--color-gunmetal-dark` | Base card and container surface |
| **Brushed Titanium** | `#181d26` | `--color-titanium-brushed` | Elevated card surface, modals, and nav background |
| **Slate Chrome** | `#222834` | `--color-slate-chrome` | Floating elements, dropdowns, and active card surfaces |
| **Alloy Glint** | `#2d3443` | `--color-alloy-glint` | Hover-state lift and micro-interaction highlight |
| **Hairline Steel** | `#282e3b` | `--color-border-steel` | Primary hairline border for cards and section dividers |
| **Chrome Inset** | `#3a4354` | `--color-border-chrome` | Inset bevel border for tactile glass-edge definition |
| **Liquid Platinum** | `#ffffff` | `--color-pure-white` | Primary CTA fill, headline contrast, active markers |
| **Brushed Aluminum** | `#e2e8f0` | `--color-brushed-aluminum` | Display typography, key metrics, and primary headings |
| **Steel Mist** | `#94a3b8` | `--color-steel-mist` | Secondary body text, link labels, and descriptions |
| **Slate Caption** | `#64748b` | `--color-slate-caption` | Helper text, metadata, disabled captions, timestamps |
| **Gunmetal Ash** | `#475569` | `--color-gunmetal-ash` | Deep muted text and icon outlines |
| **Icy Steel Pulse** | `#38bdf8` | `--color-icy-steel` | Real-time signal beacons, live telemetry pulses, active indicators |
| **Titanium Silver Glow** | `#cbd5e1` | `--color-silver-glow` | Semantic badges, high-confidence tags, metric callouts |

### Metallic Gradients & Shimmers

| Name | Definition | Token | Role |
|------|------------|-------|------|
| **Platinum Sheen** | `linear-gradient(135deg, #ffffff 0%, #cbd5e1 50%, #94a3b8 100%)` | `--gradient-platinum-sheen` | High-impact pill CTAs, brand logomark reflection |
| **Brushed Alloy Wash** | `linear-gradient(180deg, #181d26 0%, #12151b 100%)` | `--gradient-alloy-wash` | Elevated card backgrounds and panel headers |
| **Gunmetal Reflection** | `linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0) 100%)` | `--gradient-reflection` | Top-edge specular glint on cards and panels |
| **Titanium Glow** | `radial-gradient(circle at 50% 10%, rgba(203, 213, 225, 0.07) 0%, rgba(18, 21, 27, 0.3) 45%, transparent 75%)` | `--gradient-titanium-glow` | Hero ambient atmospheric lighting |

---

## Tokens — Typography

### Primary Font: Inter & System Font Stacks
- **Weights:**
  - Whisper Weight: `330` / `300` (Signature choice for display titles and hero headlines)
  - Regular: `400`
  - Medium: `500`
  - Semibold: `600`
- **Letter Spacing:**
  - Display & Headings: `0.02em` – `0.04em` (Relaxed, editorial luxury)
  - Uppercase Labels & Button Pills: `0.06em`

### Type Scale

| Role | Size | Line Height | Tracking | Token |
|------|------|-------------|----------|-------|
| caption | 12px | 1.5 | 0.06em | `--text-caption` |
| body-sm | 14px | 1.5 | 0.02em | `--text-body-sm` |
| body | 16px | 1.5 | 0.015em | `--text-body` |
| subheading | 20px | 1.4 | 0.02em | `--text-subheading` |
| heading-sm | 24px | 1.4 | 0.02em | `--text-heading-sm` |
| heading | 28px | 1.4 | 0.025em | `--text-heading` |
| heading-lg | 48px | 1.25 | 0.03em | `--text-heading-lg` |
| display | 64px | 1.14 | 0.035em | `--text-display` |

---

## Tokens — Components & Ergonomics

### Primary Action Button (Liquid Platinum Pill)
- **Background:** `#ffffff` (Solid Pure White or Platinum Sheen)
- **Text:** `#090a0d` (Deep Obsidian Graphite)
- **Border-radius:** `9999px` (Pill)
- **Padding:** `12px 26px`
- **Font:** Inter 550 weight, `0.05em` uppercase letter spacing
- **Shadow:** `0 4px 16px rgba(255, 255, 255, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.4)`
- **Hover:** Slight specular lift, `#f1f5f9` fill, `box-shadow: 0 6px 24px rgba(255, 255, 255, 0.2)`

### Ghost Outline Button (Brushed Steel Rim)
- **Background:** `transparent`
- **Border:** `1px solid rgba(226, 232, 240, 0.25)`
- **Text:** `#e2e8f0` (Brushed Aluminum)
- **Border-radius:** `9999px`
- **Padding:** `11px 24px`
- **Hover:** Background `rgba(255, 255, 255, 0.05)`, border `rgba(255, 255, 255, 0.5)`

### Small Rectangular Button (Compact Tactical Form/Table Action)
- **Background:** `#181d26` (Brushed Titanium)
- **Border:** `1px solid #282e3b`
- **Text:** `#ffffff`
- **Border-radius:** `4px`
- **Padding:** `8px 16px`

### Metallic Cards & Panels
- **Background:** `#12151b` (Dark Gunmetal) or `#181d26` (Brushed Titanium)
- **Border:** `1px solid #282e3b` (Hairline Steel)
- **Border-radius:** `12px`
- **Shadow:** `rgba(0, 0, 0, 0.4) 0px 8px 24px 0px, rgba(255, 255, 255, 0.03) 0px 1px 0px inset`
- **Hover:** Transform `translateY(-3px)`, border `#3a4354` with subtle silver luminescence

---

## Do's and Don'ts

### Do:
- Use whisper-weight (330) for large display headlines with wide letter tracking.
- Set primary CTAs to Pure White / Liquid Platinum pills (`#ffffff`) with deep obsidian text (`#090a0d`).
- Rely on layered metallic grey surfaces (`#090a0d` → `#12151b` → `#181d26` → `#222834`).
- Use Icy Steel (`#38bdf8`) or Silver Glow (`#cbd5e1`) strictly for telemetry dots, status beacons, and active pills.
- Apply 12px border-radius for cards and 9999px for pills and buttons.

### Don't:
- Never use bright oversaturated non-metallic colors as primary card fills.
- Never use pure stark flat black (`#000000`) without metallic undertones.
- Never use heavy clunky drop shadows — use hairline specular borders and subtle inset white bevel highlights (`rgba(255, 255, 255, 0.03)`).
