<div align="center">
  <img src="./frontloop-logo.png" alt="frontloop" height="128" />
</div>

---
<div align="center">
<div style="font-size: 24px;"><span style="color: #ff6b35;">Frontend iteration,</span> in the browser, with any coding agent.</div>
  <br/> 
  Frontloop instruments your running dev app in the browser. Click any element, describe the change, and structured DOM context — selector, computed styles, React/Angular component hierarchy, and page URL - streams to your coding agent over WebSocket. The agent edits the real source file. Hot reload delivers the result.

  Works with Claude Code today. Cursor, Copilot Workspace, Gemini CLI, and Windsurf are on the roadmap.
</div>
<br/> 

---

![demo](./fl-gif.gif)

## Why
- **Efficient**: The current workflow for making UI changes with coding agents is disjointed and inefficient. You have to switch between your running app (browser), the coding agent and your IDE. You have to describe the element, its styles, and its context in text prompts, which is less precise and more time-consuming than direct interaction. Frontloop sends structured DOM context directly to the agent — selector, computed styles, and component hierarchy — so it locates the right file and makes the edit in one step.
- **Time & Token saving**: When you say "remove the due date column on invoice page", Less context for the agent leads to more back-and-forth using `grep` and slower iterations. With full DOM context, coding agents can make precise edits in one step, saving tokens and time.
- **Intuitive**: Faster iterations with real-time feedback enable a more intuitive and efficient workflow. You can see the impact of your changes immediately, make adjustments on the fly, and achieve the desired result in fewer steps.
- **Agent-agnostic**: The WebSocket server and DOM inspector work with any coding agent that can read from a WebSocket endpoint. Claude Code is supported today. Cursor, Copilot Workspace, Gemini CLI, and Windsurf are planned. Same browser extension, same payload, same workflow.

## Install

### Claude Code
```
/plugin marketplace add tamal-thetaonelab/frontloop
/plugin install frontloop
```

---

## Skills

### `/live-ui-generation`

Click any element on your running app. Describe the change. The coding agent receives the full DOM context — selector, outer HTML, computed styles, container context, and page URL — edits the source file directly, and hot reload delivers the result. Made a mistake? Hit Undo and the agent reverts it.

A shimmer appears over the selected element while the agent works and clears on completion.

![side-by-side](./side-by-side.png)
![demo](./demo.png)

Other visual editing tools give the agent the rendered page. Frontloop gives it the component tree.

```json
{
  "id": "a3f9bc12",
  "type": "dom-fix",
  "prompt": "make this card background light grey and increase padding to 24px",
  "element": {
    "selector": "#employee-card > div.header",
    "tag": "div",
    "html": "<div class=\"header\">...</div>",
    "text": "Employee Card",
    "styles": { "background": "rgb(255,255,255)", "padding": "16px" },
    "componentHierarchy": "EmployeeCard (EmployeeList > AppRoot)"
  },
  "container": { "title": "Employee Card", "dataKeys": ["Name", "Role"] },
  "pageTitle": "Employees — MyApp",
  "page": "http://localhost:4300/app/employee"
}
```

Not a CSS override. A real source edit with full codebase context.

**How it works:**

- A floating button (FAB) appears in your browser in dev mode
- Hover to expand: the FAB transforms to **✛ Inspect** and reveals **[] Screenshot** and **↩ Undo** dial items
- **Clicking the FAB starts Inspect mode directly** — click an element, describe the fix, orange shimmer appears while the agent works
- In Screenshot mode, drag a box around any area and describe the fix — an indigo shimmer appears
- In Undo mode, the agent reverts the last change and reloads the page
- Both panels include a **"Send console errors"** checkbox — when checked, captured `console.error` calls are included in the task payload so the agent can diagnose issues without asking
- A WebSocket server streams the task payload to the coding agent as a real-time notification
- The agent edits the source file, runs a type check, then sends a completion signal
- Shimmer clears, HMR delivers the change. If HMR may not apply, a reload signal is sent instead.

**Framework support:**
- ✅ React (Vite)
- ✅ React (CRA / CRACO)
- ✅ Next.js (App Router)
- ✅ Vue 3 (Vite)
- ✅ Svelte / SvelteKit (Vite)
- ✅ Angular
- ✅ Vanilla JS/TS
---

## Update

### Claude Code
```
/plugin marketplace update frontloop
```
( set auto-update to true for automatic updates )


---

## Requirements

- Claude Code
- Node.js 18 or higher
- Dev server running before invoking the skill (for WebSocket connection and DOM context)

---

## Roadmap

### 🚧 `mock-setup` *(in development)*
A complete mock backend layer using Mock Service Worker. The agent reads your existing API calls, generates stateful MSW handlers, wires up working auth without touching production code, and verifies every route renders correctly.

Run your frontend entirely offline. Demo without a real backend. Build features before the API exists.

---

### 🚧 Agent support beyond Claude Code

`live-ui-generation` works with Claude Code today. The WebSocket server and DOM inspector are agent-agnostic — any coding agent that can read from a WebSocket endpoint can consume the task payload.

Planned: Cursor, GitHub Copilot Workspace, Gemini CLI, Windsurf.

---

### 🚧 UI platform support

Planned additions: React Native web (Expo), Nuxt, SvelteKit (non-Vite).

---

## What this is not

- Not active in production — dev mode only
- Not a cloud service — everything runs on localhost
- Not a no-code tool — Claude writes real source code against your real codebase
- Not a CSS inspector — changes persist in source files, not browser overrides

---

## Contributing

New plugins and skills welcome. Fixing bugs, improving docs, and expanding agent or framework support are all great ways to contribute.

---

## License

MIT

---
Built with ❤️ by [Tamal Sen](https://github.com/tamal-thetaonelab) - A bengali coder turned entrepreneur.
