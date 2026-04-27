# UI Redesign Plan — Integration Page (Option A: Portal Catalog)

**Target files:**
- `Frontend/src/pages/Integration/Integration.js`
- `Frontend/src/pages/Integration/Integration.css`

---

## DESIGN TOKENS (from detected design language)

```
Colors:
  Primary:    var(--navy-700) / var(--navy-400)
  Accent:     var(--gold-500) / var(--gold-600)
  Success:    #22c55e  (connected state)
  Danger:     var(--danger) = #ef4444
  Info:       var(--info) = #3b82f6
  Background: var(--gray-50)
  Card BG:    var(--white)
  Border:     var(--gray-200)  /  hover: var(--gray-300)
  Text-H:     var(--gray-800) / var(--gray-900)
  Text-Body:  var(--gray-600) / var(--gray-500)

Typography:
  Font display: 'Outfit' — var(--font-display)
  Font body:    'Plus Jakarta Sans' — var(--font-body)
  Stat values:  font-display, 700, 22-24px
  Section title: font-body, 700, 15px, color gray-800
  Labels:       font-body, 600, 11-12px, gray-500/600
  Body text:    font-body, 400/500, 13-14px

Spacing (8px grid):
  Card padding:    20px 24px (from settings-card pattern)
  Section gap:     24px margin-bottom
  Grid gap:        14px (stat cards), 12-14px (source grid)
  Icon boxes:      36-44px square, radius-sm (8px)
  Container:       .page wrapper (inherits from App.css)

Shadows:
  Card resting:  0 1px 2px rgba(15,23,42,0.04)  [settings-card pattern]
  Card hover:    var(--shadow-md) = 0 2px 8px rgba(10,22,40,0.06)
  Modal:         0 20px 60px rgba(0,0,0,0.15)  [current, keep]

Radius:
  --radius-sm: 8px   (icon boxes, badges)
  --radius-md: 12px  (cards, inputs, section containers)
  --radius-lg: 16px  (modals, settings-card)

Animations:
  .animate-fade-in: fadeIn 0.35s ease-out  (page sections)
  .animate-scale-in: scaleIn 0.25s ease-out  (modals — already used)
  Hover transitions: var(--transition-fast) = 150ms cubic-bezier(0.4,0,0.2,1)
  Spin: spin 1s linear infinite (loading — already used)
```

---

## SUGGESTIONS

### #1 — Page wrapper: add animate-fade-in + consistent `.page` padding

**Current:** `<div>` root with no animation; `.page` class does padding from App.css. Stats row has no entrance animation.

**Suggested:** Wrap the inner page content (the div containing stats + sections) with `class="animate-fade-in"` so the whole page fades up on mount, consistent with Settings and other pages.

**CSS changes:** No new CSS needed — `.animate-fade-in` already exists in `theme.css` (line 289).

**JSX change:** Add `className="animate-fade-in"` to the `<div className="page">` element (Integration.js line 194).

**Reference:** `Frontend/src/pages/Settings/Settings.js` — uses `.animate-fade-in` on page wrapper.

**Logic impact:** NONE

---

### #2 — Stat cards: elevate to `.stat-card` pattern with `box-shadow` and `border-radius: var(--radius-lg)`

**Current:** `.intg-stat-card` uses `border-radius: var(--radius-md)` (12px), no `box-shadow`, no `transform` on hover. Feels flat compared to Dashboard stat cards.

**Suggested:** Match the `stat-card` pattern from `Common.css` (line 119): add `box-shadow: 0 1px 2px rgba(15,23,42,0.04)` at rest, `var(--shadow-md)` + `transform: translateY(-1px)` on hover. Bump radius to `var(--radius-lg)` (16px). Add `font-family: var(--font-display)` to `.intg-stat-card__val`.

**CSS changes:**
```css
.intg-stat-card {
  border-radius: var(--radius-lg);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: all var(--transition-fast);
}
.intg-stat-card:hover {
  border-color: var(--gray-300);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}
.intg-stat-card__val {
  font-family: var(--font-display);
}
```

**Reference:** `Frontend/src/components/common/Common.css` lines 119–131 (`.stat-card`).

**Logic impact:** NONE

---

### #3 — Section titles: uppercase micro-label style matching Settings pattern

**Current:** `.intg-section__title` is 15px, font-weight 700, with an inline icon. Looks generic.

**Suggested:** Adopt the Settings pattern for section headers: 11px, 700 weight, `text-transform: uppercase`, `letter-spacing: 1.2px`, `color: var(--gray-500)`. Wrap the section title text in a `<span>` and keep the icon but reduce it to `var(--gray-400)`. This creates a clean catalog-style separation between sections.

**CSS changes:**
```css
.intg-section__title {
  font-size: 11px;
  font-weight: 700;
  color: var(--gray-500);
  text-transform: uppercase;
  letter-spacing: 1.2px;
}
.intg-section__title svg {
  color: var(--gray-400);
  width: 13px;
  height: 13px;
}
```

**Reference:** `Frontend/src/pages/Settings/Settings.css` lines 16–22 (`.settings-section-title`).

**Logic impact:** NONE

---

### #4 — Active connection cards: add `border-radius: var(--radius-lg)`, left-accent border, and `box-shadow`

**Current:** `.intg-card` uses `border-radius: var(--radius-md)` (12px), `border: 1px solid var(--gray-200)`, no shadow at rest, hover adds a faint navy border + shadow.

**Suggested:** Round to `var(--radius-lg)` (16px). Add `box-shadow: 0 1px 2px rgba(15,23,42,0.04)` at rest. On hover, use `box-shadow: var(--shadow-md)` + `transform: translateY(-1px)` for the lift effect. Add a `3px solid` left-accent border using the integration's brand color — this already exists on stat cards and gives visual identity to each connected portal.

**CSS changes:**
```css
.intg-card {
  border-radius: var(--radius-lg);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: all var(--transition-fast);
}
.intg-card:hover {
  border-color: var(--gray-200);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}
```

For the colored left border: add a new class `.intg-card--colored` applied via JSX using `style={{ borderLeftColor: intg.color }}` plus:
```css
.intg-card--colored {
  border-left-width: 3px;
}
```
(The `borderLeftColor` is already an inline style on `intg-stat-card--gold` pattern — same approach.)

**Reference:** `Frontend/src/pages/Integration/Integration.css` lines 11–13 (`.intg-stat-card--gold` left-border pattern). `Common.css` lines 128–131 (`.stat-card:hover`).

**Logic impact:** NONE — only adding a new CSS class and one style attribute with the existing `intg.color` value already in scope.

---

### #5 — Active connection cards: `.intg-card__badge` — replace green text with a proper pill badge

**Current:** `.intg-card__badge` is just `color: #22c55e` inline text with a CheckCircle icon. No background, no pill shape.

**Suggested:** Give it `background: var(--success-light)`, `color: #059669`, `padding: 3px 10px`, `border-radius: var(--radius-full)`, making it a proper success pill badge. Matches the `.badge--success` pattern from `Common.css`.

**CSS changes:**
```css
.intg-card__badge {
  background: var(--success-light);
  color: #059669;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
```

**Reference:** `Frontend/src/components/common/Common.css` lines 95–100 (`.badge--success`).

**Logic impact:** NONE

---

### #6 — Available integrations grid: upgrade `.intg-source` card to taller, richer card layout

**Current:** `.intg-source` is a horizontal flex row, 14px 16px padding, feels dense and list-like for a "catalog" layout. The "Portal Catalog" option implies distinct card tiles, not a compact row.

**Suggested:** Increase padding to `16px 20px`. Add `box-shadow: 0 1px 2px rgba(15,23,42,0.04)` at rest. On hover add `transform: translateY(-1px)` + `box-shadow: var(--shadow-md)` + change border to `var(--navy-200)` for a more deliberate hover state. Bump icon box to 44px (from 40px) with `border-radius: var(--radius-md)` to match connected cards.

**CSS changes:**
```css
.intg-source {
  padding: 16px 20px;
  border-radius: var(--radius-lg);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: all var(--transition-fast);
}
.intg-source:hover {
  border-color: var(--navy-200);
  background: var(--white);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}
.intg-source__icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
}
```

**Reference:** `Frontend/src/components/common/Common.css` line 128–131 (`.stat-card:hover` lift).

**Logic impact:** NONE

---

### #7 — "Connect" button on source cards: replace solid color with outline + icon pattern

**Current:** `.intg-source__btn` uses `backgroundColor: source.color` as an inline style — each button is a different color based on the portal brand. Looks inconsistent and clashes with the muted palette.

**Suggested:** Replace with a consistent outline button: `border: 1.5px solid var(--navy-300)`, `color: var(--navy-600)`, `background: var(--white)`, hover to `background: var(--navy-50)`. This follows the `.btn--outline` pattern from `Common.css`. The brand color is already conveyed by the icon — the button doesn't need to repeat it.

**CSS changes:**
```css
.intg-source__btn {
  border: 1.5px solid var(--gray-300);
  background: var(--white);
  color: var(--gray-700);
  padding: 7px 16px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: var(--font-body);
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.intg-source__btn:hover {
  border-color: var(--navy-300);
  color: var(--navy-600);
  background: var(--navy-50);
}
```

Remove `style={{ backgroundColor: source.color }}` from the JSX button element (Integration.js line 299). The inline style is only used for color — removing it doesn't touch any handler or logic.

**Reference:** `Frontend/src/components/common/Common.css` lines 44–53 (`.btn--outline`).

**Logic impact:** NONE — removing only the `backgroundColor` style prop from a presentational button.

---

### #8 — Search bar: match Settings input style with `border-radius: 10px` and `border: 1.5px`

**Current:** `.intg-search` uses `border-radius: var(--radius-md)` (12px), `border: 1px solid var(--gray-200)`. Input height is a bit short.

**Suggested:** Match the `.settings-input` pattern: `border-radius: 10px`, `border: 1.5px solid var(--gray-200)`, `background: var(--gray-50)`. On focus-within: `border-color: var(--navy-400)` + `box-shadow: 0 0 0 3px rgba(42,82,152,0.06)`.

**CSS changes:**
```css
.intg-search {
  border-radius: 10px;
  border: 1.5px solid var(--gray-200);
  background: var(--gray-50);
  padding: 9px 14px;
  transition: all var(--transition-fast);
}
.intg-search:focus-within {
  border-color: var(--navy-400);
  background: var(--white);
  box-shadow: 0 0 0 3px rgba(42, 82, 152, 0.06);
}
```

**Reference:** `Frontend/src/pages/Settings/Settings.css` lines 154–171 (`.settings-input`, `.settings-input:focus`).

**Logic impact:** NONE

---

### #9 — Loading state: centered spinner with fade-in and proper typography

**Current:** Loading state uses `style={{ textAlign: 'center', padding: '40px' }}` inline — an inline style on the section div, and `<p style={{ marginTop: 12 }}>` inline on the paragraph. This is inconsistent with the project pattern.

**Suggested:** Replace inline styles with CSS class `.intg-loading` that matches the `.settings-loading` pattern from Settings.css. Add the `.animate-fade-in` class for entrance.

**CSS changes:**
```css
.intg-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 64px 20px;
  color: var(--gray-500);
  font-size: 13px;
  font-family: var(--font-body);
}
.intg-spin {
  animation: spin 0.9s linear infinite;
  color: var(--gray-400);
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

**JSX change:** Replace `<div className="intg-section" style={{ textAlign: 'center', padding: '40px' }}>` with `<div className="intg-loading animate-fade-in">` and remove the `<p style={{ marginTop: 12 }}>` inline style.

**Reference:** `Frontend/src/pages/Settings/Settings.css` lines 127–132 (`.settings-loading`).

**Logic impact:** NONE

---

### #10 — Empty state (no search results): richer empty state with dashed border container

**Current:** `.intg-empty` is a bare `grid-column: 1/-1`, centered icon + text, `color: var(--gray-400)`. No container, no dashed border, feels incomplete.

**Suggested:** Wrap in a dashed-border container matching the `.settings-empty` pattern: `background: var(--gray-50)`, `border: 1px dashed var(--gray-200)`, `border-radius: var(--radius-md)`, padding `48px`. Add a clear "no results" heading in `var(--gray-600)` and a muted sub-label.

**CSS changes:**
```css
.intg-empty {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 56px 24px;
  background: var(--gray-50);
  border: 1px dashed var(--gray-200);
  border-radius: var(--radius-md);
  color: var(--gray-400);
}
.intg-empty p {
  margin: 0;
  font-size: 13px;
  color: var(--gray-500);
  font-weight: 500;
}
```

**Reference:** `Frontend/src/pages/Settings/Settings.css` lines 133–141 (`.settings-empty`).

**Logic impact:** NONE

---

### #11 — Connect Form Modal: upgrade field inputs to Settings input style

**Current:** `.intg-form__input-wrap` uses `border-radius: 8px`, `border: 1px solid var(--gray-300)`. Background is `var(--white)` — no visual separation from the modal background.

**Suggested:** Match `.settings-input`: `border-radius: 10px`, `border: 1.5px solid var(--gray-200)`, `background: var(--gray-50)`. On `focus-within`: `border-color: var(--navy-400)` + ring shadow `0 0 0 3px rgba(42,82,152,0.06)`.

**CSS changes:**
```css
.intg-form__input-wrap {
  border-radius: 10px;
  border: 1.5px solid var(--gray-200);
  background: var(--gray-50);
}
.intg-form__input-wrap:focus-within {
  border-color: var(--navy-400);
  background: var(--white);
  box-shadow: 0 0 0 3px rgba(42, 82, 152, 0.06);
}
.intg-form__input {
  background: transparent;
}
```

**Reference:** `Frontend/src/pages/Settings/Settings.css` lines 153–172 (`.settings-input`).

**Logic impact:** NONE

---

### #12 — Connect Form Modal: replace solid color submit button with navy primary button

**Current:** `.intg-form__submit` uses `backgroundColor: source.color` as inline style — portal brand color applied to the submit CTA. Same problem as suggestion #7.

**Suggested:** Replace with `background: var(--navy-700)`, `color: var(--white)`. On hover: `background: var(--navy-600)` + `transform: translateY(-1px)` + `box-shadow: var(--shadow-md)`. Remove `style={{ backgroundColor: source.color }}` inline style from the JSX button (Integration.js line 426).

**CSS changes:**
```css
.intg-form__submit {
  background: var(--navy-700);
  color: var(--white);
  transition: all var(--transition-fast);
}
.intg-form__submit:hover:not(:disabled) {
  background: var(--navy-600);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}
.intg-form__submit:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
}
```

**Reference:** `Frontend/src/components/common/Common.css` lines 27–37 (`.btn--primary`).

**Logic impact:** NONE — removing only the `backgroundColor` style prop.

---

### #13 — Details Modal: status banner — upgrade from hardcoded `#f0fdf4` to `var(--success-light)`

**Current:** `.intg-det__status` uses hardcoded `background: #f0fdf4; color: #22c55e`. This won't adapt to dark mode (dark theme remaps semantic vars but not hardcoded hex).

**Suggested:** Replace with `background: var(--success-light)`, `color: var(--success)`. Consistent with all badge/status patterns in the project.

**CSS changes:**
```css
.intg-det__status {
  background: var(--success-light);
  color: var(--success);
}
```

**Reference:** `Frontend/src/components/common/Common.css` line 97–100 (`.badge--success`). `theme.css` line 27 (`--success-light: #ecfdf5`).

**Logic impact:** NONE

---

### #14 — Details Modal: config rows — add monospace code-chip styling for values

**Current:** `.intg-det__cfg-val` uses `font-family: monospace`. It sits inline with no visual separation from the key.

**Suggested:** Wrap values in a subtle chip background matching the Settings modal code hint pattern: `background: var(--gray-100)`, `color: var(--navy-500)`, `padding: 2px 8px`, `border-radius: 4px`, `font-size: 12px`. For masked values (`••••••••`) use `letter-spacing: 0.15em`.

**CSS changes:**
```css
.intg-det__cfg-val {
  background: var(--gray-100);
  color: var(--navy-500);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-family: 'Courier New', monospace;
  letter-spacing: 0.03em;
}
```

**Reference:** `Frontend/src/pages/Settings/Settings.css` lines 221–231 (`.settings-modal__hint code`).

**Logic impact:** NONE

---

### #15 — Responsive: stat cards stack on mobile, source grid goes single column

**Current:** `.intg-stats` uses `display: flex; gap: 14px` — collapses badly on small screens with no breakpoint. `.intg-sources` and `.intg-connected` use `auto-fill, minmax()` which partially handles it, but stat cards have no mobile treatment.

**Suggested:** Add media query breakpoints.

**CSS changes:**
```css
/* Tablet */
@media (max-width: 900px) {
  .intg-sources {
    grid-template-columns: 1fr;
  }
  .intg-connected {
    grid-template-columns: 1fr;
  }
}

/* Mobile */
@media (max-width: 640px) {
  .intg-stats {
    flex-direction: column;
    gap: 10px;
  }
  .intg-stat-card {
    padding: 14px 16px;
  }
  .intg-source {
    flex-wrap: wrap;
  }
  .intg-source__btn,
  .intg-source__soon {
    margin-left: auto;
  }
  .intg-form-modal,
  .intg-det-modal {
    width: 95vw;
    max-height: 92vh;
  }
  .intg-filters {
    flex-direction: column;
    align-items: stretch;
  }
  .intg-search {
    max-width: 100%;
  }
}
```

**Reference:** `Frontend/src/pages/Dashboard/Dashboard.css` lines 3–4 (breakpoint patterns). `App.css` line 16 (sidebar responsive).

**Logic impact:** NONE

---

### #16 — "Coming Soon" badge: upgrade to proper pill badge style

**Current:** `.intg-source__soon` is `font-size: 11px; color: var(--gray-400); background: var(--gray-100); padding: 4px 10px; border-radius: 6px`. Radius is 6px, inconsistent with the `var(--radius-full)` pill pattern used for all other badges.

**Suggested:** Change `border-radius` to `var(--radius-full)`, add `font-weight: 600`, `letter-spacing: 0.02em` to align with `.badge` pattern.

**CSS changes:**
```css
.intg-source__soon {
  border-radius: var(--radius-full);
  font-weight: 600;
  letter-spacing: 0.02em;
  font-size: 10px;
  padding: 3px 10px;
}
```

**Reference:** `Frontend/src/components/common/Common.css` lines 72–82 (`.badge`).

**Logic impact:** NONE

---

### #17 — Disconnect confirm modal: replace icon color with CSS class

**Current:** `<AlertCircle size={40} className="intg-disconnect__icon" />` already has the class but the color is set via `color: #ef4444` in CSS. This works but doesn't use the semantic `var(--danger)` token.

**Suggested:** One-line CSS change to use the semantic variable for dark mode compatibility.

**CSS changes:**
```css
.intg-disconnect__icon {
  color: var(--danger);
  margin-bottom: 12px;
}
```

**Reference:** `theme.css` line 32 (`--danger: #ef4444`).

**Logic impact:** NONE

---

## DECISION LIST

```
Active by default: #1, #2, #3, #4, #5, #6, #8, #9, #10, #11, #13, #15, #16, #17
Needs decision:    #7, #12 (remove inline color styles from JSX — confirm before touching JSX)

Commands:
  "apply #7, #12"        → mark ACTIVE (will remove inline backgroundColor from 2 buttons)
  "skip #7"              → keep brand-colored buttons as-is
  "explain #7"           → detail on why outline beats brand color here
  "show #6 mockup"       → focused ASCII of source card before/after
  "start implementing"   → hand off all ACTIVE suggestions to @code-suggester
```