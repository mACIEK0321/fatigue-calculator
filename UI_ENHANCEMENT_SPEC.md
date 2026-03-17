# UI Enhancement Spec — FatigueMaster Pro

## 1) Professional Color Palette

- **Primary background:** `#0f172a` (deep slate for low-glare engineering sessions).
- **Secondary surface:** `#111827` and `#1e293b` (layered card hierarchy).
- **Primary accent:** `#22d3ee` (interactive highlights, active states, chart focal points).
- **Secondary accent:** `#38bdf8` (links, supportive graph elements).
- **Warning / critical:** `#f59e0b` and `#ef4444` (hotspots, life-critical alerts).
- **Success / stable:** `#10b981` (safe zone and converged states).
- **Text system:**
  - Main text: `#e2e8f0`
  - Secondary text: `#94a3b8`
  - Muted captions: `#64748b`

## 2) Typography for Scientific Readability

- **Primary UI font:** Inter or Geist Sans for modern readability in dense dashboards.
- **Monospace for equations/data:** JetBrains Mono for S-N values, cycles, and model constants.
- **Scale recommendations:**
  - H1: 28–32 px, semibold
  - H2: 20–24 px, semibold
  - Body: 14–16 px, regular
  - Table numeric cells: 13–14 px, medium weight, tabular lining where possible
- **Spacing rules:** minimum 1.5 line-height for explanatory text and 8px rhythm increments for technical panels.

## 3) Micro-Interaction Suggestions

- **Chart point insertion:** brief cyan glow pulse (`200–300ms`) and subtle ring expansion to confirm data update.
- **Pipeline transitions:** each step card animates in sequence with 60ms stagger, reinforcing process flow.
- **Critical hotspot hover:** local bloom + tooltip with stress/life metadata and confidence score.
- **Tab switching:** smooth opacity/translate transition (`150–200ms`) to preserve context while avoiding visual fatigue.
- **Slider feedback:** live value badge with spring easing and color interpolation toward warning colors under extreme loads.
- **Button interaction:** soft inner highlight on hover; stronger cyan outline on keyboard focus for accessibility.

## 4) Perceived Quality Guidelines

- Keep computational outputs visually deterministic: identical inputs should produce stable, identical visual states.
- Favor restrained, high-signal motion over decorative animation.
- Ensure every visual element teaches engineering meaning (units, regime labels, safety margin language).
- Maintain strict separation from solver logic; enhancements are presentation-layer only.
