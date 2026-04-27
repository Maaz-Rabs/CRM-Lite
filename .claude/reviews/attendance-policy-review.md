# Frontend Review — Attendance Policy Module

**Date:** 2026-04-27
**Scope:** `frontend/src/pages/DynamicFields/DynamicFields.js` (attendance handling) + `frontend/src/pages/Attendance/Attendance.js` (LATE pill / Week Off column)
**Reviewer:** frontend-reviewer (manual run; agent not registered in harness)

---

## Found 11 issues

### [CRITICAL] #1 — Type column shows chip again (regression of user request)
**File:** `frontend/src/pages/DynamicFields/DynamicFields.js:405-411`
**Reason:** User explicitly asked to render policy `type` as plain text, no box/chip. Code now renders `<span className="df-chip">…</span>` again — matches the original pre-fix state. Either the edit was reverted or the file diverged.
**Fix:** Replace the chip block with `return <td key={f} className="df-table__extra">{String(val).replace(/_/g, ' ')}</td>;`

### [CRITICAL] #2 — Late check / "intime" overload silently mis-marks users
**File:** `frontend/src/pages/DynamicFields/DynamicFields.js:30`
**Reason:** Both `late_mark` and `intime` policy types map to the same backend rule (`TIME(punch_in_time) > threshold_time` ⇒ late). If both exist, `late_mark` wins; if only `intime` exists, IT becomes the late cutoff. The `intime` hint says "Reference time for on-time arrival" — admins reasonably read this as informational, not enforcement, and may set a tight value (e.g. `09:00`) that turns into a late deadline. Either remove the duplication, hide `intime` from the dropdown, or change the hint to say "Used as the late cutoff if no Late Mark policy exists."

### [WARNING] #3 — `LatePill` is a wall of inline styles
**File:** `frontend/src/pages/Attendance/Attendance.js:29-42`
**Reason:** Project convention is plain CSS classes (no CSS-in-JS); `Attendance.css` already exists. 12-line inline-style block violates this and can't be themed (no dark-mode override path).
**Fix:** Move into `Attendance.css` as `.att-late-pill { … }` and have `LatePill` render `<span className="att-late-pill">LATE</span>`.

### [WARNING] #4 — Inconsistent `is_late` field name across endpoints
**File:** `frontend/src/pages/Attendance/Attendance.js:469` (`const late = s.isLate || s.is_late`)
**Reason:** Defensive `||` masks a real backend inconsistency: `getHistory` controller returns `isLate`; `getAdminDailyRecords` model returns `is_late`. The fallback works today but next time someone consumes attendance data they'll trip on it. Pick one shape on the backend (camelCase recommended for JSON APIs) and remove the fallback.

### [WARNING] #5 — Week-day pill button missing `aria-pressed` / `type="button"`
**File:** `frontend/src/pages/DynamicFields/DynamicFields.js:551-557`
**Reason:** The 7 toggle buttons in the week-off picker have only a class change to indicate state. Screen readers can't tell selected from unselected. Buttons inside the modal with no `type="button"` will submit any enclosing form (none here, but defensive).
**Fix:** `<button type="button" aria-pressed={selected} …>`.

### [WARNING] #6 — `formData.color` validation never fires
**File:** `frontend/src/pages/DynamicFields/DynamicFields.js:181`
**Reason:** `payload.color = formData.color || null;` — `formData.color` is initialized to `'#808080'` and the picker always returns a non-empty string, so `|| null` is dead code. Either drop the `|| null` or actually allow clearing the color (currently impossible from the UI).

### [WARNING] #7 — Week Off column added to admin monthly only; user view doesn't show it
**File:** `frontend/src/pages/Attendance/Attendance.js:399`
**Reason:** Backend now returns `weekend_days`. Admin's all-users monthly table renders it; the regular user's monthly stats (4 StatCards on line 325-329) and the user-drilldown view do not. Inconsistent — non-admin users have no way to see how many week-off days they had.
**Fix:** Add a `Week Off` StatCard or extend `getStats` response.

### [SUGGESTION] #8 — Modal field order: Color shown before Type for attendance
**File:** `frontend/src/pages/DynamicFields/DynamicFields.js:486-499` (Color block) precedes `:501` (Type block).
**Reason:** For attendance policies the `type` is the most important decision (it gates which other fields show). Showing Color first wastes attention. Move the attendance-specific block up, or hide Color for attendance entirely (it's never displayed anywhere user-facing).

### [SUGGESTION] #9 — Cancel button not disabled while save in flight
**File:** `frontend/src/pages/DynamicFields/DynamicFields.js:425`
**Reason:** `disabled={saving}` is only on the Save button. User can close the modal mid-request, which then resolves and toasts a success on a closed modal. Add `disabled={saving}` to Cancel and the Modal `onClose` too.

### [SUGGESTION] #10 — `toggleWeekDay` does Set→Array→Number→sort→join roundtrip
**File:** `frontend/src/pages/DynamicFields/DynamicFields.js:141-151`
**Reason:** Works, but ~6 transformations for a 7-element list is overkill and obscures intent.
**Fix:** Direct array-of-booleans state or simpler `cur.has` toggle without re-sorting (server doesn't care about order).

### [SUGGESTION] #11 — `showToast` is a local 3s timer instead of `ToastContext`
**File:** `frontend/src/pages/DynamicFields/DynamicFields.js:54-57`
**Reason:** Project has `ToastContext` (`useToast().showToast`). This page rolls its own + renders a non-standard `.broker-toast` at line 441. Stack of toasts can't queue, no consistent styling. Pre-existing pattern but flagged for consistency.

---

## State

- ✅ All 11 issues fixed (2026-04-27)

### Fix summary
- ✅ #1 — Type column rendered as plain text (chip removed)
- ✅ #2 — `intime` hint clarified: "Used as the late cutoff if no Late Mark policy is active"
- ✅ #3 — `LatePill` extracted to `.att-late-pill` class in `Attendance.css` (incl. dark-mode)
- ✅ #4 — Backend unified on `is_late` (snake_case); frontend now reads only `is_late`
- ✅ #5 — Week-day pill: `aria-pressed`, `aria-label`, key changed from `i` to `d`
- ✅ #6 — Dead `formData.color || null` removed (along with attendance color UI)
- ✅ #7 — Backend `getStats` + admin user-detail return `weekendDays`; frontend shows new "Week Off" StatCard
- ✅ #8 — `hasColor` removed from attendance config (Color form field no longer rendered)
- ✅ #9 — Cancel button + Modal `onClose` blocked while `saving`
- ✅ #10 — `toggleWeekDay` simplified; sort happens once on insert
- ✅ #11 — Replaced local 3-second timer with global `useToast()`; removed `<div className="broker-toast">`

Bonus: removed unused `Sparkles` import from `lucide-react`.
