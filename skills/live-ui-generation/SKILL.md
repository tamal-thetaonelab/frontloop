---
name: live-ui-generation
description: Enables live UI generation by click-inspecting DOM elements or capturing screenshots, then applying code fixes with a generating animation. Use for "inspect element", "live UI generation", "live gen", "fix this element", "update this component", "change this UI", "edit this part of the page", "make this look different", or when visually selecting DOM elements for modification. Does not apply to general code generation without element inspection.
---

# Live UI Generation

## Overview

Closes the loop between browser and Claude via three modes:

- **Element inspect:** Hover ⋞ FAB → transforms to ✛ Inspect → click element → describe fix. Orange shimmer appears, TASK payload arrives in the shell.
- **Screenshot capture:** Hover ⋞ FAB → click [] Screenshot → drag to select region → describe fix. TASK payload includes `screenshotPath`.
- **Undo:** Hover ⋞ FAB → click ↩ Undo (red when history exists). Sends UNDO task; Claude reverts last change and reloads.

```
Browser ──WS──▶ ws-task-server (stdout) ──▶ Claude reads TASK, applies change
  ▲                                                        │
  └──────────── HTTP POST /complete/<id> ◀────────────────┘

Browser ──WS──▶ ws-task-server (stdout) ──▶ Claude reads UNDO, reverts change
  (fire-and-forget — no COMPLETE response)
```

**FAB:** Fixed bottom-right. Hover transforms the FAB from ⋞ to ✛ (Inspect), reveals two dial items: **↩ Undo** (grey/red) and **[] Screenshot** (indigo), plus an **"Inspect" label** next to the FAB. Hides entirely while any operation is active; Escape restores. Only active in dev mode — guard varies by framework (see [reference/wiring.md](reference/wiring.md)). **Clicking the FAB itself starts inspect mode** — the click is never wasted.

**Console error capture:** Both the inspect and screenshot prompt panels include a "Send console errors" checkbox. When checked, captured `console.error` calls are included in the TASK payload. A live `[N errors]` counter appears next to the checkbox.

**Undo stack:** Task IDs stored in `sessionStorage` (`__frontloop_undo_stack__`). Survives page reloads. Button turns red when non-empty, grey when empty.

## Architecture

| Component | File | Role |
|-----------|------|------|
| WS + HTTP server | `<repo-root>/ws-task-server.<server-ext>` | WS 7332, HTTP completion + reload + screenshot on 7333 |
| DOM Inspector | `<frontend>/src/mocks/dom-inspector.ts` | FAB, hover highlight, canvas capture, shimmer overlay, WS dispatch, console error section UI |
| Console error capture | `<frontend>/src/mocks/capture-console-errors.ts` | Patches `console.error` at module load time, provides shared error buffer |
| Provider wiring | `<frontend>/src/lib/LiveUIProvider.tsx` | Eagerly imports `capture-console-errors`, calls `setupDomInspector()` once in dev mode |

- **`<repo-root>`** — `git rev-parse --show-toplevel`
- **`<frontend>`** — dir with `src/` + `package.json` with a dev server script
- **`<server-ext>`** — `.js` if `package.json` has no `"type": "module"`, otherwise `.cjs` (the server uses CommonJS `require()`)

## Monitoring

The **Monitor tool** spawns a persistent background process. `ws-task-server.<server-ext>` emits `TASK: {...}` lines to stdout — each line is a real-time notification. **Use Monitor, not Bash** (Bash is ephemeral and can't host a persistent WS server).

## Setup

Claude handles steps 1–5. **Step 6 (dev server) must be started by the user.**

### Step 1 — Resolve repo paths
Identify `<repo-root>` and `<frontend>` using the rules above.

### Step 2 — ws-task-server
Copy [reference/ws-task-server.js](reference/ws-task-server.js) verbatim to `<repo-root>/ws-task-server.<server-ext>`. Use bash to copy — do not reconstruct from memory. Check `package.json` for `"type": "module"` first to resolve `<server-ext>` (`.cjs` if present, `.js` otherwise). The `ws` module is a transitive dep in `<frontend>/node_modules/ws` — do not install separately.

### Step 3 — Start server with Monitor
```sh
NODE_PATH=<frontend>/node_modules node <repo-root>/ws-task-server.<server-ext>
```
Verify: `lsof -i :7332 | grep LISTEN && lsof -i :7333 | grep LISTEN`. Expect `ws-task-server: WS on 7332, HTTP on 7333`.

### Step 4 — dom-inspector.ts
Copy [reference/dom-inspector.ts](reference/dom-inspector.ts) verbatim to `<frontend>/src/mocks/dom-inspector.ts`. Use bash to copy — do not reconstruct from memory. The hover logic and hide/restore coordination are subtle and easy to break when reconstructed.

`setupDomInspector()` is idempotent — returns `null` if already initialised.

### Step 4.5 — capture-console-errors.ts
Copy [reference/capture-console-errors.ts](reference/capture-console-errors.ts) verbatim to `<frontend>/src/mocks/capture-console-errors.ts`. Use bash to copy — do not reconstruct from memory.

This file patches `console.error` at module load time and provides the shared error buffer used by the DOM inspector panels. It must be eagerly imported before React renders.

### Step 5 — Provider wiring
Call `setupDomInspector()` **exactly once** after the DOM is ready, guarded by a dev-mode check. See [reference/wiring.md](reference/wiring.md) for all framework templates (Vite, CRA/CRACO, Next.js, Angular, Vanilla JS/TS).

**Do not also call `setupDomInspector()` from the entry file** — that creates two FAB instances.

**Important — console error capture:** The provider must also **eagerly import `capture-console-errors`** at module level so the `console.error` patch runs before React renders. Add at the top of the provider file:

```ts
import "../mocks/capture-console-errors";
```

This is already included in the Vite template in [reference/wiring.md](reference/wiring.md). For other frameworks, add the same line.

### Step 6 — User starts dev server
**Claude must NOT start the dev server.** Instruct the user:

| Framework | Command |
|-----------|---------|
| Next.js | `npm run dev` |
| CRA / CRACO | `npm start` or `npm run start:mock` |
| Vite | `npm run dev` |
| Angular | `ng serve` |

---

## Usage Flow

### Phase A — Element inspect
1. User hovers ⋞ FAB → transforms to ✛ Inspect, two dial items (Undo, Screenshot) slide out to the left
2. User clicks ✛ FAB (or Inspect label) → FAB hides, crosshair cursor, elements highlight orange on hover
3. User clicks element → highlight pinned, prompt panel appears (bottom-right)
4. User describes fix, optionally checks **"Send console errors"** — two radio options appear: **Minimal** (default, messages only) / **Detailed** (full stack traces). A live `[N errors]` counter shows how many errors are captured.
5. User presses Enter / clicks "Send Fix Task" — or Escape to cancel
6. Orange shimmer over element, browser sends `TASK` via WebSocket with `consoleErrors` payload if enabled

### Phase A2 — Screenshot capture
1. User hovers ⋞ FAB → clicks [] Screenshot → FAB hides, crosshair cursor
2. User drags → dashed indigo selection rectangle
3. User releases → best enclosing container found, screenshot captured as PNG
4. Panel opens with thumbnail preview, selector, textarea, and same **"Send console errors"** checkbox + radios
5. User sends → PNG saved to `/tmp/liveui-screenshot-<id>.png`. TASK dispatched with `screenshotPath` and optional `consoleErrors`
6. Indigo shimmer over region

### Phase A3 — Undo
1. User hovers ⋞ FAB → clicks ↩ Undo (only active when stack is non-empty)
2. Browser pops last task ID, sends `UNDO: {"id":"<new>","type":"undo","targetTaskId":"<last>"}` via WebSocket
3. Monitor notifies Claude with `type: "undo"` task
4. Claude reverts the code change → sends `POST /reload`

### Phase B — TASK arrives
Check `type` field:
- **`"dom-fix"`** → Phase C
- **`"undo"`** → Phase D (`targetTaskId` identifies the fix to revert)

If `screenshotPath` present, `Read` the image file before planning.

If `consoleErrors` present (full payload in stderr, slim summary in stdout), review the errors before applying a fix — they may explain the problem the user is reporting (e.g. React deprecation warnings causing blank UI areas). The `consoleErrors` field has:
- `mode`: `"minimal"` (messages only) or `"detailed"` (full stack traces)
- `errors`: array of `{ message, stack, timestamp }` objects (full errors only in stderr)
- Slim stdout summary: `count` (number of errors)

### Phase C — Apply fix
1. Identify source file from payload: `page` + `pageTitle` for route, `element.componentHierarchy` for React component, `container.title` for card identity
2. Find and edit the source file
3. Run: `npx tsc --noEmit 2>&1 | head -40` — zero new errors required
4. Checklist:
   - [ ] Type check passed
   - [ ] File saved
   - [ ] `taskId` matches payload `id`
5. `curl -s -X POST http://localhost:7333/complete/<taskId>`
6. Mock-data-only changes: `curl -s -X POST http://localhost:7333/reload` instead

### Phase D — Undo
Undo is **session-aware**: only revert changes made in the current session.

1. If the change was made this session: revert that edit, run type check, `POST /reload`
2. If unknown (prior session): inspect `git diff`, tell user which file was changed, ask which to revert

No `POST /complete` for undo — fire-and-forget.

### Timing
- Target: TASK → change → completion in **under 60s** for simple changes
- Shimmer auto-clears after **180s** if no completion received

---

## Payload Schema

### dom-fix

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `id` | string | yes | 8-char alphanumeric task ID |
| `type` | string | yes | `"dom-fix"` |
| `prompt` | string | yes | Free-text fix description |
| `element.selector` | string | yes | CSS selector |
| `element.tag` | string | yes | Lowercase tag name |
| `element.html` | string | yes | `outerHTML` (truncated to 2000 chars) |
| `element.text` | string | yes | `textContent` (trimmed to 500 chars) |
| `element.styles` | object | yes | Computed style properties |
| `element.componentHierarchy` | string | no | React fiber chain e.g. `"th (CurrentTabPane > Table)"`. `null` on non-React. |
| `element.columnIndex` | number | no | 0-based column index when `<th>` clicked |
| `container.*` | varied | no | Card context: `selector`, `tag`, `html`, `text`, `title`, `value`, `description`, `dataKeys` |
| `pageTitle` | string | yes | `document.title` |
| `page` | string | yes | `window.location.href` |
| `screenshotPath` | string | no | Absolute path to saved PNG. Use `Read` to view. |
| `consoleErrors` | object | no | Present when user checked "Send console errors". Contains `mode`: `"minimal"` — messages only, or `"detailed"` — full stack traces. `errors`: array of `{message, stack, timestamp}`. Slimmed in stdout to `{mode, count}`; full errors in stderr. |

### undo

| Field | Type | Req | Description |
|-------|------|-----|-------------|
| `id` | string | yes | 8-char alphanumeric ID |
| `type` | string | yes | `"undo"` |
| `targetTaskId` | string | yes | `id` of the `dom-fix` task being undone |

---

## Edge Cases

| Situation | Action |
|-----------|--------|
| TypeScript errors in modified files | Fix before completion. If fix requires infra changes, tell user + still send completion |
| Concurrent tasks | Complete task 1 fully before starting task 2 |
| Server not running (`lsof -i :7332` empty) | Restart via Monitor (Step 3). Shimmer auto-removes after 180s |
| Completion returns 404 | WS connection already closed (tab nav/timeout). Shimmer already gone — no action needed |
| Screenshot upload fails (no `screenshotPath`) | CORS issue — server must set `Access-Control-Allow-Origin: *` and handle `OPTIONS`. Reference file handles this. |
| `className.toLowerCase is not a function` | SVG `className` is not a string. Guard: `typeof el.className === 'string'` |
| Console errors not captured | `patchConsoleError()` must run before React renders. Ensure `capture-console-errors.ts` is eagerly imported in `LiveUIProvider.tsx` at module level |
| Console error count shows 0 | The `console.error` patch runs after the file is imported. If importing lazily (via dynamic `import()`), early errors are missed — use eager import |
| `value.replace is not a function` | `cssEscape` receives a non-string value. Guard with `typeof value !== "string"` |
| HMR doesn't reflect change | `POST /reload` forces full page refresh |
| Duplicate FAB in DOM (`document.querySelectorAll('#__frontloop_speed_dial__').length > 1`) | `setupDomInspector()` called from two places — remove one call |
| CSS `:hover` dial too wide | Use JS mouseenter/mouseleave (in reference file). CSS `:hover` on flex container includes invisible children in hit area |
| `for...of` over NodeList fails | Use `.forEach()` — `--downlevelIteration` may not be enabled |
| Undo button stays grey after reload | `saveUndoStack()` missing after a `push()`, or `updateUndoBtnState()` not called after `_undoBtn = undoBtn` in `setupDomInspector` |
| UNDO task for unknown `targetTaskId` | Prior session — use `git diff` to identify recent edits and offer to revert |

---

## Common Mistakes

| Mistake | Fix |
|---------|------|
| Wrong `taskId` in curl | Copy `id` verbatim from TASK JSON — 8 alphanumeric chars |
| Skipping type check | Always run `npx tsc --noEmit` before `POST /complete` |
| Starting dev server yourself | Never — instruct user to run it |
| CRA: using `@/` alias or `'use client'` | CRA needs neither — use relative `../` paths |
| Server `MODULE_NOT_FOUND` | `NODE_PATH` must point to `<frontend>/node_modules`, not repo root |
| Reconstructing reference files from memory | Always bash-copy from `reference/` — hover/hide logic has subtle interactions |
| Sending `POST /complete` for undo | Undo is fire-and-forget — only send `POST /reload` |
| `setupDomInspector()` called from both entry file and provider | Two FABs created — call from one place only |
| Eager import of `capture-console-errors` missing | Console errors during initial render won't be captured. Add `import "../mocks/capture-console-errors"` at the top of the provider file |
| `console.warn` not captured | By design — only `console.error` is intercepted. If needed, patch `console.warn` similarly in `capture-console-errors.ts` |
