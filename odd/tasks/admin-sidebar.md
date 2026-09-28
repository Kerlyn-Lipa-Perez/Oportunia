# Feature: admin-sidebar — Admin panel with sectioned sidebar navigation

## Objective

Restructure the `/admin` editorial panel from a single monolithic page into a sidebar-based
layout with one real route per functional area, following the reference design the user
provided (left sidebar with grouped menu, active pill, breadcrumb/top bar, content area).

## Problem / Why

Today `src/app/admin/page.tsx` mounts one client monolith (`panel.tsx`) that stacks login,
stats, team management, TikTok campaigns, Excel ingestion and the opportunities list in a
single scroll. Functionalities are not differentiated: there is no navigation, no deep
links, no refresh/back behaviour, and everything competes in one view.

## Decisions (user-confirmed)

- **Navigation model**: real routes per section (user chose "Rutas por sección").
- Sections: `Resumen` (landing), `Convocatorias`, `Campañas TikTok`, `Ingesta`, `Equipo` (admin only).
- `Equipo` is role-gated to `access === 'admin'`, as today (`TeamPanel` only rendered for admin).
- Existing Spanish UI copy, `editor-*` CSS classes and API wiring must be preserved
  (tests read the sources and assert those strings).
- Unrelated dirty files `package.json` / `pnpm-lock.yaml` must NOT be committed with this work.

## Scope

### In
- `src/app/admin/layout.tsx` (server, auth gate + shell), `sidebar.tsx` (client nav), `login.tsx` (extracted login).
- One page per section: `page.tsx` (Resumen), `convocatorias/`, `campanas/`, `ingesta/`, `equipo/`.
- Extract the ingestion block and the opportunities list/dialog out of `panel.tsx`; then delete `panel.tsx`.
- Sidebar/shell/responsive styles in `src/app/admin/admin.css`.
- Update dependent tests (`tests/tiktok-ui.test.ts` paths, `e2e/admin-users.spec.ts` navigation) and add
  `tests/admin-layout.test.ts` (structural contract for the new layout).

### Out
- No API, schema, auth or role-model changes.
- No new chart/analytics widgets (Resumen only re-presents existing opportunity stats).
- No redesign of the existing `editor-*` section internals (only moved, not rewritten).
- No push/PR/merge (user's decision under ordinary repository policy).

## Constraints & environment

- **TDD**: Strict TDD enabled (source: session config `gentle-ai:strict-tdd-mode`).
  Runner: `pnpm test` (`tsx --test tests/*.test.ts`). RED → GREEN → REFACTOR per work unit.
- **RDD (receipt-driven development): ON (decided by default)** — after each work-unit commit run
  `gentle-ai review assess --cwd <repo> --agent opencode --base-ref <boundary> --committed-only --json`
  and honour `review_due`.
- Checks: `pnpm typecheck`, `pnpm test`. E2E (`pnpm test:e2e`) needs external base URL + E2E credentials
  (Playwright is external-only); run only if available, otherwise report as not-run honestly.
- Test contract that must keep passing:
  - `tests/tiktok-ui.test.ts`: reads `src/app/admin/panel.tsx` (must be re-pointed), asserts `SocialCampaignsPanel`, `'Ingresar'`, no `Ingresar al CMS`.
  - `tests/social-analytics.test.ts`: reads `src/app/admin/social-campaigns.tsx` (file must stay).
  - `tests/e2e-harness.test.ts`: asserts content of `e2e/admin-users.spec.ts`.
  - `e2e/admin-users.spec.ts`: expects headings `Convocatorias`, `Equipo`, `Carga y fuentes oficiales`,
    `.editor-team-row`, `.editor-team-create`, and editor sees no `Equipo`.
- Keep `.editor-team-row`, `.editor-team-create` class names and all Spanish labels intact.

## Route declaration (delegation evidence)

| Task | Route | Trigger evidence |
|------|-------|------------------|
| T1 structural RED test | inline | single mechanical test file derived from this plan, no research needed |
| T2 layout/shell + section pages + styles | delegated (one writer) | 10+ non-trivial files (writer trigger) |
| T3 dependent test updates | delegated (same writer) | part of the same bounded writer scope |
| T4 verification (typecheck/tests) | per-action worker or inline | bounded check action |
| T5 commits + RDD assess | inline | git/state commands |

## Forecast

Authored changed lines (additions + deletions, including moved code): **~700–900 → above the 400-line advisory**.
Delivery strategy: `ask-on-risk` (default) → chain strategy must be confirmed before the first commit.

## Tasks

- [ ] **T1** RED: add `tests/admin-layout.test.ts` asserting the sidebar layout contract (files, routes, admin-only equipo gate, login extraction). Run `pnpm test` and observe it fail.
- [ ] **T2** GREEN: build `layout.tsx` + `sidebar.tsx` + `login.tsx`, create the five section pages, extract convocatorias/ingesta panels from `panel.tsx`, delete `panel.tsx`.
- [ ] **T3** GREEN: sidebar/shell/responsive styles in `admin.css` (desktop sidebar + mobile drawer), aligned with the reference image.
- [ ] **T4** Update `tests/tiktok-ui.test.ts` paths and `e2e/admin-users.spec.ts` navigation to the new routes; keep their existing assertions.
- [ ] **T5** Verify: `pnpm typecheck` and `pnpm test` green; e2e only if environment allows.
- [ ] **T6** Commit work-unit(s) on feature branch with Conventional Commits (no AI attribution), then RDD assess; record evidence below.

## Acceptance criteria

- `/admin` shows Resumen (welcome + existing stat cards); each other section has its own URL and content.
- Sidebar shows grouped navigation with active state; `Equipo` only for admin; editor visiting `/admin/equipo` sees no `Equipo` heading.
- Refresh/back/deep link keeps the active section.
- Mobile: sidebar collapses (drawer/toggle) without breaking section content.
- `pnpm typecheck` and `pnpm test` pass.

## Progress / evidence

- TDD mode: Strict (session config) — runner `pnpm test`.
- Delivery strategy: ask-on-risk — chain strategy: _pending confirmation_.
- (evidence to be filled per task: commit ids, check results)
