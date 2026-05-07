---
name: live-ui-generation
description: Use when the user wants live UI generation — click-to-inspect an element, describe the fix, and get changes applied with a generating animation and completion feedback. Trigger on phrases like "inspect element", "live UI generation", "live gen", "fix this element", "update this component", "change this UI", "edit this part of the page", "make this look different", or when visually selecting DOM elements for modification. Do NOT trigger for general code generation without element inspection.
---

# Live UI Generation

## Overview

Closes the loop between browser and Claude via two modes:

- **Element inspect (orange ⋞ FAB):** Select a DOM element, describe a code fix, orange shimmer appears, TASK payload arrives in the shell. Claude applies the change and POSTs completion to remove shimmer.
- **Screenshot capture (indigo [] button):** Click-drag to select a page region, describe what to fix, region captured as PNG saved to disk. TASK payload includes `screenshotPath` — Claude reads the image alongside the element context.

```
Browser ──WS──▶ ws-task-server (stdout) ──▶ Claude reads TASK, applies change
  ▲                                                        │
  └──────────── HTTP POST /complete/<id> ◀────────────────┘
```

Safety: Inspector activates only when `NODE_ENV=development`.

## Architecture

| Component | File | Role |
|-----------|------|------|
| WS + HTTP server | `<repo-root>/ws-task-server.js` | WS 7332, HTTP completion + reload + screenshot on 7333 |
| DOM Inspector | `<frontend>/src/mocks/dom-inspector.ts` | FAB, screenshot button, hover highlight, canvas capture, shimmer overlay, WS dispatch |
| Provider wiring | `<frontend>/src/lib/LiveUIProvider.tsx` | Imports `setupDomInspector()` in dev mode |

Resolve placeholders before setup:
- **`<repo-root>`** — `git rev-parse --show-toplevel` or dir with `.git/` + `package.json`
- **`<frontend>`** — dir with `src/` + `package.json` containing `"next"` (Next.js) or `"react-scripts"`/`"@craco/craco"` (CRA)

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
Create `<frontend>/src/mocks/dom-inspector.ts` exporting `setupDomInspector()`. Must contain:

- `DOMInspector` class with `activate()`/`deactivate()`, hover/click handlers, column highlighting, shimmer overlay. See [reference/dom-inspector-methods.md](reference/dom-inspector-methods.md) for full implementations.
- `setupDomInspector()` — creates FAB (orange ⋞), screenshot button (indigo []), wires drag-to-select screenshot mode, reload listener, and all event handlers.
- `ElementContext` interface with `selector`, `tagName`, `outerHTML`, `textContent`, `computedStyles`, `boundingRect`, `container`, `pageTitle`, `componentHierarchy`, `columnIndex`.
- Screenshot functions: `captureElementToDataUrl(el)` (deep-clone + SVG foreignObject → canvas), `uploadScreenshot(taskId, dataUrl)`, `showScreenshotPanel()`.
- Shimmer CSS injected via `<style>` in `document.head`.

FAB states:
- **Idle** — orange (#F97316)
- **Active** — emerald green (#059669) + pulse animation (`__outpost_fab_active`)
- **Panel open** — hidden

### Step 5 — LiveUIProvider.tsx
Create `<frontend>/src/lib/LiveUIProvider.tsx`. Framework-specific wiring:

**Next.js:** `'use client'`, import from `'@/mocks/dom-inspector'`, wire in `layout.tsx` inside `<body>`.

**CRA/CRACO:** No `'use client'`, import from `'../mocks/dom-inspector'` (relative path, not `@/`), wire in `App.tsx` wrapping `<Router>` children.

Both variants dynamically import `setupDomInspector()` inside `useEffect`, guarded by `NODE_ENV === 'development'`.

### Step 6 — User starts dev server
**Claude must NOT start the dev server.** Check `package.json` scripts and instruct the user:

| Framework | Command |
|-----------|---------|
| Next.js | `npm run dev` |
| CRA | `npm start` |
| CRA with mocks | `npm run start:mock` |

Two buttons appear at bottom-right: orange ⋞ (inspect), indigo [] (screenshot).

---

## Usage Flow

### Phase A — Element inspect
1. User clicks orange ⋞ → FAB turns emerald, crosshair cursor, elements highlight orange on hover
2. User clicks element → crosshair ends, FAB hidden, highlight pinned. Panel shows selector + textarea
3. User describes fix, presses Enter / clicks "Send Fix Task" — or Cancel/Escape to dismiss
4. If confirmed: orange shimmer over element, browser sends `TASK` via WebSocket

### Phase A2 — Screenshot capture
1. User clicks indigo [] → crosshair cursor
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
2. Find source file (`src/app/` or `src/components/` for Next.js, `src/feature/` for CRA)
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
| `element.componentHierarchy` | string | no | React fiber chain, e.g. `"th (CurrentTabPane > Table)"` |
| `element.columnIndex` | number | no | 0-based column index when `<th>` clicked |
| `container.*` | varied | no | Card context: `selector`, `tag`, `html`, `text`, `title`, `value`, `description`, `dataKeys` |
| `pageTitle` | string | yes* | `document.title` |
| `page` | string | yes | `window.location.href` |
| `screenshotPath` | string | no | Path to saved PNG on disk. Use `Read` to view. |

\* `pageTitle`/`container`/`componentHierarchy` may be absent in older inspector versions — fall back to `page` URL.

---

## Handling Edge Cases

| Situation | Action |
|-----------|--------|
| TypeScript errors in modified files | Fix before completion. If fix requires infra files, tell user + still send completion |
| Concurrent tasks | Process sequentially — complete task 1 fully before starting task 2 |
| Server not running (`lsof -i :7332` empty) | Restart via Monitor (Step 3). Shimmer auto-removes after 180s |
| Completion returns 404 | WS connection already closed (tab nav/timeout). Shimmer already gone |
| Screenshot missing or render fails | Fallback renders tag + text on white canvas. Verify `captureElementToDataUrl` |
| Screenshot upload fails silently (no `screenshotPath` in payload) | CORS issue — browser on port 4300, server on 7333. Server must set `Access-Control-Allow-Origin: *` and handle `OPTIONS` preflight. See [reference/server-code.md](reference/server-code.md) |
| `className.toLowerCase is not a function` in `enrichContainer` | SVG elements have non-string `className`. Guard with `typeof card.className === 'string'` |
| HMR doesn't reflect change | `POST /reload` for force refresh. Use for mock-data-only changes |
| `for...of` over NodeList | Use `.forEach()` — `--downlevelIteration` not enabled |

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
