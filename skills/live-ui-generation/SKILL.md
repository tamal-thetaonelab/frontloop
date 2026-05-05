---
name: live-ui-generation
description: Use when the user wants live UI generation — click-to-inspect an element, describe the fix, and get changes applied with a generating animation and completion feedback. Trigger on phrases like "inspect element", "live UI generation", "live gen", "fix this element", "update this component", "change this UI", "edit this part of the page", "make this look different", or when visually selecting DOM elements for modification. Do NOT trigger for general code generation without element inspection.
---

# Live UI Generation

## Overview

Closes the loop between browser and Claude: the user clicks a floating button (FAB), selects a DOM element, types a fix description, an orange shimmer animation appears over the selected element, and a TASK notification arrives in the shell where the WS server is running. Claude reads the payload, applies the change, and POSTs a completion signal to remove the shimmer.

```
Browser ──WS──▶ ws-task-server (stdout) ──▶ Claude reads TASK, applies change
  ▲                                                        │
  └──────────── HTTP POST /complete/<id> ◀────────────────┘
```

No MSW dependency. The DOM inspector activates in dev mode only (`NODE_ENV=development`).

## Architecture

Three lightweight pieces, all scoped to dev mode:

| Component | File | Role |
|-----------|------|------|
| WS + HTTP server | `<repo-root>/ws-task-server.js` | WebSocket on 7332, HTTP completion + reload on 7333 |
| DOM Inspector | `<frontend>/src/mocks/dom-inspector.ts` | FAB, hover highlight, click-to-capture, shimmer overlay, WS dispatch |
| Provider wiring | `<frontend>/src/lib/LiveUIProvider.tsx` | Dynamically imports `setupDomInspector()` in dev mode |

**Safety:** The inspector only activates when `NODE_ENV=development`. The FAB never appears in production builds.

## Resolving Placeholders

Before any setup step, resolve the two path placeholders used throughout this document:

- **`<repo-root>`** — the directory containing `.git/` and the top-level `package.json`. Find it by running `git rev-parse --show-toplevel` from anywhere inside the project, or by locating the directory that has both `.git/` and `package.json`.
- **`<frontend>`** — the directory that contains `src/` and a `package.json` with a React-based framework. Detect the framework type at the same time:

| Condition | Framework |
|-----------|-----------|
| `package.json` has `"next"` in dependencies | **Next.js** (App Router) |
| `package.json` has `"react-scripts"` or `"@craco/craco"` | **CRA / CRACO** |

Steps below include framework-specific notes where behaviour differs. If the framework cannot be determined, read `package.json` before proceeding.

## What Is the Monitor Tool

The **Monitor tool** is a Claude Code built-in that spawns a persistent background process and streams each stdout line as a real-time notification — Claude is woken up the moment a line arrives, with no polling and no blocking of the main session.

`ws-task-server.js` uses `console.log` to emit TASK payloads. When the server runs under Monitor and the browser submits a task, the line:

```
TASK: {"id":"1lqp7tln","type":"dom-fix","prompt":"...","element":{...},"page":"http://..."}
```

arrives as a notification that Claude reads immediately and acts on. This is the only supported way to run the server — **do not use bash**, which is ephemeral and cannot host a persistent WebSocket server.

## Setup

**Important:** Claude handles steps 1–5 (infrastructure setup), but **step 6 (dev server) must be started by the user.** Never start the dev server yourself.

### Step 1 — Resolve repo paths

Identify `<repo-root>` and `<frontend>` using the rules above. Confirm they exist before proceeding.

### Step 2 — Verify ws-task-server.js

Check for `<repo-root>/ws-task-server.js`. If missing, create it:

```js
// Live UI Generation — WS (7332) + HTTP completion (7333)
const http = require('http');
// ws v8+ exports WebSocketServer; v7 exports Server — support both
const wsModule = require('ws');
const WebSocketServer = wsModule.WebSocketServer || wsModule.Server;

const WS_PORT = 7332;
const HTTP_PORT = 7333;

const connections = new Map(); // taskId → ws
const monitors = new Set();    // monitor connections (no task id)

const wss = new WebSocketServer({ port: WS_PORT });
wss.on('connection', (ws) => {
  monitors.add(ws);

  ws.on('message', (raw) => {
    const str = raw.toString();
    let payload;

    // Format A (Next.js dom-inspector): JSON envelope { type: 'TASK', payload: {...} }
    // Format B (CRA dom-inspector):     prefixed string  "TASK: {...}"
    try {
      const envelope = JSON.parse(str);
      if (envelope.type === 'TASK' && envelope.payload?.id) {
        payload = envelope.payload;
      }
    } catch { /* not Format A — try Format B */ }

    if (!payload && str.startsWith('TASK: ')) {
      try { payload = JSON.parse(str.slice('TASK: '.length)); } catch { return; }
    }

    if (!payload?.id) return;

    connections.set(payload.id, ws);
    monitors.delete(ws);
    console.log(`TASK: ${JSON.stringify(payload)}`);
  });

  ws.on('close', () => {
    monitors.delete(ws);
    for (const [id, conn] of connections) {
      if (conn === ws) connections.delete(id);
    }
  });
});

const server = http.createServer((req, res) => {
  const match = req.url?.match(/^\/complete\/([a-z0-9]+)$/i);
  if (req.method === 'POST' && match) {
    const taskId = match[1];
    const ws = connections.get(taskId);
    if (ws && ws.readyState === ws.OPEN) {
      ws.send(`COMPLETE:${taskId}`);
      connections.delete(taskId);
      res.writeHead(200);
      res.end(`ok (task ${taskId})`);
    } else {
      res.writeHead(404);
      res.end(`not found (task ${taskId})`);
    }
  } else if (req.method === 'POST' && req.url === '/reload') {
    const all = new Set(monitors);
    for (const [, ws] of connections) all.add(ws);
    let count = 0;
    for (const ws of all) {
      if (ws.readyState === ws.OPEN) { ws.send('RELOAD'); count++; }
    }
    res.writeHead(200);
    res.end(`reload sent to ${count} client(s)`);
  } else {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(HTTP_PORT, () => {
  console.log(`ws-task-server: WS on ${WS_PORT}, HTTP on ${HTTP_PORT}`);
});
```

**`ws` module:** Do NOT install it separately. It is present in `<frontend>/node_modules/ws` as a transitive dependency (Next.js pulls it in; CRA pulls it in via `webpack-dev-server`). Run the server with `NODE_PATH` pointing there (see Step 3). The server code above handles both the v7 (`Server`) and v8+ (`WebSocketServer`) export names automatically.

### Step 3 — Start the server with Monitor

Use the **Monitor tool** to start the server as a persistent background process:

```
NODE_PATH=<frontend>/node_modules node <repo-root>/ws-task-server.js
```

Monitor streams every stdout line as a notification. When the server starts successfully you will see:

```
ws-task-server: WS on 7332, HTTP on 7333
```

If that line does not appear, check for `MODULE_NOT_FOUND` (wrong `NODE_PATH`) or a port conflict.

**Verify the server is listening** (using bash):

```sh
lsof -i :7332 | grep LISTEN && lsof -i :7333 | grep LISTEN
```

Both ports must show `LISTEN` before proceeding.

### Step 4 — Verify dom-inspector.ts

Check for `<frontend>/src/mocks/dom-inspector.ts`. If missing, create it. It must export `setupDomInspector()` and contain:

- `ElementContext` interface — clicked element fields plus optional enriched `container` context and `pageTitle`
- `DOMInspector` class:
  - `init()` — creates FAB and starts reload listener
  - `connectReloadListener()` — persistent WS to `ws://localhost:7332`; calls `window.location.reload()` on `RELOAD` message; auto-reconnects after 3 s on unexpected disconnect
  - `activate()` / `deactivate()` — crosshair cursor, hover highlight overlay, click capture
  - `showPanel(ctx, element)` — fixed panel with element selector label, textarea, **Cancel button** (restores FAB, no task sent), **Send Fix Task button**, and **Escape key handler** (same as Cancel)
  - `dispatchFixTask(ctx, prompt, element)` — generates 8-char alphanumeric `id`, hides FAB, applies shimmer, opens WS, sends `{type:"TASK", payload}`, listens for `COMPLETE:<id>`, restores FAB on completion. 180 s fallback timeout.
  - `applyShimmer(el)` — **MUST use `position:fixed` overlay appended to `document.body`**, positioned via `el.getBoundingClientRect()`. Do NOT `appendChild` to the target element — SVG nodes (`rect`, `path`, `circle`, etc.) silently reject HTML children.
  - `enrichContext(el)` — walks up the DOM (max 10 levels) to find a card-like ancestor; extracts `title`, `value`, `description`, `dataKeys` from its children
  - `findSelector(el)` — inline CSS selector generator (no external deps), prefers `#id`, falls back to tag + class + `:nth-of-type`
- Shimmer CSS injected via `<style>` appended to `document.head` at module load time
- FAB: orange circle `⋞`, `position:fixed`, bottom-right, 36 px, `z-index:2147483645`
- FAB is hidden while shimmer is active; restored only on task completion or fallback timeout

The reference implementation lives at `<frontend>/src/mocks/dom-inspector.ts` in the esg-demo-next repo.

### Step 5 — Verify LiveUIProvider.tsx

Check for `<frontend>/src/lib/LiveUIProvider.tsx`. If missing, create it using the variant for the detected framework.

**Next.js (App Router)**

```tsx
'use client'

import { useEffect } from 'react'

export default function LiveUIProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    async function init() {
      try {
        const { setupDomInspector } = await import('@/mocks/dom-inspector')
        setupDomInspector()
      } catch (e) {
        console.warn('[LiveUI] dom-inspector init failed:', e)
      }
    }
    init()
  }, [])

  return <>{children}</>
}
```

Wire in `<frontend>/src/app/layout.tsx` inside `<body>`:

```tsx
import LiveUIProvider from '@/lib/LiveUIProvider'

<LiveUIProvider>{children}</LiveUIProvider>
```

If a `MockProvider` exists, wrap it outside:

```tsx
<MockProvider><LiveUIProvider>{children}</LiveUIProvider></MockProvider>
```

---

**CRA / CRACO**

No `'use client'` directive (not a Next.js concept). No `@/` alias — use a relative import or the project's configured alias (`~/` for CRACO projects that set it up). No SSR, so no `next/dynamic` needed.

```tsx
import { useEffect } from 'react'

export default function LiveUIProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    async function init() {
      try {
        // Use relative path — CRA does not support the @/ alias
        const { setupDomInspector } = await import('../mocks/dom-inspector')
        setupDomInspector()
      } catch (e) {
        console.warn('[LiveUI] dom-inspector init failed:', e)
      }
    }
    init()
  }, [])

  return <>{children}</>
}
```

Wire in `<frontend>/src/app/App.tsx` (or wherever the root component renders the Router), wrapping the Router's children — **not** a layout file, which doesn't exist in CRA:

```tsx
import LiveUIProvider from '../lib/LiveUIProvider'

// Inside render / return, wrapping route children:
<Router>
  <LiveUIProvider>
    <Route path="/" component={LandingPageApp} />
    {/* ... other routes */}
  </LiveUIProvider>
</Router>
```

If the project uses a class component for App, wrap inside the `render()` return the same way.

### Step 6 — User starts dev server

**Claude must NOT start the dev server.** Check the `scripts` field in `package.json` to identify the right command, then instruct the user:

| Framework | Typical command |
|-----------|----------------|
| Next.js | `npm run dev` |
| CRA | `npm start` |
| CRA with mock script | `npm run start:mock` (check scripts first) |

Tell them the FAB (⋞) will appear at bottom-right once the dev server is running and the page loads in the browser.

---

## Usage Flow

### Phase A — User captures an element

1. User clicks the orange FAB (⋞) — cursor becomes crosshair, elements highlight with orange border on hover
2. User clicks the target element — highlight disappears, a panel appears with the element's selector and a textarea
3. User types a fix description and presses Enter / clicks "Send Fix Task" — or clicks "Cancel" / presses Escape to dismiss with no task sent
4. If confirmed: panel closes, orange shimmer appears over the selected element, browser sends `TASK` over WebSocket to `ws://localhost:7332`

### Phase B — TASK notification arrives

The Monitor tool delivers the TASK line as a real-time notification the moment the browser sends the task over WebSocket. **Before acting, verify all required fields are present** (see Payload Schema below). If any required field is missing or the JSON is malformed, the server has a bug — fix it before proceeding.

### Phase C — Plan the work

**Create a task list immediately** using this template:

```
1. Read payload — identify page, card, and relevant source file
2. Locate source file for the change
3. Apply the code change
4. Run type check: npx tsc --noEmit
5. Send completion: POST /complete/<taskId>
```

Use `page` + `pageTitle` to identify the route. Use `container.title` to identify the exact card by name. Use `container.dataKeys` to understand the expected data shape. Together these let you find the relevant source file without guessing.

To find source files, search by framework:

- **Next.js:** `src/app/` (routes + layouts), `src/components/`, `src/lib/`, `src/mocks/MockProvider.tsx`, `src/app/api/`
- **CRA:** `src/app/` or `src/pages/` (routes), `src/components/`, `src/lib/`, `src/mocks/`

If the project uses a different directory structure, run `ls src/` to discover the actual layout before searching.

### Phase D — Apply the change

Apply the code change, then run:

```sh
cd <frontend> && npx tsc --noEmit 2>&1 | head -40
```

**If the type check shows new errors in your modified file(s):** fix them before proceeding. Do not send completion while type errors exist in code you changed.

**Pre-existing errors in unrelated files** (files you did not touch) are not your concern — ignore them.

**NodeList iteration rule:** Never use `for...of` over a NodeList returned by `querySelectorAll`. TypeScript requires `--downlevelIteration` for this, which is not enabled in this project. Always use `.forEach()` instead:

```ts
// ❌ Fails without --downlevelIteration
for (const child of card.querySelectorAll('span, div')) { ... }

// ✅ Always safe
card.querySelectorAll('span, div').forEach((child) => { ... });
```

### Phase E — Send completion

**Compilation gate — mandatory before sending completion.**

Run the type check and confirm it is clean:

```sh
cd <frontend> && npx tsc --noEmit 2>&1 | head -40
```

Only proceed if the output shows **zero new errors in your modified files**. If there are errors, fix them and re-run until the check is clean. Do not skip this step even for trivial-looking changes — undetected type errors will break the build silently.

Once the compilation gate passes, run the pre-completion checklist:

- [ ] Compilation gate passed (no new tsc errors in modified files)
- [ ] File is saved to disk
- [ ] `taskId` in the curl matches exactly the `id` from the TASK payload

Then send completion:

```sh
curl -s -X POST http://localhost:7333/complete/<taskId>
```

Expected response: `ok (task <taskId>)`

The shimmer disappears and the dev server hot-reloads the change.

### Phase F — Force reload for mock-data-only changes

If the change was **mock data only** (e.g. editing values in `MockProvider.tsx`) and HMR didn't trigger a visible re-render, force a full page reload:

```sh
curl -s -X POST http://localhost:7333/reload
```

Expected response: `reload sent to N client(s)`

The browser receives `RELOAD` over its persistent WS connection and calls `window.location.reload()`. Only use this for mock data changes — component/JSX changes are handled by standard HMR.

---

## Handling Edge Cases

### TypeScript errors in modified files

Fix the errors before sending completion. If a fix would require changing infrastructure files (`dom-inspector.ts`, `LiveUIProvider.tsx`, `ws-task-server.js`) — which are off-limits — tell the user and describe what manual change is needed. Still send completion so the shimmer clears.

### Concurrent tasks

If two TASK notifications arrive before the first is resolved, **process them sequentially**: finish the first task completely (type check + completion curl) before starting the second. Do not apply both changes simultaneously — overlapping edits to the same file will cause conflicts.

### WS server not running

If `lsof -i :7332` shows nothing: the server is not running. Restart it (Step 3). The shimmer will auto-remove after 180 s regardless. You can still apply the change and send completion once the server is restarted — if the browser tab is still open and reconnects.

### Completion returns 404

The browser's WebSocket connection was already closed (tab reload, navigation, or the 180 s fallback triggered). The shimmer is already gone. Still log the completion attempt for the user.

---

## Payload Schema

Every TASK payload printed by the server contains these fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | 8-char alphanumeric task ID |
| `type` | string | yes | Always `"dom-fix"` |
| `prompt` | string | yes | Free-text user description of the fix |
| `element.selector` | string | yes | CSS selector targeting the captured element |
| `element.tag` | string | yes | Lowercase tag name |
| `element.html` | string | yes | `outerHTML` truncated to 2000 chars |
| `element.text` | string | yes | `textContent` trimmed, truncated to 500 chars |
| `element.styles` | object | yes | Map of computed style properties |
| `container.selector` | string | no | CSS selector for the containing card |
| `container.tag` | string | no | Tag name of the card container |
| `container.html` | string | no | Card `outerHTML` truncated to 3000 chars |
| `container.text` | string | no | All card text truncated to 1000 chars |
| `container.title` | string | no | Extracted card title (e.g. `"Water Intake"`) |
| `container.value` | string | no | Extracted numeric value (e.g. `"45,200"`) |
| `container.description` | string | no | Unit or description (e.g. `"m³"`) |
| `container.dataKeys` | string[] | no | Sub-labels from the card (e.g. pie slice names) |
| `pageTitle` | string | yes* | `document.title` — identifies the page route |
| `page` | string | yes | Full `window.location.href` |

\* `pageTitle` and the entire `container` object may be absent in CRA projects where an older `dom-inspector.ts` is already in place and does not implement `enrichContext()` or send `pageTitle`. When these fields are missing, use the `page` URL alone to identify the route and locate the relevant source file.

---

## Code Change Constraints

Changes MUST:

- **Target only application code**, not infrastructure files. Never modify:
  - `src/mocks/dom-inspector.ts`
  - `src/lib/LiveUIProvider.tsx`
  - `<repo-root>/ws-task-server.js`
- **Pass type check:** `npx tsc --noEmit` must show no new errors in the modified file(s)
- **No new npm dependencies:** work with what's already in `package.json` or inline the logic
- **Be scoped:** only change the file(s) directly responsible for the user's request. Do not refactor unrelated code.

---

## Mock Data Approach

When the user asks for mock data to populate an empty card or page:

### 1. Check which mock pattern the project uses

- **Fetch interceptor (`MockProvider.tsx`):** look for a `window.fetch` patch in `src/mocks/MockProvider.tsx`. This is the preferred pattern for Next.js App Router projects that have SSR issues with MSW. Add a new key to `mockData` and a new `if` branch in the interceptor for the relevant URL.
- **MSW (`src/mocks/handlers/`):** if `node_modules/msw` exists and handlers are already present, add a new handler there instead.

### 2. Identify the exact endpoint

Use `page` and `container.title` from the payload to locate the page source file. Read it to find the `fetch()` call that feeds the target card. Do not guess the URL — read the actual source.

### 3. Add mock data for that endpoint only

Add mock data only for the API endpoint that feeds the card the user pointed at. Do not mock unrelated routes.

### 4. HMR compatibility (fetch interceptor)

The `MockProvider` pattern uses `useRef` to expose `mockData` to the interceptor closure, so HMR picks up data changes without a full reload:

```tsx
const dataRef = useRef(mockData)
dataRef.current = mockData  // updated every render

// interceptor reads from dataRef.current, not from the stale closure
```

If this pattern is already in place, a hot reload handles data edits. If HMR still doesn't reflect changes, send `POST /reload` after the completion curl.

### 5. Wire MockProvider in layout (if not yet present)

**Next.js** — use `next/dynamic` with `{ ssr: false }` to prevent SSR interference:

```tsx
import dynamic from 'next/dynamic'
const MockProvider = dynamic(() => import('@/mocks/MockProvider'), { ssr: false })

// in layout body:
<MockProvider><LiveUIProvider>{children}</LiveUIProvider></MockProvider>
```

**CRA** — no SSR, so a plain import in `App.tsx` suffices:

```tsx
import MockProvider from '../mocks/MockProvider'

// in render, wrapping Router children:
<MockProvider>
  <LiveUIProvider>
    {/* routes */}
  </LiveUIProvider>
</MockProvider>
```

---

## Completion Signal Reference

| Action | Command | Expected response |
|--------|---------|-------------------|
| Standard task completion | `curl -s -X POST http://localhost:7333/complete/<taskId>` | `ok (task <taskId>)` |
| Force full page reload (mock data only) | `curl -s -X POST http://localhost:7333/reload` | `reload sent to N client(s)` |

### Timing

- Objective: TASK received → change applied → completion sent in **under 60 seconds** for simple changes.
- The shimmer auto-removes after **180 seconds** if no completion signal is received.

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Sending completion before saving the file | Always save first. The browser sees the result when the shimmer disappears. |
| Wrong `taskId` in curl | Copy the `id` value exactly from the TASK JSON. It is 8 alphanumeric chars. |
| Editing `dom-inspector.ts`, `LiveUIProvider.tsx`, or `ws-task-server.js` | These are infrastructure — off-limits. Apply changes in application source files only. |
| Server not running (`lsof -i :7332` empty) | Start the server via Monitor (Step 3) before acting on any TASK. Do not use bash — it's ephemeral and can't host a persistent server. |
| `MODULE_NOT_FOUND` when starting server | Wrong `NODE_PATH`. Set it to `<frontend>/node_modules`, not `<repo-root>/node_modules`. |
| TypeScript errors in modified file | Run `npx tsc --noEmit` and fix new errors before curling completion. Ignore pre-existing errors in other files. |
| `for...of` over a NodeList | `querySelectorAll` returns a `NodeList`. Iterating it with `for...of` requires `--downlevelIteration`, which is not enabled. Use `.forEach()` instead — it works natively on `NodeList` in all TypeScript versions. |
| Skipping the compilation gate | Always run `npx tsc --noEmit` and confirm it is clean before sending `POST /complete`. Never assume a change is type-safe without checking. |
| Shimmer not appearing on SVG elements | The targeted element may be `rect`, `path`, or `circle` — SVG nodes reject HTML children. Shimmer must use a `fixed` overlay on `document.body` positioned via `getBoundingClientRect()`. |
| Mocking too many endpoints | Only mock the single endpoint that feeds the card the user pointed at. Use `container.title` + `page` to identify it. |
| HMR not reflecting mock data edit | Send `POST /reload` after the completion curl to force a full page reload. |
| Two tasks in flight simultaneously | Process tasks sequentially. Complete task 1 fully (including curl) before starting task 2. |
| Starting the dev server yourself | Never run `npm run dev`. Instruct the user to start it and wait for confirmation. |
| `<repo-root>` or `<frontend>` not resolved | Run `git rev-parse --show-toplevel` and inspect `package.json` for `next` or `react-scripts`/`@craco/craco` to resolve both paths and detect the framework before setup. |
| CRA: `'use client'` in LiveUIProvider | CRA is not Next.js — remove the `'use client'` directive. It is meaningless in CRA and may cause a parse error. |
| CRA: `@/` import alias in LiveUIProvider | CRA does not support the `@/` alias. Use a relative path (`../mocks/dom-inspector`) or the project's configured alias (`~/`). |
| CRA: wired in a layout file | CRA has no `layout.tsx`. Wire `LiveUIProvider` in `App.tsx` (or the root component) wrapping the Router's children. |
| CRA: `npm run dev` for dev server | CRA uses `npm start` (or a custom script like `npm run start:mock`). Check `package.json` scripts before instructing the user. |
| CRA: `pageTitle` or `container` missing from payload | Older CRA `dom-inspector.ts` implementations may not send these fields. Fall back to the `page` URL to identify the route. Do not error — treat them as optional. |
| `ws` module: `WebSocketServer is not a constructor` | The installed `ws` version is v7, which exports `Server` not `WebSocketServer`. The server template above handles this automatically via `wsModule.WebSocketServer \|\| wsModule.Server`. |
