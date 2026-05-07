---
name: live-ui-generation
description: Use when the user wants live UI generation — click-to-inspect an element, describe the fix, and get changes applied with a generating animation and completion feedback. Trigger on phrases like "inspect element", "live UI generation", "live gen", "fix this element", "update this component", "change this UI", "edit this part of the page", "make this look different", or when visually selecting DOM elements for modification. Do NOT trigger for general code generation without element inspection.
---

# Live UI Generation

## Overview

Closes the loop between browser and Claude via two modes:

- **Element inspect:** Hover the orange ⋞ FAB → click the ✛ Inspect circle → select a DOM element → describe a fix. Orange shimmer appears, TASK payload arrives in the shell.
- **Screenshot capture:** Hover the orange ⋞ FAB → click the [] Screenshot circle → drag to select a page region → describe what to fix. Region captured as PNG, TASK payload includes `screenshotPath`.

```
Browser ──WS──▶ ws-task-server (stdout) ──▶ Claude reads TASK, applies change
  ▲                                                        │
  └──────────── HTTP POST /complete/<id> ◀────────────────┘
```

**FAB behaviour:** Single orange ⋞ at bottom-right. Hover reveals two labelled circles to its left. FAB hides entirely while any operation is active (inspect mode, screenshot mode, generating). Escape restores it. Safety: inspector activates only when `NODE_ENV=development`.

## Architecture

| Component | File | Role |
|-----------|------|------|
| WS + HTTP server | `<repo-root>/ws-task-server.js` | WS 7332, HTTP completion + reload + screenshot on 7333 |
| DOM Inspector | `<frontend>/src/mocks/dom-inspector.ts` | Speed dial FAB, hover highlight, canvas capture, shimmer overlay, WS dispatch |
| Provider wiring | `<frontend>/src/lib/LiveUIProvider.tsx` | Calls `setupDomInspector()` once in dev mode |

Resolve placeholders before setup:
- **`<repo-root>`** — `git rev-parse --show-toplevel` or dir with `.git/` + `package.json`
- **`<frontend>`** — dir with `src/` + `package.json` containing a dev server script

## Monitoring

The **Monitor tool** spawns a persistent background process. `ws-task-server.js` emits `console.log` lines like `TASK: {...}` — each line arrives as a real-time notification. **Do not use bash** (ephemeral, can't host persistent WS). See [reference/server-code.md](reference/server-code.md) for the full server template.

## Setup

Claude handles steps 1–5. **Step 6 (dev server) must be started by the user.**

### Step 1 — Resolve repo paths
`<repo-root>` and `<frontend>` (rules above).

### Step 2 — ws-task-server.js
Create `<repo-root>/ws-task-server.js` from [reference/server-code.md](reference/server-code.md). The `ws` module is a transitive dependency in `<frontend>/node_modules/ws` — do not install separately.

### Step 3 — Start server with Monitor
```sh
NODE_PATH=<frontend>/node_modules node <repo-root>/ws-task-server.js
```
Verify: `lsof -i :7332 | grep LISTEN && lsof -i :7333 | grep LISTEN`. Expect `ws-task-server: WS on 7332, HTTP on 7333`.

### Step 4 — dom-inspector.ts
Copy [reference/dom-inspector.ts](reference/dom-inspector.ts) verbatim to `<frontend>/src/mocks/dom-inspector.ts`. This is the canonical, battle-tested implementation — do not reconstruct from scratch. Use bash / file explorer to copy, not an LLM — the hover logic and hide/restore coordination are subtle and easy to break. You will make changes to this file later, but start with the reference copy.

Key exports and guarantees:
- `setupDomInspector()` — idempotent (returns `null` if already initialised; safe to call from multiple entry points)
- Speed dial FAB: 36×36 fixed container, items absolutely positioned to the left, JS mouseenter/mouseleave with 120ms close delay
- FAB hides on `activate()`, screenshot start, and `showGeneratingOverlay()`; restores on `deactivate()`, `cleanupScreenshotMode()`, and `removeGeneratingOverlay()` — but only when no overlay is active
- `injectSpinnerStyles()` always replaces the style element (never skips on HMR reload)
- `componentHierarchy` uses React fiber (`__reactFiber$`); returns `null` gracefully on non-React frameworks

### Step 5 — Provider wiring
frontloop
`setupDomInspector()` must be called **exactly once** after the DOM is ready, guarded by `NODE_ENV === 'development'`. The function itself is idempotent but double-calling from two entry points (e.g. entry script + framework provider) creates duplicate DOM elements — guard at the call site too.

**React (CRA / Vite / CRACO):**
```tsx
// src/lib/LiveUIProvider.tsx
import React, { useEffect } from 'react';

export default function LiveUIProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    import('../mocks/dom-inspector').then(({ setupDomInspector }) => {
      setupDomInspector();
    });
  }, []);
  return <>{children}</>;
}
```
Wire in `App.tsx` wrapping `<Router>` children. **Do not also call `setupDomInspector()` from the entry file** (e.g. `main.tsx`, `mock-main.tsx`) — that creates two instances.

**Next.js (App Router):**
```tsx
// src/lib/LiveUIProvider.tsx
'use client';
import { useEffect } from 'react';

export default function LiveUIProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    import('@/mocks/dom-inspector').then(({ setupDomInspector }) => {
      setupDomInspector();
    });
  }, []);
  return <>{children}</>;
}
```
Wire inside `<body>` in `layout.tsx`.

**Vue 3:**
```ts
// src/plugins/liveUI.ts
export default {
  install() {
    if (import.meta.env.DEV) {
      import('../mocks/dom-inspector').then(({ setupDomInspector }) => {
        setupDomInspector();
      });
    }
  },
};
// main.ts: app.use(liveUIPlugin)
```

**Angular:**
```ts
// In root AppComponent ngOnInit or APP_INITIALIZER
if (!environment.production) {
  import('./mocks/dom-inspector').then(({ setupDomInspector }) => setupDomInspector());
}
```

**Vanilla JS/TS (no framework):**
```ts
if (process.env.NODE_ENV === 'development') {
  import('./mocks/dom-inspector').then(({ setupDomInspector }) => setupDomInspector());
}
```

### Step 6 — User starts dev server
**Claude must NOT start the dev server.** Check `package.json` scripts and instruct the user:

| Framework | Command |
|-----------|---------|
| Next.js | `npm run dev` |
| CRA / CRACO | `npm start` or `npm run start:mock` |
| Vite | `npm run dev` |
| Angular | `ng serve` |

Hover the orange ⋞ FAB at bottom-right. Two circles appear to its left: **[] Screenshot** (indigo) and **✛ Inspect** (orange).

---

## Usage Flow

### Phase A — Element inspect
1. User hovers ⋞ FAB → two labelled circles slide out to the left
2. User clicks ✛ Inspect → FAB hides, crosshair cursor, elements highlight orange on hover
3. User clicks element → highlight pinned, prompt panel appears (bottom-right)
4. User describes fix, presses Enter / clicks "Send Fix Task" — or Escape to cancel and restore FAB
5. Orange shimmer over element, browser sends `TASK` via WebSocket

### Phase A2 — Screenshot capture
1. User hovers ⋞ FAB → clicks [] Screenshot → FAB hides, crosshair cursor
2. User drags → dashed indigo selection rectangle
3. User releases → best container found via `elementFromPoint()` at center, walking up to enclosing ancestor
4. Element deep-cloned with inlined styles → SVG foreignObject → canvas → PNG data URL
5. Panel opens with thumbnail preview, selector, textarea
6. User sends → PNG uploaded to `POST /screenshot` on 7333, saved to `/tmp/liveui-screenshot-<id>.png`. TASK dispatched with `screenshotPath`
7. Indigo shimmer over region

### Phase B — TASK arrives
Monitor delivers the TASK line. **Verify required fields** (see Payload Schema below). If `screenshotPath` present, `Read` the image file to see the captured region.

### Phase C — Plan & apply
1. Read payload — identify page, component, and source file. Use `page` + `pageTitle` for route, `element.componentHierarchy` for React component name, `container.title` for card identity.
2. Find source file
3. Apply code change
4. Run type check: `cd <frontend> && npx tsc --noEmit 2>&1 | head -40`
5. Must show **zero new errors in modified files** before proceeding
6. Pre-completion checklist:
   - [ ] Compilation gate passed
   - [ ] File saved
   - [ ] `taskId` matches payload `id`
7. Send completion: `curl -s -X POST http://localhost:7333/complete/<taskId>`
8. For mock-data-only changes: `curl -s -X POST http://localhost:7333/reload`

### Timing
- Objective: TASK → change → completion in **under 60s** for simple changes
- Shimmer auto-removes after **180s** if no completion

---

## Payload Schema

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `id` | string | yes | 8-char alphanumeric task ID |
| `type` | string | yes | Always `"dom-fix"` |
| `prompt` | string | yes | Free-text fix description |
| `element.selector` | string | yes | CSS selector |
| `element.tag` | string | yes | Lowercase tag name |
| `element.html` | string | yes | `outerHTML` truncated to 2000 chars |
| `element.text` | string | yes | `textContent` trimmed to 500 chars |
| `element.styles` | object | yes | Computed style properties |
| `element.componentHierarchy` | string | no | React fiber chain e.g. `"th (CurrentTabPane > Table)"`. `null` on non-React. |
| `element.columnIndex` | number | no | 0-based column index when `<th>` clicked |
| `container.*` | varied | no | Card context: `selector`, `tag`, `html`, `text`, `title`, `value`, `description`, `dataKeys` |
| `pageTitle` | string | yes | `document.title` |
| `page` | string | yes | `window.location.href` |
| `screenshotPath` | string | no | Path to saved PNG on disk. Use `Read` to view. |

---

## Handling Edge Cases

| Situation | Action |
|-----------|--------|
| TypeScript errors in modified files | Fix before completion. If fix requires infra files, tell user + still send completion |
| Concurrent tasks | Process sequentially — complete task 1 fully before starting task 2 |
| Server not running (`lsof -i :7332` empty) | Restart via Monitor (Step 3). Shimmer auto-removes after 180s |
| Completion returns 404 | WS connection already closed (tab nav/timeout). Shimmer already gone |
| Screenshot missing or render fails | Fallback renders tag + text on white canvas. Verify `captureElementToDataUrl` |
| Screenshot upload fails silently (no `screenshotPath` in payload) | CORS issue — browser on different port than server on 7333. Server must set `Access-Control-Allow-Origin: *` and handle `OPTIONS` preflight. See [reference/server-code.md](reference/server-code.md) |
| `className.toLowerCase is not a function` in `enrichContainer` | SVG elements have non-string `className`. Guard: `typeof card.className === 'string'` |
| HMR doesn't reflect change | `POST /reload` for force refresh. Use for mock-data-only changes |
| FAB not hiding when operation is active | Check for duplicate `#__Frontloop_speed_dial__` in DOM (`document.querySelectorAll('[id="__frontloop_speed_dial__"]').length`). If > 1, `setupDomInspector()` was called twice — remove the extra call from the entry file |
| CSS `:hover` approach makes dial trigger too wide | Always use the JS mouseenter/mouseleave approach from the reference file. CSS `:hover` on a flex container includes invisible children in the hit area. |
| `for...of` over NodeList | Use `.forEach()` — `--downlevelIteration` may not be enabled |

---

## Common Mistakes

| Mistake | Fix |
|---------|------|
| Wrong `taskId` in curl | Copy `id` verbatim from TASK JSON. 8 alphanumeric chars |
| Skipping compilation gate | Always run `npx tsc --noEmit` before `POST /complete` |
| Notification truncated | Server logs full payload to stderr, slim to stdout. Check `slimPayload()` includes needed fields |
| Starting dev server yourself | Never. Instruct user to run it |
| CRA: `'use client'` or `@/` alias | CRA needs neither. Use relative `../` paths |
| Server `MODULE_NOT_FOUND` | `NODE_PATH` must point to `<frontend>/node_modules`, not repo root |
| `WebSocketServer is not a constructor` | v7 exports `Server`. Code handles both: `wsModule.WebSocketServer \|\| wsModule.Server` |
| Calling `setupDomInspector()` from both entry file and provider | Creates two FABs — one hides, the other stays visible. Call from ONE place only (prefer the framework provider). The function returns `null` if already initialised as a safety net. |
| Reconstructing dom-inspector.ts from memory | Always copy from [reference/dom-inspector.ts](reference/dom-inspector.ts). The hover logic and hide/restore coordination are subtle — recreating from scratch reintroduces solved bugs. |
