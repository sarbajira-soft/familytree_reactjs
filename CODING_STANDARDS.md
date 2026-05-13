# Frontend Coding Standards

Applies to `familytree_reactjs`.

## Shared Workspace Rules

### Global Rules

1. Reuse existing code before creating new code.
2. Keep one source of truth for business rules, constants, validations, and API contracts.
3. Prefer small, focused files over giant multi-purpose files.
4. Do not remove unused-looking code unless it is verified across the whole workspace.
5. Optimize for maintainability first, then optimize proven bottlenecks.
6. Build changes in a future-friendly way: configurable, testable, and easy to extend.

### Unused Code Removal Policy

Before removing anything:

1. Search the whole repo with `rg`.
2. Check direct imports and string-based usage.
3. Check lazy loads, routes, socket events, jobs, scripts, admin flows, and webhook flows.
4. If usage is unclear, do not delete it yet.

IDE dimming is not proof of dead code.

### Default Decision Rule

When unsure, prefer the option that is:

1. easier to reuse
2. easier to test
3. easier to extend
4. safer to verify
5. harder to break accidentally

## 1. Core Frontend Rules

1. Reuse existing components, hooks, services, utils, and constants before writing new code.
2. Keep route pages focused on orchestration, not on every detail of rendering and business logic.
3. Keep UI logic separate from API logic.
4. Prefer extension of current patterns over parallel frontend systems.
5. Do not remove unused-looking frontend code unless it is verified across routes, lazy imports, Android, push, and chat flows.

## 2. Folder Responsibility

- `src/Pages/`: route-level orchestration
- `src/Components/`: reusable UI components
- `src/Contexts/`: cross-page app state
- `src/hooks/`: reusable stateful behavior
- `src/services/`: API, socket, and integration calls
- `src/utils/`: pure helpers
- `src/constants/`: enums, event names, limits, shared labels

Do not put API logic or large helper blocks inside page files unless they are truly local.

## 3. Component Standards

- Prefer components around `100-300` lines.
- Review any component over `300` lines.
- Split components that mix:
  - rendering
  - socket logic
  - API calls
  - modal logic
  - heavy local state
  - formatting helpers
- Extract visually separate sections into child components.
- Extract reusable behavior into hooks.
- Extract pure formatting and mapping logic into utilities.

## 4. React Rules

- Use functional components.
- Keep state as local as possible.
- Do not duplicate derived state without a reason.
- Use `useEffect` for side effects, not for render-time computation.
- Use `useMemo` and `useCallback` only when they solve a real rerender or dependency issue.
- Prefer controlled inputs when state matters.
- Keep side effects, cleanup, and subscriptions explicit.

## 5. Reuse-First Rules

Before adding new code, check:

- existing shared components
- existing hooks
- existing service functions
- existing constants
- existing chat, family, notification, and retail UI patterns

Preferred order:

1. reuse existing code
2. extend existing code
3. extract shared code
4. write new code only if needed

Do not copy-paste component logic and rename it unless there is a strong reason.

## 6. UI And State Rules

- Keep presentation components focused on UI.
- Keep data fetching and integration logic close to pages, contexts, or hooks.
- Reuse badge, modal, list item, banner, and state-display patterns.
- Centralize event names, room types, statuses, and limits in constants.
- Avoid hardcoded business strings spread through many files.

## 7. Performance Rules

- Avoid unnecessary rerenders in repeated lists.
- Avoid large inline object creation in hot render paths when it causes churn.
- Paginate or lazy load large lists and heavy data.
- Keep caching intentional and centralized.
- Use optimistic UI only when rollback behavior is defined.
- Do not keep multiple unnecessary copies of the same data in state.

## 8. Future-Friendly Rules

- Prefer configurable behavior over hardcoded branching when requirements may grow.
- Build components so they can support more states without rewrites.
- Avoid writing code that only works for one family, one room type, or one platform unless that is truly fixed.
- Keep labels mapped from constants/helpers where the domain is shared.

## 9. Unused Code Policy

Do not remove code only because it looks unused.

Verify usage in:

- route files
- lazy-loaded pages
- context wiring
- socket events
- Android or Capacitor flows
- push flows
- shared modal usage

If unsure, keep it and mark it for later review.

## 10. Naming Rules

- Use descriptive names based on business purpose.
- Name files after what they own.
- Avoid vague names like `helper2`, `temp`, `newFile`, `data1`.

## 11. Verification Rules

Minimum expectation after meaningful frontend changes:

- `npm run build` passes
- affected UI flow is manually checked if visual or interaction-heavy

## 12. Review Checklist

Before merging frontend work, check:

- Did we reuse existing UI or logic?
- Is the component doing too many jobs?
- Did we move pure helpers out of render-heavy files?
- Are constants centralized?
- Is the UI easy to extend for the next feature?
- Did we avoid deleting code without proof?
