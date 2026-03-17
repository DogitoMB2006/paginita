---
name: planes-page-and-upcoming-plan
overview: Add a beautiful Planes section and page backed by Supabase plans, and wire the dashboard Próximo Plan card to show the soonest upcoming plan.
todos:
  - id: create-planes-page
    content: Create a new Planes page component with form to add plans and lists for upcoming and past plans using Supabase
    status: completed
  - id: wire-planes-route
    content: Wire the Planes page into App routes and ensure navbar link points to /dashboard/planes
    status: completed
  - id: hook-up-proximo-plan
    content: Fetch the next upcoming plan from Supabase and display it dynamically in the Dashboard Próximo Plan card
    status: completed
  - id: style-and-ux-polish
    content: Refine styling, date formatting, and countdown messaging for a romantic, cohesive UI
    status: completed
isProject: false
---

# Planes section and Próximo Plan integration

## Overview

- Create a dedicated `Planes` page where you and your girlfriend can create, view, and manage upcoming plans stored in the `public.plans` table.
- Wire the existing dashboard "Próximo Plan" card so it always shows the soonest upcoming plan from Supabase (or a sweet empty state if there are none).

## Data & Types

- **Leverage existing schema**: Use the `public.plans` table defined in `[supabase_schema.sql](supabase_schema.sql)` with fields `id`, `title`, `description`, `plan_date`, `created_by`, and `created_at`.
- **Create a Plan type** in the frontend (e.g. in `[src/pages/Planes.tsx](src/pages/Planes.tsx)`):
  - `id: string`
  - `title: string`
  - `description?: string | null`
  - `plan_date: string` (ISO string from Supabase)
  - `created_at: string`
- **Queries** (using existing `supabase` client):
  - Fetch all plans for display on the Planes page, ordered by `plan_date` ascending.
  - Fetch the single **next upcoming plan** where `plan_date >= now()` for the dashboard card.

## New Planes Page

- **Create `Planes` page component** at `[src/pages/Planes.tsx](src/pages/Planes.tsx)`:
  - Layout consistent with `Dashboard` and `CosasQueHacer`:
    - Animated entry (`animate-in fade-in slide-in-from-bottom-4`).
    - Header with title **"Nuestros Planes"** and a short romantic subtitle.
  - **Add Plan form** (top of the page):
    - Fields:
      - Title (required, e.g. "Aniversario en el restaurante especial").
      - Date (date input) and optional time (time input), combined into a full `plan_date` ISO string.
      - Optional description / note (textarea) for sweet details.
    - Design:
      - Rounded, glassy card similar to `CosasQueHacer` header, with soft pink accents.
      - Use a primary button like your other gradient pink buttons for "Guardar plan".
    - Behavior:
      - On submit, get the current user via `supabase.auth.getUser()`.
      - Insert into `public.plans` with `created_by: user.id` and `plan_date` built from date+time (default to e.g. 19:00 local if time is empty).
      - On success, prepend the new plan into local state and clear the form.
      - On error, show a small error alert block.
- **Plans list section** (below the form):
  - Query all plans ordered by `plan_date` ascending using `useEffect` on mount.
  - Group into two lists:
    - **Próximos planes**: `plan_date >= today`.
    - **Planes pasados**: `plan_date < today`.
  - UI design for each plan card:
    - Rounded gradient or soft card with:
      - Formatted date (e.g. `Sábado, 28 de Octubre` in Spanish locale) and time.
      - Title in larger bold font.
      - Optional description below in softer text.
      - A small pill showing relative time (e.g. "Faltan 5 días" or "Fue hace 3 días") computed from `plan_date`.
    - For upcoming plans, add a subtle heart or calendar icon and soft glow on hover.
  - **Empty states**:
    - If no upcoming plans: show a cute message like "Aún no tenemos planes. ¿Planeamos algo bonito?" with a button that scrolls back to the form.
    - If no past plans: show a softer note like "Todos nuestros recuerdos están por venir".

## Routing & Navbar Wiring

- **Add route** for Planes:
  - In `[src/App.tsx](src/App.tsx)`, under the protected `/dashboard` routes, add:
    - `<Route path="planes" element={<Planes />} />` after importing the new page.
  - The navbar in `[src/components/layout/RightSidebar.tsx](src/components/layout/RightSidebar.tsx)` already has a `Planes` item pointing to `/dashboard/planes`, so no change there beyond ensuring the path matches exactly.

## Dashboard Próximo Plan Card Integration

- **Create a reusable hook or utility** to fetch the next plan:
  - Option A (simple): implement logic directly in `[src/pages/Dashboard.tsx](src/pages/Dashboard.tsx)`.
  - Option B (cleaner): export a `useNextPlan` hook from a small helper file (e.g. `[src/hooks/useNextPlan.ts](src/hooks/useNextPlan.ts)`) that:
    - On mount, calls Supabase:
      - `from('plans').select('*').gte('plan_date', new Date().toISOString()).order('plan_date', { ascending: true }).limit(1).single()`.
    - Returns `{ plan, isLoading, error }`.
- **Update the Próximo Plan card** in `[src/pages/Dashboard.tsx](src/pages/Dashboard.tsx)`:
  - Replace the hard-coded content with dynamic values:
    - While `isLoading`: show a small shimmer / spinner in the card.
    - If `error`: show a gentle error message like "No pudimos cargar el próximo plan" (but keep the card design).
    - If `plan` exists:
      - Format `plan.plan_date` as `Sábado, 28 de Octubre` (using `toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })`).
      - Use `plan.title` as the main line.
      - Compute and show countdown text `"¡Faltan X días!"` or `"¡Es hoy!"` when `X === 0`.
    - If **no upcoming plan**:
      - Show a romantic placeholder like:
        - Date line: "Sin fecha todavía".
        - Title: "Planeemos nuestro próximo momento especial".
        - Button or text link inside the card: "Ver planes" that navigates to `/dashboard/planes`.
- **Optional enhancement**: clicking the Próximo Plan card navigates to the `Planes` page, perhaps scrolling to that specific plan if present.

## Visual & UX polish

- **Consistent theming**:
  - Reuse existing Tailwind + gradient styles from `Dashboard` and `CosasQueHacer` (e.g. background gradients, glassy cards, heart icon accent colors).
  - Ensure both light and dark themes look good (use existing dark mode classes `dark:bg-slate-900/80`, `dark:text-slate-100`, etc.).
- **Animations**:
  - Use subtle `hover:-translate-y-1`, `hover:shadow-xl`, and `transition-all` on plan cards.
  - Consider a small `animate-pulse` for the Próximo Plan card while loading.
- **Date handling edge cases**:
  - Normalize comparisons using UTC (via `new Date(plan.plan_date).getTime()` vs `Date.now()`) to avoid off-by-one issues.
  - If time is omitted when creating a plan, default to a reasonable evening time so countdowns feel natural.

## Testing & Verification

- Add several plans via the new `Planes` page with different dates (past and future) and verify:
  - Upcoming plans list and past plans list show the correct items.
  - The dashboard Próximo Plan card always shows the earliest future plan.
  - When all plans are in the past, the card shows the romantic empty state and prompts to add a new plan.
- Verify behavior on both desktop and mobile widths:
  - Navbar `Planes` entry correctly routes to the page.
  - Cards wrap and stack nicely on small screens with adequate padding.

