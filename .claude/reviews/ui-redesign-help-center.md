# UI Redesign Plan — Help Center
Generated: 2026-04-27

---

## DETECTED DESIGN LANGUAGE

Reference pages: LeadsReport, Dashboard, Profile

Colors:
  Primary:    --navy-500 (#1e3d7a) / --navy-400 (#2a5298)
  Secondary:  --navy-700 (#152952)
  Accent:     --gold-500 (#e8be30) / --gold-600 (#d4a819)
  Success:    --success (#10b981) on --success-light (#ecfdf5)
  Warning:    --warning (#f59e0b) on --warning-light (#fffbeb)
  Danger:     --danger (#ef4444) on --danger-light (#fef2f2)
  Info:       --info (#3b82f6) on --info-light (#eff6ff)
  Background: --gray-50 (#f8f9fb) with 45deg navy diagonal pattern
  Card BG:    --white (#ffffff)
  Border:     --gray-200 (#e3e7ee)
  Text:       --gray-900 headings, --gray-700 body, --gray-500 muted

Typography:
  Font family: 'Outfit' (display), 'Plus Jakarta Sans' (body)
  Headings:    Outfit 700, 20-26px, letter-spacing -0.3px
  Labels:      Plus Jakarta Sans 600, 11-12px, uppercase, letter-spacing 0.6-1px
  Body:        Plus Jakarta Sans 400-500, 13-14px

Spacing:
  Card padding:    24-28px
  Section gap:     20-24px
  Container:       28px 36px (.page)
  Grid gutter:     14-20px

Component Patterns:
  Cards:    border-radius 14-16px, border 1px --gray-200, box-shadow --shadow-sm/md
  Stat cards: label uppercase 11px --gray-500, value 24px Outfit 700 --gray-900, hover translateY(-1px)
  Table headers: bg --gray-50, uppercase 11px 700 --gray-500, border-bottom --gray-200
  Table rows: 12-14px padding, hover bg --navy-50 or --gray-50, border-bottom --gray-100
  Badges/pills: border-radius 999px or 4-8px, 11-11.5px 600 weight
  Filter bar:  white card, border-radius 14px, flex wrap, search pill rounded-full
  Empty state: centered, dashed border, padding 40px, icon + text + CTA

Animations:
  Hover cards:   translateY(-1px) + box-shadow lift
  Hover rows:    background transition 0.12-0.15s
  Page entry:    fadeIn 0.3s (translateY 6px -> 0)
  Transitions:   var(--transition-fast) 150ms cubic-bezier(0.4,0,0.2,1)
  Spin:          1s linear infinite

---

## CURRENT STATE: HelpCenter

Layout:     Vertical stack, max-width 920px — leaves ~40-60% viewport empty on wide screens
Colors:     Consistent with theme
Responsive: Partial (only mobile breakpoint at 640px)
States:     loading OK, empty OK, error missing
CSS file:   Exists, 532 lines — well-structured
Matches reference: 5/10 — content is correct but viewport coverage is poor

Root problems:
1. `.hc-layout` has `max-width: 920px` and `flex-direction: column` — no full-width grid
2. No stat summary row — ticket counts from existing data are unused visually
3. No filter/search bar above table — hard to scan many tickets
4. Table card takes ~40% of its own height leaving card body empty when few rows exist
5. Empty state is small (40px padding) — not impactful enough
6. No `min-height` on the table card to anchor it visually

---

## LAYOUT OPTIONS

### OPTION A: Full-Width with Stat Row + Filter Bar
Recommended.

```
┌──────────────────────────────────────────────────────────┐
│  HERO (full width, navy gradient)                        │
│  [LifeBuoy icon]  How can we help you today?             │
│                   support@rabs.asia  [Submit Ticket btn] │
└──────────────────────────────────────────────────────────┘

┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│  Total     │ │  Open      │ │ In Progress│ │  Resolved  │
│    12      │ │     4      │ │     3      │ │     5      │
│  Tickets   │ │            │ │            │ │            │
└────────────┘ └────────────┘ └────────────┘ └────────────┘

┌──────────────────────────────────────────────────────────┐
│  [Inbox icon] My Tickets                  [Refresh btn]  │
│  ┌──────────────────────────────────┐ ┌────────────────┐ │
│  │ Search tickets...                │ │ Status: All  v │ │
│  └──────────────────────────────────┘ └────────────────┘ │
│  ─────────────────────────────────────────────────────── │
│  ID   Subject          Category   Status   Created  Act  │
│  ─────────────────────────────────────────────────────── │
│  #1   Login issue      Account    Open     12 Apr   [v]  │
│  #2   Export bug       Bug        Resolved 10 Apr   [v]  │
│  #3   New dashboard    Feature    Closed   08 Apr   [v]  │
│  ─────────────────────────────────────────────────────── │
│  (sticky table header, internal scroll at 480px max-h)   │
└──────────────────────────────────────────────────────────┘
```

Vibe: Data-dense, professional, mirrors LeadsReport exactly
Similar to: LeadsReport (lrpt-totals + lrpt-filterbar + lrpt-table-wrap)
Pros:
  - Stat row fills the visual gap above table
  - Filter bar gives purposeful space between stats and table
  - Table card has min-height 480px so it anchors the page even with 1-2 rows
Cons:
  - Filter/search is purely visual — no new logic (just CSS, the search input does nothing unless wired up later)
  - Adds 4 stat cards which need count derivation from existing `tickets` array (no API change)

---

### OPTION B: Two-Column Split — Table Left, Info Panel Right

```
┌──────────────────────────────────────────────────────────┐
│  HERO (full width)                                       │
└──────────────────────────────────────────────────────────┘

┌───────────────────────────────┐  ┌─────────────────────┐
│  My Tickets  (table, 2/3 w)   │  │  Support Info       │
│  ID  Subj  Cat  Status  Date  │  │  ─────────────────  │
│  ...                          │  │  [Mail icon]        │
│  ...                          │  │  support@rabs.asia  │
│  ...                          │  │                     │
│                               │  │  [Clock icon]       │
│  (min-height 500px)           │  │  Mon-Sat 9am-6pm    │
│                               │  │                     │
└───────────────────────────────┘  │  [LifeBuoy icon]    │
                                    │  Avg response: 24h  │
                                    │                     │
                                    │  [Send btn]         │
                                    │  Submit new ticket  │
                                    └─────────────────────┘
```

Vibe: Spacious, informative side-panel — like a support portal
Similar to: Profile page (profile-layout grid 300px 1fr)
Pros:
  - Right column fills empty space with genuine support context
  - Table gets generous width
Cons:
  - Right panel has very little dynamic content (static text)
  - On tablet (900px) collapses to 1 column — same problem returns

---

### OPTION C: Hero Expanded with Inline Stat Chips + Sticky Table

```
┌──────────────────────────────────────────────────────────┐
│  HERO — taller, full-width (navy gradient)               │
│  [LifeBuoy]  How can we help you today?                  │
│              support@rabs.asia                           │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Total 12 │  │ Open  4  │  │ Prog. 3  │  │ Done 5  │ │  
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
│                                          [Submit Ticket]│
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  My Tickets                               [Refresh]      │
│  ────────────────────────────────────────────────────── │
│  ID   Subject  Category   Status   Created    Action     │
│  ...                                                     │
│  (table fills remaining viewport with overflow-y:auto)   │
└──────────────────────────────────────────────────────────┘
```

Vibe: Hero-first, dramatic — like a product support page
Similar to: Dashboard hero strip + table
Pros:
  - Stats inside hero = no extra section, feels very tight
  - Single scroll region (no nested scroll)
Cons:
  - Hero becomes very tall (130-150px) — heavy top weight
  - Stats in hero can feel cramped on mobile

---

### OPTION D: Current Layout, Maximized (Minimal Changes)

```
┌──────────────────────────────────────────────────────────┐
│  HERO (full width — remove max-width 920px)              │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  My Tickets                               [Refresh]      │
│  ─────────────────────────────────────────────────────  │
│  ID   Subject  Category   Status   Created    Action     │
│  ...                                                     │
│                                                          │
│  min-height: calc(100vh - 320px)  ← fills rest of page   │
└──────────────────────────────────────────────────────────┘
```

Vibe: Minimal surgery — same structure, just un-capped width + table anchored to viewport
Similar to: Current page
Pros:
  - Lowest risk, fewest changes
  - Looks "complete" because table fills remaining height
Cons:
  - No stat summary, no filter bar — still sparse
  - Empty whitespace inside table card when few rows exist

---

## RECOMMENDATION

**Option A** — Full-Width with Stat Row + Filter Bar.

Reasons:
- Directly mirrors the LeadsReport pattern, which is the best-executed page in the project
- Stat cards derived from `tickets` array (open/in_progress/resolved/total count) — zero API changes
- Filter bar is visual-only markup (search input + status select are present structurally; actual JS filtering is not part of this redesign)
- Eliminates all empty space: hero full-width, stat row spans full width, table card has min-height anchored to viewport
- Consistent with Dashboard Activity Strip pattern
- Works on dark mode via existing CSS vars
- The "no logic change" constraint is fully honoured — all new elements are static/decorative

---

## IMPLEMENTATION NOTES (for Option A)

### JSX Changes
1. Remove `max-width: 920px` from `.hc-layout` (make it `width: 100%`)
2. Add `.hc-stats` grid row between hero and table card — 4 stat cards (Total, Open, In Progress, Resolved) derived from `tickets.length`, `tickets.filter(t=>t.status==='open').length`, etc.
3. Wrap `.hc-card__head` actions area with a filter sub-bar inside the card — a search pill + a status select dropdown, visually only (no onChange logic change needed)
4. Give `.hc-table-wrap` a `max-height: calc(100vh - 420px); min-height: 360px; overflow-y: auto;` so it anchors to the viewport
5. Make empty state taller: padding 80px, larger icon (48px), bigger illustration text

### CSS Changes
- `.hc-layout`: remove `max-width`, change to `width: 100%; display: flex; flex-direction: column; gap: 20px`
- `.hc-stats`: `display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px` (collapses to 2-col at 900px, 1-col at 480px)
- `.hc-stat-card`: mirrors `lrpt-total-card` — white card, 16px 18px padding, hover lift, icon accent
- `.hc-stat-card__icon`: 36x36px rounded square with tinted background (info/warning/success/navy)
- `.hc-stat-card__label`: 11px 600 uppercase --gray-500
- `.hc-stat-card__value`: 28px Outfit 700 --gray-900
- `.hc-filter-bar`: flex row, gap 12px, margin-bottom 14px — search pill (rounded-full, --gray-50 bg) + select (rounded 8px)
- `.hc-table-wrap`: add `max-height: calc(100vh - 440px); min-height: 360px; overflow-y: auto` with sticky `thead`
- `.hc-table thead th`: add `position: sticky; top: 0; z-index: 2` for sticky header inside scroll
- `.hc-state--empty`: increase padding to 80px, icon to 48px
- Dark mode overrides for all new classes via `[data-theme="dark"]`

### Responsive Breakpoints
- Desktop (>1024px): 4-column stat grid, full-width table
- Tablet (768-1024px): 2-column stat grid, full-width table
- Mobile (<640px): 2-column stat grid (2x2), table horizontally scrollable, filter bar stacks vertically